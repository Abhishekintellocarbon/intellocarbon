/**
 * IntelloAdvisor Phase 4 — Pathway Modelling.
 *
 * Projects a facility's existing calculated position forward under a chosen
 * scenario. It introduces no new calculation model: emissions come from the
 * stored EmissionCalculationResult, the solar capacity comes from the same
 * sizing function the recommendation card uses, the liability comes from the
 * same certificate arithmetic the CBAM report is priced with, and the CCTS
 * position comes from the same surplus/deficit formula. There is no LLM, no
 * model, no network call and no randomness — the same stored data and the same
 * scenario input produce byte-identical output every time.
 *
 * Derived on read, for the same reason the recommendation engine is: a stored
 * projection would freeze the certificate price and the grid factor as they
 * were at write time, and a projection that disagreed with the facility's own
 * report would be worse than no projection at all. There is nothing to
 * invalidate because there is nothing stored.
 */
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/AppError";
import { requireAccessibleFacility } from "../facility.service";
import { requireEsgBundleAccess } from "../esgBundleAccess.service";
import { getCbamCertificatePrice } from "../../data/cbamReferenceData";
import type { Citation } from "../../data/decarbonizationBenchmarks";
import { reportingPeriodDays, resolveBillData, type BillDocument } from "../recommendationEngine";
import {
  solarAdoptionScenario,
  productionChangeScenario,
  businessAsUsualScenario,
  currentCctsPosition,
  type PathwayFacts,
} from "./scenarios";
import { computeCbamCertificateArithmetic } from "../cbamFinancialImpact.service";
import type { PathwayReport, PathwayScenario } from "./types";

/**
 * Bumped whenever a scenario's arithmetic or its stated assumption changes, so
 * output captured from an older build is identifiable. Tracks the scenario set
 * only, independently of the recommendation engine's own version.
 */
export const PATHWAY_ENGINE_VERSION = "1.0.0";

const DAYS_PER_YEAR = 365;

/**
 * Bounds on the production-change input.
 *
 * −100% is a complete shutdown, at which the intensity-held model degenerates
 * (zero production, zero emissions, a zero CCTS position) and says nothing
 * useful, so it is excluded rather than rendered as a row of zeroes. The upper
 * bound is a sanity limit, not a claim about what a plant can do: past a
 * tripling of output, holding this period's intensity constant stops being a
 * defensible assumption at all.
 */
export const PRODUCTION_CHANGE_MIN_PCT = -99;
export const PRODUCTION_CHANGE_MAX_PCT = 200;

export const parseProductionChangePct = (raw: unknown): number | null => {
  if (raw === undefined || raw === null || raw === "") return null;
  const value = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(value)) {
    throw AppError.badRequest("Production change must be a number, as a percentage.", "VALIDATION_ERROR");
  }
  if (value < PRODUCTION_CHANGE_MIN_PCT || value > PRODUCTION_CHANGE_MAX_PCT) {
    throw AppError.badRequest(
      `Production change must be between ${PRODUCTION_CHANGE_MIN_PCT}% and ${PRODUCTION_CHANGE_MAX_PCT}%.`,
      "VALIDATION_ERROR",
    );
  }
  // One decimal place. Two would imply the projection resolves a 0.01% change
  // in volume, which the underlying annual production figure does not support.
  return Math.round(value * 10) / 10;
};

/** The certificate price, as a citation, so a projected EUR figure carries its source. */
const certificatePriceCitation = (): Citation => {
  const price = getCbamCertificatePrice();
  return {
    publisher: "European Commission",
    document: price.source,
    reference: `CBAM certificate price, ${price.pricePerTonneEur} EUR/tCO2e (${price.quarterLabel})`,
    asOf: price.asOfDate,
    verification: "VERIFIED_AGAINST_PRIMARY_SOURCE",
  };
};

/**
 * Production for a period, on the basis CBAM prices against.
 *
 * The electricity sector's CBAM SEE is per MWh exported to the EU rather than
 * per tonne of product, which is the same branch computeCbamFinancialImpact
 * takes. Reproducing the branch here rather than importing it is unavoidable —
 * that function takes a full ReportContext — but the condition is one line and
 * the test pins the two against each other.
 */
const productionFor = (row: {
  sector: string;
  productionQuantityT: number | null;
  electricityExportedEuMwh: number | null;
}): { value: number | null; label: string } =>
  row.sector === "ELECTRICITY"
    ? { value: row.electricityExportedEuMwh ?? null, label: "MWh exported to the EU" }
    : { value: row.productionQuantityT ?? null, label: "t" };

type PeriodRow = {
  id: string;
  sector: string;
  periodStart: Date | null;
  periodEnd: Date | null;
  productionQuantityT: number | null;
  electricityExportedEuMwh: number | null;
  carbonPricePaidEurPerTonne: number | null;
  cctsTargetIntensity: number | null;
  gridElectricityMwh: number;
  documents: BillDocument[];
  calculationResult: {
    totalEmissionsCbamAr5: number;
    totalEmissionsCctsAr2Bur3: number;
    indirectElectricityCo2e: number;
    ghgIntensityCcts: number;
    gridEmissionFactorUsed: number;
    calculatedAt: Date;
  } | null;
};

/**
 * Builds the report from already-loaded rows.
 *
 * Split out from the queries below so every scenario is testable without a
 * database — the projections are pure, and this is the only place their inputs
 * are assembled.
 */
export const buildPathwayReport = (input: {
  facility: { id: string; name: string; state: string | null; sector: string };
  /** The period being projected. */
  period: PeriodRow | null;
  /** Every submitted, calculated period for this facility, oldest first — the BAU trend. */
  history: Array<{ periodEnd: Date | null; sector: string; productionQuantityT: number | null; electricityExportedEuMwh: number | null }>;
  productionChangePct: number | null;
  now?: Date;
}): PathwayReport => {
  const generatedAt = input.now ?? new Date();
  const base = {
    facility: input.facility,
    generatedAt,
    engineVersion: PATHWAY_ENGINE_VERSION,
    basis: "CBAM_AR5" as const,
  };

  if (!input.period || !input.period.calculationResult) {
    return {
      ...base,
      activityData: null,
      basedOnCalculationAt: null,
      current: null,
      scenarios: [],
      unavailableReason:
        "This facility has no submitted activity data with a completed emissions calculation, so there is no current position to project forward. Submit a reporting period first.",
    };
  }

  const period = input.period;
  const calc = period.calculationResult!;
  const days = reportingPeriodDays(period.periodStart, period.periodEnd);
  const annualisedGridMwh = days ? period.gridElectricityMwh * (DAYS_PER_YEAR / days) : null;
  const billData = resolveBillData(period.documents, input.facility.state);

  const production = productionFor(period);
  const price = getCbamCertificatePrice();
  const certCitation = certificatePriceCitation();
  const carbonPricePaidEurPerTonne = period.carbonPricePaidEurPerTonne ?? 0;

  const facts: PathwayFacts = {
    totalEmissionsCbamAr5: calc.totalEmissionsCbamAr5,
    totalEmissionsCctsAr2Bur3: calc.totalEmissionsCctsAr2Bur3,
    ghgIntensityCcts: calc.ghgIntensityCcts,
    production: production.value,
    productionBasisLabel: production.label,
    certificatePrice: price.pricePerTonneEur,
    certificatePriceCitation: certCitation,
    carbonPricePaidEurPerTonne,
    cctsTargetIntensity: period.cctsTargetIntensity,
    emissionFactorUsed: calc.gridEmissionFactorUsed,
    // Same derivation as buildComposition's shareOf, over the same two stored
    // columns, so the pathway and the recommendation card agree on whether
    // solar is a material lever for this facility.
    scope2ElectricitySharePct:
      calc.totalEmissionsCbamAr5 > 0 ? (calc.indirectElectricityCo2e / calc.totalEmissionsCbamAr5) * 100 : 0,
    annualisedGridMwh,
    reportingPeriodDays: days,
    sanctionedLoad: billData.sanctionedLoad,
    sanctionedLoadAbsenceReason: billData.absenceReason,
    history: input.history.map((h) => ({ periodEnd: h.periodEnd, production: productionFor(h).value })),
  };

  const liability = computeCbamCertificateArithmetic({
    totalEmissionsCbamAr5: calc.totalEmissionsCbamAr5,
    production: production.value ?? 0,
    carbonPricePaidEurPerTonne,
    certificatePrice: price.pricePerTonneEur,
  });

  // Order: baseline first, then the two levers. A customer reads "where I am
  // heading if nothing changes" before "what changes if I act", and the
  // selector defaults to the first entry.
  const scenarios: PathwayScenario[] = [
    businessAsUsualScenario(facts, certCitation),
    solarAdoptionScenario(facts, certCitation),
    productionChangeScenario(facts, input.productionChangePct, certCitation),
  ];

  return {
    ...base,
    activityData: {
      id: period.id,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      reportingPeriodDays: days,
    },
    basedOnCalculationAt: calc.calculatedAt,
    current: {
      totalEmissionsCbamAr5: calc.totalEmissionsCbamAr5,
      ghgIntensityCcts: calc.ghgIntensityCcts,
      productionQuantityT: production.value,
      productionBasisLabel: production.label,
      cbamNetLiabilityEur: liability.netLiabilityEur,
      cbamGrossLiabilityEur: liability.grossLiabilityEur,
      certificatePrice: price.pricePerTonneEur,
      certificatePriceQuarter: price.quarterLabel,
      certificatePriceSource: price.source,
      carbonPricePaidEurPerTonne,
      cctsTargetIntensity: period.cctsTargetIntensity,
      cctsPositionTco2e: currentCctsPosition(facts),
    },
    scenarios,
    unavailableReason: null,
  };
};

/**
 * The gate, identical to the recommendation engine's.
 *
 * `requireAccessibleFacility` answers "may this user see this facility at all?"
 * — the same chokepoint the dashboard, documents and recommendations already
 * use, so this grants nothing new and does not narrow the endpoint to owners
 * only (which would drop a company's assigned internal operators).
 * `requireEsgBundleAccess` then answers "has this company bought the module?"
 *
 * Server-side, and not only in the dashboard: the URL is guessable from any
 * other facility route, so a client-side hide over an open endpoint would stop
 * nobody. A non-subscriber gets 403 ESG_BUNDLE_NOT_SUBSCRIBED here, before any
 * projection is computed.
 */
const requireAdvisorAccess = async (userId: string, facilityId: string) => {
  const facility = await requireAccessibleFacility(userId, facilityId);
  await requireEsgBundleAccess(facility.companyId);
  return facility;
};

const PERIOD_INCLUDE = {
  calculationResult: {
    select: {
      totalEmissionsCbamAr5: true,
      totalEmissionsCctsAr2Bur3: true,
      indirectElectricityCo2e: true,
      ghgIntensityCcts: true,
      gridEmissionFactorUsed: true,
      calculatedAt: true,
    },
  },
  documents: {
    where: { documentType: "SUPPORTING_EVIDENCE" as const },
    select: { id: true, billExtraction: true },
    orderBy: { createdAt: "asc" as const },
  },
} as const;

/**
 * Every submitted, calculated period for the facility, oldest first — the only
 * source the business-as-usual trend draws on.
 */
const loadHistory = (facilityId: string) =>
  prisma.activityData.findMany({
    where: { facilityId, status: "SUBMITTED", calculationResult: { isNot: null } },
    orderBy: [{ periodEnd: "asc" }, { createdAt: "asc" }],
    select: { periodEnd: true, sector: true, productionQuantityT: true, electricityExportedEuMwh: true },
  });

/** Pathway projections for a facility's most recent submitted reporting period. */
export const getPathwayForFacility = async (
  userId: string,
  facilityId: string,
  productionChangePct: number | null,
): Promise<PathwayReport> => {
  const facility = await requireAdvisorAccess(userId, facilityId);

  // Ordered by periodEnd rather than createdAt, matching the recommendation
  // engine, so a back-dated correction entered later does not displace the
  // current period's position.
  const [period, history] = await Promise.all([
    prisma.activityData.findFirst({
      where: { facilityId, status: "SUBMITTED", calculationResult: { isNot: null } },
      orderBy: [{ periodEnd: "desc" }, { createdAt: "desc" }],
      include: PERIOD_INCLUDE,
    }),
    loadHistory(facilityId),
  ]);

  return buildPathwayReport({
    facility: { id: facility.id, name: facility.name, state: facility.state, sector: facility.company.sector },
    period,
    history,
    productionChangePct,
  });
};

/** Pathway projections for one specific reporting period, rather than the latest. */
export const getPathwayForActivityData = async (
  userId: string,
  facilityId: string,
  activityDataId: string,
  productionChangePct: number | null,
): Promise<PathwayReport> => {
  const facility = await requireAdvisorAccess(userId, facilityId);

  const [period, history] = await Promise.all([
    prisma.activityData.findUnique({ where: { id: activityDataId }, include: PERIOD_INCLUDE }),
    loadHistory(facilityId),
  ]);

  if (!period || period.facilityId !== facilityId) {
    throw AppError.notFound("Activity data entry not found");
  }

  return buildPathwayReport({
    facility: { id: facility.id, name: facility.name, state: facility.state, sector: facility.company.sector },
    period,
    // Only history up to and including the period being projected — projecting
    // a past period forward on a trend that includes periods after it would be
    // hindsight dressed as a projection.
    history: history.filter((h) => !period.periodEnd || !h.periodEnd || h.periodEnd <= period.periodEnd),
    productionChangePct,
  });
};
