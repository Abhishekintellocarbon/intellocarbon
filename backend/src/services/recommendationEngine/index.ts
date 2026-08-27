/**
 * IntelloAdvisor Phase 2 — Decarbonization Recommendation Engine.
 *
 * Loads what the platform already knows about a facility, derives the facts the
 * rules need, and runs the rule set. It contains no emissions arithmetic of its
 * own and makes no external calls: no LLM, no model, no network. Given the same
 * stored calculation, the same bill data and the same benchmark table, it
 * returns byte-identical output every time.
 *
 * ON FRESHNESS (requirement: recommendations must never be stale)
 * --------------------------------------------------------------
 * Recommendations are derived on read rather than written to a table when the
 * calculation runs. That is a stronger guarantee than a regeneration hook, not
 * a weaker one:
 *
 *   - A hook has to be called from every site that recalculates. There are
 *     three today (submitActivityData, createActivityData, the demo seeder) and
 *     a fourth added later that forgets would silently serve stale advice.
 *   - Stored cards freeze the benchmarks and the CEA grid factor as they were
 *     at write time. The Emission Factor Manager supersedes that factor at
 *     runtime, so a stored card could cite 0.716 while the facility's own
 *     report had been recalculated at a different value — a cited number
 *     disagreeing with the calculation it claims to cite.
 *
 * Deriving on read makes both failures impossible: there is nothing to
 * invalidate. `basedOnCalculationAt` is carried through so a caller can still
 * show which calculation the advice reflects.
 */
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/AppError";
import { requireAccessibleFacility } from "../facility.service";
import { requireEsgBundleAccess } from "../esgBundleAccess.service";
import { buildComposition, buildGridFactorSplit, type EmissionsComposition, type GridFactorSplit } from "./composition";
import { solarSelfGenerationRule, fuelSwitchRule, liabilityStructureRule, type SanctionedLoad } from "./rules";
import type { RecommendationCard } from "./types";

/**
 * Bumped whenever a rule's arithmetic or trigger changes, so output captured
 * from an older build is identifiable. Not a package version — it tracks the
 * rule set only.
 */
export const RECOMMENDATION_ENGINE_VERSION = "2.0.0";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DAYS_PER_YEAR = 365;

export type StateMismatch = {
  /** State implied by the distribution utility printed on the bill. */
  billState: string;
  /** State recorded against the facility in the customer's account. */
  facilityState: string;
  discomName: string | null;
  message: string;
};

export type BillDataUsed = {
  sanctionedLoad: SanctionedLoad | null;
  /** Set when sanctionedLoad is null, explaining which of the two reasons applies. */
  absenceReason: string | null;
  /** The document the load was read from, for traceability back to the uploaded bill. */
  sourceDocumentId: string | null;
  /** State implied by the discom on the bill, when one was identified. */
  billState: string | null;
  /**
   * Which state the open-access rules were actually resolved against.
   *
   * The bill wins where it names a utility we recognise: open access is a
   * property of the connection, and the connection is what the bill describes.
   * A facility's registered state is an address, and a company can hold a
   * connection billed by a utility in a different state.
   */
  openAccessStateSource: "BILL_DISCOM" | "FACILITY_PROFILE" | "NONE";
  /**
   * Set when the bill's state and the facility's registered state disagree.
   * Never resolved silently — one of the two is wrong, and which one matters
   * enough to a customer's open-access position that they have to be told.
   */
  stateMismatch: StateMismatch | null;
};

export type RecommendationReport = {
  facility: { id: string; name: string; state: string | null; sector: string };
  activityData: {
    id: string;
    periodStart: Date | null;
    periodEnd: Date | null;
    reportingPeriodDays: number | null;
    annualisedGridMwh: number | null;
  } | null;
  basedOnCalculationAt: Date | null;
  generatedAt: Date;
  engineVersion: string;
  basis: "CBAM_AR5";
  composition: EmissionsComposition | null;
  gridFactorSplit: GridFactorSplit | null;
  billDataUsed: BillDataUsed;
  recommendations: RecommendationCard[];
  /** Non-null when no analysis could be produced; recommendations is then empty. */
  unavailableReason: string | null;
};

/**
 * Inclusive day count across the reporting period.
 *
 * Inclusive because a bill period of 01 June to 30 June is 30 days of supply,
 * not 29 — an off-by-one here propagates straight into annualised consumption
 * and from there into the solar sizing.
 */
const reportingPeriodDays = (start: Date | null, end: Date | null): number | null => {
  if (!start || !end) return null;
  const days = Math.round((end.getTime() - start.getTime()) / MS_PER_DAY) + 1;
  return days > 0 ? days : null;
};

type BillExtractionRow = {
  status: string;
  state: string | null;
  sanctionedLoadValue: number | null;
  sanctionedLoadUnit: string | null;
  discomName: string | null;
  tariffCode: string | null;
};

type BillDocument = { id: string; billExtraction: BillExtractionRow | null };

const completedExtractions = (documents: BillDocument[]) =>
  documents.filter((d) => d.billExtraction?.status === "COMPLETED").map((d) => ({ id: d.id, e: d.billExtraction! }));

/**
 * Reads the bill facts this engine uses: the sanctioned load, and the state
 * implied by the distribution utility.
 *
 * Both refuse on conflict rather than resolving it. Two bills stating different
 * loads is not settled by preferring the newer or the larger one — the same
 * rule Phase 1 applies within a single bill applies here across several — and
 * the same goes for two bills naming utilities in different states. A conflict
 * yields null and a reason, and the solar rule then omits its sizing rather
 * than sizing against a coin toss.
 */
const resolveBillData = (documents: BillDocument[], facilityState: string | null): BillDataUsed => {
  const completed = completedExtractions(documents);

  // --- State implied by the discom -----------------------------------------
  // Resolved independently of the load: a bill can identify the utility
  // without printing a sanctioned load we could read, and the state alone
  // still decides which open-access regime applies.
  const stateCandidates = completed.filter((c) => c.e.state != null);
  const distinctStates = [...new Set(stateCandidates.map((c) => c.e.state!))];
  const billState = distinctStates.length === 1 ? distinctStates[0] : null;
  const billDiscomName = billState ? (stateCandidates.find((c) => c.e.state === billState)?.e.discomName ?? null) : null;

  const openAccessStateSource: BillDataUsed["openAccessStateSource"] = billState
    ? "BILL_DISCOM"
    : facilityState
      ? "FACILITY_PROFILE"
      : "NONE";

  const stateMismatch: StateMismatch | null =
    billState && facilityState && billState !== facilityState
      ? {
          billState,
          facilityState,
          discomName: billDiscomName,
          message:
            `The bill uploaded for this period is from ${billDiscomName ?? "a distribution utility"}, which supplies ${billState}, ` +
            `but this facility is registered in ${facilityState}. Open-access rules below are shown for ${billState}, because open access ` +
            `is a property of the electricity connection rather than of the site address. One of the two records is wrong — either the ` +
            `wrong bill is attached to this period, or the facility's registered state needs correcting. Resolve it before relying on the ` +
            `eligibility position below.`,
        }
      : null;

  // --- Sanctioned load ------------------------------------------------------
  const loadCandidates = completed
    .filter((c) => c.e.sanctionedLoadValue != null)
    .map((c) => ({
      documentId: c.id,
      load: {
        value: c.e.sanctionedLoadValue!,
        unit: c.e.sanctionedLoadUnit ?? "KVA",
        discomName: c.e.discomName,
        tariffCode: c.e.tariffCode,
        state: c.e.state,
      } satisfies SanctionedLoad,
    }));

  const base = { billState, openAccessStateSource, stateMismatch };

  if (loadCandidates.length === 0) {
    return {
      ...base,
      sanctionedLoad: null,
      absenceReason:
        "No sanctioned load is available for this facility. Upload an electricity bill against this reporting period and IntelloAdvisor will read the sanctioned load off it, after which this recommendation will include an indicative system size and impact range.",
      sourceDocumentId: null,
    };
  }

  const distinct = [...new Map(loadCandidates.map((c) => [`${c.load.value}|${c.load.unit}`, c])).values()];
  if (distinct.length > 1) {
    return {
      ...base,
      sanctionedLoad: null,
      absenceReason: `The bills uploaded for this period state different sanctioned loads (${distinct
        .map((d) => `${d.load.value} ${d.load.unit}`)
        .join(", ")}). No sizing is shown, because choosing between them would be a guess. Remove the bill that does not belong to this connection, or enter the load manually.`,
      sourceDocumentId: null,
    };
  }

  return { ...base, sanctionedLoad: distinct[0].load, absenceReason: null, sourceDocumentId: distinct[0].documentId };
};

/**
 * Orders the cards.
 *
 * The structural card leads because it frames every number below it — a
 * customer needs to know what sets their Scope 2 before being told how to move
 * it. Action cards then run by descending upper impact, with unsized cards last
 * and ties broken on id so the order is stable across identical inputs.
 */
const orderCards = (cards: RecommendationCard[]): RecommendationCard[] =>
  [...cards].sort((a, b) => {
    if (a.category === "LIABILITY_STRUCTURE" && b.category !== "LIABILITY_STRUCTURE") return -1;
    if (b.category === "LIABILITY_STRUCTURE" && a.category !== "LIABILITY_STRUCTURE") return 1;
    const aHigh = a.impact?.high ?? -1;
    const bHigh = b.impact?.high ?? -1;
    if (aHigh !== bHigh) return bHigh - aHigh;
    return a.id.localeCompare(b.id);
  });

/**
 * Builds the report from already-loaded records.
 *
 * Split out from the query above it so the whole engine is testable without a
 * database — the rules are pure, and this is the only place their inputs are
 * assembled.
 */
export const buildRecommendationReport = (input: {
  facility: { id: string; name: string; state: string | null; sector: string };
  activityData: {
    id: string;
    periodStart: Date | null;
    periodEnd: Date | null;
    gridElectricityMwh: number;
    renewableElectricityMwh: number;
    documents: BillDocument[];
  } | null;
  calculationResult: Parameters<typeof buildComposition>[0] | null;
  now?: Date;
}): RecommendationReport => {
  const generatedAt = input.now ?? new Date();
  const base = {
    facility: input.facility,
    generatedAt,
    engineVersion: RECOMMENDATION_ENGINE_VERSION,
    basis: "CBAM_AR5" as const,
  };

  if (!input.activityData || !input.calculationResult) {
    return {
      ...base,
      activityData: null,
      basedOnCalculationAt: null,
      composition: null,
      gridFactorSplit: null,
      billDataUsed: {
        sanctionedLoad: null,
        absenceReason: null,
        sourceDocumentId: null,
        billState: null,
        openAccessStateSource: "NONE",
        stateMismatch: null,
      },
      recommendations: [],
      unavailableReason:
        "This facility has no submitted activity data with a completed emissions calculation, so there is nothing to base recommendations on. Submit a reporting period first.",
    };
  }

  const { activityData, calculationResult } = input;
  const days = reportingPeriodDays(activityData.periodStart, activityData.periodEnd);
  const annualisedGridMwh = days ? activityData.gridElectricityMwh * (DAYS_PER_YEAR / days) : null;

  const composition = buildComposition(calculationResult);
  const grid = buildGridFactorSplit(calculationResult, {
    gridElectricityMwh: activityData.gridElectricityMwh,
    renewableElectricityMwh: activityData.renewableElectricityMwh,
  });
  const billDataUsed = resolveBillData(activityData.documents, input.facility.state);

  const cards = [
    liabilityStructureRule({ composition, grid }),
    solarSelfGenerationRule({
      composition,
      grid,
      // The bill's discom decides the open-access regime where we recognise
      // it, falling back to the registered address otherwise. Any disagreement
      // between the two travels with it and is surfaced, never resolved away.
      openAccessState: billDataUsed.billState ?? input.facility.state,
      openAccessStateSource: billDataUsed.openAccessStateSource,
      stateMismatch: billDataUsed.stateMismatch,
      sanctionedLoad: billDataUsed.sanctionedLoad,
      sanctionedLoadAbsenceReason: billDataUsed.absenceReason,
      annualisedGridMwh,
      reportingPeriodDays: days,
    }),
    fuelSwitchRule({ composition }),
  ].filter((c): c is RecommendationCard => c !== null);

  return {
    ...base,
    activityData: {
      id: activityData.id,
      periodStart: activityData.periodStart,
      periodEnd: activityData.periodEnd,
      reportingPeriodDays: days,
      annualisedGridMwh,
    },
    basedOnCalculationAt: calculationResult.calculatedAt,
    composition,
    gridFactorSplit: grid,
    billDataUsed,
    recommendations: orderCards(cards),
    unavailableReason: null,
  };
};

/**
 * Two gates, in order, on both entry points below.
 *
 * `requireAccessibleFacility` answers "may this user see this facility at all?"
 * — the same chokepoint the dashboard, documents and activity data already use,
 * so this grants nothing new to anyone. It is used rather than
 * requireOwnedFacilityForEsgBundle because that one is owner-only, and
 * narrowing this endpoint to exclude a company's assigned internal operators
 * would be an unrelated behaviour change smuggled in with a paywall.
 *
 * `requireEsgBundleAccess` then answers "has this company bought the module?"
 * IntelloAdvisor ships inside the ESG Disclosure Bundle
 * (SubscriptionTier.BRSR_CORE_REPORTING — the enum kept its original name
 * through the bundle's rename, see data/plans.ts).
 *
 * The gate lives here, on the server, and not only in the dashboard. A
 * client-side hide over an open endpoint stops nothing: the URL is guessable
 * from any other facility route and returns the full report to anyone with a
 * session. Anything the UI hides for commercial reasons has to 403 here first.
 */
const requireAdvisorAccess = async (userId: string, facilityId: string) => {
  const facility = await requireAccessibleFacility(userId, facilityId);
  await requireEsgBundleAccess(facility.companyId);
  return facility;
};

/**
 * Public entry point: recommendations for a facility's most recent submitted
 * reporting period.
 */
export const getRecommendationsForFacility = async (
  userId: string,
  facilityId: string,
): Promise<RecommendationReport> => {
  const facility = await requireAdvisorAccess(userId, facilityId);

  // Most recent submitted period that actually has a calculation behind it.
  // Ordered by periodEnd rather than createdAt so a back-dated correction
  // entered later does not displace the current period's advice.
  const activityData = await prisma.activityData.findFirst({
    where: { facilityId, status: "SUBMITTED", calculationResult: { isNot: null } },
    orderBy: [{ periodEnd: "desc" }, { createdAt: "desc" }],
    include: {
      calculationResult: true,
      documents: {
        where: { documentType: "SUPPORTING_EVIDENCE" },
        select: { id: true, billExtraction: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  return buildRecommendationReport({
    facility: {
      id: facility.id,
      name: facility.name,
      state: facility.state,
      sector: facility.company.sector,
    },
    activityData: activityData
      ? {
          id: activityData.id,
          periodStart: activityData.periodStart,
          periodEnd: activityData.periodEnd,
          gridElectricityMwh: activityData.gridElectricityMwh,
          renewableElectricityMwh: activityData.renewableElectricityMwh,
          documents: activityData.documents,
        }
      : null,
    calculationResult: activityData?.calculationResult ?? null,
  });
};

/** Recommendations for one specific reporting period, rather than the latest. */
export const getRecommendationsForActivityData = async (
  userId: string,
  facilityId: string,
  activityDataId: string,
): Promise<RecommendationReport> => {
  const facility = await requireAdvisorAccess(userId, facilityId);

  const activityData = await prisma.activityData.findUnique({
    where: { id: activityDataId },
    include: {
      calculationResult: true,
      documents: {
        where: { documentType: "SUPPORTING_EVIDENCE" },
        select: { id: true, billExtraction: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!activityData || activityData.facilityId !== facilityId) {
    throw AppError.notFound("Activity data entry not found");
  }

  return buildRecommendationReport({
    facility: {
      id: facility.id,
      name: facility.name,
      state: facility.state,
      sector: facility.company.sector,
    },
    activityData: {
      id: activityData.id,
      periodStart: activityData.periodStart,
      periodEnd: activityData.periodEnd,
      gridElectricityMwh: activityData.gridElectricityMwh,
      renewableElectricityMwh: activityData.renewableElectricityMwh,
      documents: activityData.documents,
    },
    calculationResult: activityData.calculationResult,
  });
};
