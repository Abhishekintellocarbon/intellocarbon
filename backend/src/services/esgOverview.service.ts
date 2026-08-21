import type { Facility, IssbS1S2Report, Scope3Data } from "@prisma/client";
import { prisma } from "../config/prisma";
import { buildCircularityRollup, type CircularityRollup } from "./wasteCircularity.service";
import { buildEnergyMixTrend, type EnergyMixTrend } from "./energyMix.service";
import { listCompanyTargets } from "./companyTarget.service";
import { buildRecCoverage, type RecCoverage } from "./recCoverage.service";
import { buildGovernanceSummary, type GovernanceSummary } from "./governanceSummary.service";
import {
  buildCsrdMetrics,
  CSRD_REPORT_INCLUDE,
  type CsrdConformityEvaluation,
} from "./csrdCalculation.service";
import { buildCdpMetrics, CDP_REPORT_INCLUDE } from "./cdpCalculation.service";
import {
  buildCompanyProductFootprint,
  buildProductFootprint,
  type CompanyProductFootprint,
} from "./productFootprint.service";
import { resolveFyWindow, rollupFacilityGhgForFy } from "./brsrCalculation.service";
import { assessCdpMaturity, type CdpMaturityAssessment } from "./cdpMaturity.service";
import { buildSupplierScorecard, type SupplierScorecard } from "./supplierScorecard.service";
import { buildBenchmarkSet, type BenchmarkSet } from "./sectorBenchmark.service";
import { buildNetZeroTrajectory, type NetZeroTrajectory } from "./netZeroTrajectory.service";
import { buildEcovadisReadiness, type EcovadisReadiness } from "./ecovadisReadiness.service";
import { requireMyCompany } from "./company.service";
import { requireEsgBundleAccess } from "./esgBundleAccess.service";
import { getCompanyBrsrAnalytics, type CompanyBrsrAnalytics } from "./companyDashboard.service";
import { resolveScope3Relevance } from "./scope3Relevance.service";
import { buildIssbS1S2Metrics } from "./issbCalculation.service";
import {
  buildGriMetrics,
  GRI_REPORT_INCLUDE,
  type GriAccordanceEvaluation,
  type GriReportWithRelations,
} from "./griCalculation.service";
import { SCOPE3_CATEGORY_CATALOG } from "../data/scope3Categories";
import { GRI_UNIVERSAL_DISCLOSURES, getGriTopic } from "../data/griStandards";
import {
  BRSR_CORE_ATTRIBUTES,
  ISSB_PILLARS,
  GRI_REPORTING_REQUIREMENTS,
  CSRD_REPORTING_REQUIREMENTS,
  CDP_REPORTING_REQUIREMENTS,
  isRequirementMet,
  type DisclosureRequirement,
} from "../data/esgDisclosureChecklist";
import { getBrsrReportPeriodStatus, currentBrsrFyLabel } from "../data/complianceDeadlines";
import { round } from "./dashboardShared.helpers";
import { rollUpWaterFootprints, type WaterFootprintRollup } from "./waterCalculation.service";
import { summariseOffsets, type OffsetTotals } from "./voluntaryOffset.service";
import {
  buildDeadlineItem,
  buildPointsTrendItem,
  buildTrendItem,
  sortLivePosition,
  type LivePositionItem,
} from "./livePosition.helpers";

/**
 * The unified ESG Overview aggregate — one call backing the single screen
 * that compiles BRSR Core, ISSB IFRS S1/S2 and Scope 3 into one view.
 *
 * Deliberately an aggregate over the existing per-framework services rather
 * than a fourth source of truth: BRSR reuses getCompanyBrsrAnalytics (the
 * same function the company dashboard's ESG charts already render),
 * ISSB reuses buildIssbS1S2Metrics (the same function the ISSB PDF calls),
 * and Scope 3 relevance reuses resolveScope3Relevance. Nothing here
 * recomputes an emission or a ratio.
 */

// ---------------------------------------------------------------------------
// Completeness
// ---------------------------------------------------------------------------

export interface FrameworkCompleteness {
  /** null when the framework has no submitted disclosure for the period at all. */
  periodLabel: string | null;
  complete: number;
  total: number;
  /** Per-requirement detail, so the UI can show which attributes are outstanding. */
  requirements: { key: string; label: string; complete: boolean }[];
}

const EMPTY_COMPLETENESS = (requirements: { key: string; label: string }[]): FrameworkCompleteness => ({
  periodLabel: null,
  complete: 0,
  total: requirements.length,
  requirements: requirements.map((r) => ({ key: r.key, label: r.label, complete: false })),
});

/**
 * A requirement counts as complete company-wide only when *every* report
 * filed for that period satisfies it. Scoring it as "complete if any facility
 * filled it in" would let a single facility mask the rest — the point of the
 * strip is to show what's still outstanding, so the strict reading is the
 * useful one.
 */
const scoreCompleteness = <T extends object>(
  rows: T[],
  requirements: DisclosureRequirement<T>[],
  periodLabel: string | null,
): FrameworkCompleteness => {
  if (rows.length === 0 || periodLabel == null) return EMPTY_COMPLETENESS(requirements);

  const scored = requirements.map((requirement) => ({
    key: requirement.key,
    label: requirement.label,
    complete: rows.every((row) => isRequirementMet(row, requirement)),
  }));

  return {
    periodLabel,
    complete: scored.filter((r) => r.complete).length,
    total: requirements.length,
    requirements: scored,
  };
};

// ---------------------------------------------------------------------------
// ISSB summary
// ---------------------------------------------------------------------------

export interface IssbOverviewSummary {
  hasReports: boolean;
  periodLabel: string | null;
  facilitiesReporting: number;
  scope1Tco2e: number;
  scope2Tco2e: number;
  /** null when no report in the period disclosed a Scope 3 figure. */
  scope3Tco2e: number | null;
  totalTco2e: number;
  /** Earliest target year across the period's reports — the nearest commitment. */
  nearestTargetYear: number | null;
  baselineYear: number | null;
  baselineEmissionsTco2e: number | null;
  /** % change from the summed baseline to the summed current total. Negative = reduction. */
  changeFromBaselinePct: number | null;
}

type IssbReportWithFacility = IssbS1S2Report & { facility: Facility };

const buildIssbSummary = async (
  reports: IssbReportWithFacility[],
  company: { id: string; reportingFyStartMonth: number },
): Promise<{ summary: IssbOverviewSummary; periodReports: IssbReportWithFacility[]; periodLabel: string | null }> => {
  // reportingPeriod is "FY2025-26" — same-length zero-padded years sort
  // lexicographically in chronological order, matching the BRSR aggregation.
  const periodLabel = reports.map((r) => r.reportingPeriod).sort((a, b) => a.localeCompare(b)).at(-1) ?? null;
  const periodReports = periodLabel ? reports.filter((r) => r.reportingPeriod === periodLabel) : [];

  if (periodLabel == null || periodReports.length === 0) {
    return {
      periodLabel: null,
      periodReports: [],
      summary: {
        hasReports: false,
        periodLabel: null,
        facilitiesReporting: 0,
        scope1Tco2e: 0,
        scope2Tco2e: 0,
        scope3Tco2e: null,
        totalTco2e: 0,
        nearestTargetYear: null,
        baselineYear: null,
        baselineEmissionsTco2e: null,
        changeFromBaselinePct: null,
      },
    };
  }

  const metrics = await Promise.all(
    periodReports.map((report) => buildIssbS1S2Metrics(report, report.facility, company)),
  );

  let scope1 = 0;
  let scope2 = 0;
  let scope3 = 0;
  let anyScope3 = false;
  let baselineEmissions = 0;
  let anyBaseline = false;
  const targetYears: number[] = [];
  const baselineYears: number[] = [];

  for (const m of metrics) {
    scope1 += m.ghg.scope1Co2e;
    scope2 += m.ghg.scope2Co2e;
    if (m.ghg.scope3Co2e != null) {
      scope3 += m.ghg.scope3Co2e;
      anyScope3 = true;
    }
    if (m.targets.baselineEmissionsTco2e != null) {
      baselineEmissions += m.targets.baselineEmissionsTco2e;
      anyBaseline = true;
    }
    if (m.targets.targetYear != null) targetYears.push(m.targets.targetYear);
    if (m.targets.baselineYear != null) baselineYears.push(m.targets.baselineYear);
  }

  const totalTco2e = round(scope1 + scope2 + (anyScope3 ? scope3 : 0));

  return {
    periodLabel,
    periodReports,
    summary: {
      hasReports: true,
      periodLabel,
      facilitiesReporting: periodReports.length,
      scope1Tco2e: round(scope1),
      scope2Tco2e: round(scope2),
      scope3Tco2e: anyScope3 ? round(scope3) : null,
      totalTco2e,
      nearestTargetYear: targetYears.length > 0 ? Math.min(...targetYears) : null,
      baselineYear: baselineYears.length > 0 ? Math.min(...baselineYears) : null,
      baselineEmissionsTco2e: anyBaseline ? round(baselineEmissions) : null,
      changeFromBaselinePct:
        anyBaseline && baselineEmissions > 0 ? round(((totalTco2e - baselineEmissions) / baselineEmissions) * 100, 1) : null,
    },
  };
};

// ---------------------------------------------------------------------------
// Scope 3 breakdown
// ---------------------------------------------------------------------------

export interface Scope3CategoryBreakdownEntry {
  category: number;
  name: string;
  prismaCategory: string;
  relevance: string;
  tco2e: number;
  pct: number;
  entryCount: number;
}

export interface Scope3OverviewSummary {
  hasData: boolean;
  periodLabel: string | null;
  totalTco2e: number;
  categories: Scope3CategoryBreakdownEntry[];
  /** Completeness denominator: calculable categories this company must disclose. */
  mandatoryCalculableCount: number;
  mandatoryCalculableDisclosed: number;
}

const CALCULABLE_CATALOG = SCOPE3_CATEGORY_CATALOG.filter((c) => c.calculable);

const buildScope3Summary = (
  entries: Scope3Data[],
  relevanceByCategory: Map<string, string>,
): Scope3OverviewSummary => {
  const periodLabel = entries.map((e) => e.reportingPeriod).sort((a, b) => a.localeCompare(b)).at(-1) ?? null;
  const periodEntries = periodLabel ? entries.filter((e) => e.reportingPeriod === periodLabel) : [];

  const byCategory = new Map<string, { tco2e: number; entryCount: number }>();
  for (const entry of periodEntries) {
    const bucket = byCategory.get(entry.category) ?? { tco2e: 0, entryCount: 0 };
    bucket.tco2e += entry.calculatedEmissionsTco2e;
    bucket.entryCount += 1;
    byCategory.set(entry.category, bucket);
  }

  const totalTco2e = round(Array.from(byCategory.values()).reduce((sum, b) => sum + b.tco2e, 0));

  // The 5 calculable categories are always listed, disclosed or not — a zero
  // row is the honest answer to "have we covered business travel yet?", and
  // dropping it would make the breakdown look complete when it isn't.
  const categories: Scope3CategoryBreakdownEntry[] = CALCULABLE_CATALOG.map((catalogEntry) => {
    const bucket = byCategory.get(catalogEntry.prismaCategory);
    const tco2e = round(bucket?.tco2e ?? 0);
    return {
      category: catalogEntry.number,
      name: catalogEntry.name,
      prismaCategory: catalogEntry.prismaCategory,
      relevance: relevanceByCategory.get(catalogEntry.prismaCategory) ?? "OPTIONAL",
      tco2e,
      pct: totalTco2e > 0 ? round((tco2e / totalTco2e) * 100, 1) : 0,
      entryCount: bucket?.entryCount ?? 0,
    };
  });

  const mandatoryCalculable = categories.filter((c) => c.relevance === "MANDATORY");

  return {
    hasData: periodEntries.length > 0,
    periodLabel,
    totalTco2e,
    categories,
    mandatoryCalculableCount: mandatoryCalculable.length,
    mandatoryCalculableDisclosed: mandatoryCalculable.filter((c) => c.entryCount > 0).length,
  };
};

// ---------------------------------------------------------------------------
// Voluntary offsets
// ---------------------------------------------------------------------------

export interface OffsetsOverviewSummary extends OffsetTotals {
  facilitiesReporting: number;
  /**
   * Gross emissions this offset tonnage sits against, and where that figure
   * came from. Deliberately the ISSB total already computed above rather than
   * a new calculation: this module tracks purchases, it does not compute
   * emissions, and inventing a second company-wide total would give the page
   * two footprints that could disagree.
   *
   * null when no ISSB disclosure has been submitted — in that case the card
   * shows offsets alone rather than comparing against a number that isn't
   * there.
   */
  grossEmissionsTco2e: number | null;
  grossEmissionsSource: string;
  /** Gross minus offsets. Plain arithmetic on the two numbers above. */
  netAfterOffsetsTco2e: number | null;
  /** Offsets as a share of gross, %. null when there is nothing to compare to. */
  offsetCoveragePct: number | null;
}

export const buildOffsetsSummary = (
  purchases: { facilityId: string; status: string }[],
  totals: OffsetTotals,
  issb: IssbOverviewSummary,
): OffsetsOverviewSummary => {
  const grossEmissionsTco2e = issb.hasReports ? issb.totalTco2e : null;

  return {
    ...totals,
    facilitiesReporting: new Set(purchases.filter((p) => p.status === "SUBMITTED").map((p) => p.facilityId)).size,
    grossEmissionsTco2e,
    grossEmissionsSource: "ISSB IFRS S1/S2 disclosed Scope 1 + 2 + 3",
    netAfterOffsetsTco2e: grossEmissionsTco2e != null ? round(grossEmissionsTco2e - totals.totalTonnage) : null,
    offsetCoveragePct:
      grossEmissionsTco2e != null && grossEmissionsTco2e > 0
        ? round((totals.totalTonnage / grossEmissionsTco2e) * 100, 1)
        : null,
  };
};

// ---------------------------------------------------------------------------
// Live position
// ---------------------------------------------------------------------------

const fmtPeriodFor = (label: string) => label;

/**
 * Builds the Recent Activity / Live Position items for the ESG Overview from
 * data already loaded above. Every item is conditional — see the module
 * comment in livePosition.helpers.ts for why there are no fallbacks here.
 */
const buildEsgLivePosition = (options: {
  now: Date;
  brsr: CompanyBrsrAnalytics;
  scope3All: Scope3Data[];
  lastUpdate: { at: Date; label: string; detail: string } | null;
  // The Phase 2 rollups. These are the metrics that actually move between
  // reporting deadlines — a REC lands, a target slips, renewable share ticks
  // up — which is the gap this strip exists to fill. Before they were passed
  // in, the strip could only ever talk about BRSR water, waste, safety and
  // Scope 3, and the ten Phase 2 widgets sat in their own cards with no way
  // of announcing that anything had changed.
  circularity: CircularityRollup;
  energyMix: EnergyMixTrend;
  recCoverage: RecCoverage;
  targets: Awaited<ReturnType<typeof listCompanyTargets>>;
}): LivePositionItem[] => {
  const { now, brsr, scope3All, lastUpdate, circularity, energyMix, recCoverage, targets } = options;
  const items: LivePositionItem[] = [];

  if (lastUpdate) {
    items.push({
      id: "esg-last-update",
      kind: "DATA_UPDATE",
      label: lastUpdate.label,
      detail: lastUpdate.detail,
      timestamp: lastUpdate.at.toISOString(),
    });
  }

  // Reuses the centralized BRSR report-window logic rather than restating a
  // date — same helper the Generate Report modal is gated on.
  //
  // An *open* window is reported unconditionally: it's a state ("you can file
  // right now"), not a countdown, so the distance-to-close cap that keeps
  // far-off dates out of the strip doesn't apply. A window that hasn't opened
  // yet is a countdown, and does go through the cap.
  //
  // There is deliberately no matching GRI window item. isGriReportWindowOpen
  // currently delegates to the BRSR helper, so a GRI line would repeat these
  // exact dates and add nothing. The helpers are kept separate so the two can
  // diverge later; if they ever do, add the GRI window here.
  const brsrWindow = getBrsrReportPeriodStatus(now);
  if (brsrWindow.isOpen) {
    items.push({
      id: "esg-brsr-window",
      kind: "DEADLINE",
      label: `BRSR Core ${brsrWindow.displayLabel} report window is open`,
      detail: `Closes ${brsrWindow.windowEnd.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      })}`,
      timestamp: null,
      href: "/esg/brsr",
    });
  } else {
    const brsrDeadline = buildDeadlineItem({
      id: "esg-brsr-window",
      label: `BRSR Core ${brsrWindow.displayLabel} report window opens`,
      date: brsrWindow.windowStart,
      now,
      detailPrefix: "Opens",
      href: "/esg/brsr",
    });
    if (brsrDeadline) items.push(brsrDeadline);
  }

  const water = brsr.waterTrend;
  if (water.length >= 2) {
    const previous = water.at(-2)!;
    const current = water.at(-1)!;
    const item = buildTrendItem({
      id: "esg-water-consumption",
      metricLabel: "Water consumption",
      unitSuffix: " KL",
      previous: previous.consumedKl,
      current: current.consumedKl,
      previousPeriodLabel: fmtPeriodFor(previous.periodLabel),
      currentPeriodLabel: fmtPeriodFor(current.periodLabel),
      lowerIsBetter: true,
      href: "/esg/brsr",
    });
    if (item) items.push(item);
  }

  const waste = brsr.wasteTrend;
  if (waste.length >= 2) {
    const previous = waste.at(-2)!;
    const current = waste.at(-1)!;
    const item = buildTrendItem({
      id: "esg-waste-generated",
      metricLabel: "Waste generated",
      unitSuffix: " t",
      previous: previous.generatedTonnes,
      current: current.generatedTonnes,
      previousPeriodLabel: fmtPeriodFor(previous.periodLabel),
      currentPeriodLabel: fmtPeriodFor(current.periodLabel),
      lowerIsBetter: true,
      href: "/esg/brsr",
    });
    if (item) items.push(item);
  }

  // Already computed period-over-period by getCompanyBrsrAnalytics — read the
  // existing delta rather than recomputing it from a second source.
  if (brsr.safetyIncidentRate.hasData && brsr.safetyIncidentRate.deltaPct != null && brsr.safetyIncidentRate.deltaPct !== 0) {
    const { currentRate, previousRate, deltaPct, periodLabel } = brsr.safetyIncidentRate;
    items.push({
      id: "esg-safety-rate",
      kind: "TREND",
      label: `Safety incident rate ${deltaPct < 0 ? "down" : "up"} ${Math.abs(deltaPct)}%`,
      detail: `${periodLabel} — ${currentRate} vs ${previousRate} incidents per 1,000 employees`,
      timestamp: null,
      deltaPct,
      lowerIsBetter: true,
      href: "/esg/brsr",
    });
  }

  // Scope 3 total across the two most recent periods that have entries.
  const scope3ByPeriod = new Map<string, number>();
  for (const entry of scope3All) {
    scope3ByPeriod.set(entry.reportingPeriod, (scope3ByPeriod.get(entry.reportingPeriod) ?? 0) + entry.calculatedEmissionsTco2e);
  }
  const scope3Periods = Array.from(scope3ByPeriod.keys()).sort((a, b) => a.localeCompare(b));
  if (scope3Periods.length >= 2) {
    const previousPeriod = scope3Periods.at(-2)!;
    const currentPeriod = scope3Periods.at(-1)!;
    const item = buildTrendItem({
      id: "esg-scope3-total",
      metricLabel: "Scope 3 emissions",
      unitSuffix: " tCO2e",
      previous: round(scope3ByPeriod.get(previousPeriod)!),
      current: round(scope3ByPeriod.get(currentPeriod)!),
      previousPeriodLabel: previousPeriod,
      currentPeriodLabel: currentPeriod,
      lowerIsBetter: true,
      href: "/esg/brsr",
    });
    if (item) items.push(item);
  }

  // --- Phase 2 signals -----------------------------------------------------

  // Renewable share. energyMix already models its own move in points rather
  // than percent (see changePoints in energyMix.service.ts); this reads the
  // last two points directly so the strip and that field cannot diverge.
  if (energyMix.hasData && energyMix.points.length >= 2) {
    const previous = energyMix.points.at(-2)!;
    const current = energyMix.points.at(-1)!;
    const item = buildPointsTrendItem({
      id: "esg-renewable-share",
      metricLabel: "Renewable energy share",
      previousPct: previous.renewablePct,
      currentPct: current.renewablePct,
      previousPeriodLabel: previous.periodLabel,
      currentPeriodLabel: current.periodLabel,
      higherIsBetter: true,
      href: "/esg/overview",
    });
    if (item) items.push(item);
  }

  // REC coverage against grid electricity. coveragePct is null in a period
  // with no grid draw, and buildPointsTrendItem drops the item in that case
  // rather than reading the null as a zero.
  if (recCoverage.hasData && recCoverage.periods.length >= 2) {
    const previous = recCoverage.periods.at(-2)!;
    const current = recCoverage.periods.at(-1)!;
    const item = buildPointsTrendItem({
      id: "esg-rec-coverage",
      metricLabel: "REC coverage of grid electricity",
      previousPct: previous.coveragePct,
      currentPct: current.coveragePct,
      previousPeriodLabel: previous.periodLabel,
      currentPeriodLabel: current.periodLabel,
      higherIsBetter: true,
      href: "/esg/overview",
    });
    if (item) items.push(item);
  }

  // Circularity rate, period over period, computed from the BRSR waste trend.
  //
  // Gated on the rollup's own source being BRSR_CORE. GRI 306 and BRSR Core
  // do not define diversion the same way, so on a GRI-sourced company this
  // trend would be quoting a different rate from the one the Circularity card
  // shows two rows away on the same page. One number per page beats two that
  // disagree, so the item is simply omitted there.
  if (circularity.source === "BRSR_CORE" && brsr.wasteTrend.length >= 2) {
    const previous = brsr.wasteTrend.at(-2)!;
    const current = brsr.wasteTrend.at(-1)!;
    const rate = (p: { generatedTonnes: number; recoveredTonnes: number }) =>
      p.generatedTonnes > 0 ? round((p.recoveredTonnes / p.generatedTonnes) * 100, 1) : null;
    const item = buildPointsTrendItem({
      id: "esg-circularity-rate",
      metricLabel: "Circularity rate",
      previousPct: rate(previous),
      currentPct: rate(current),
      previousPeriodLabel: fmtPeriodFor(previous.periodLabel),
      currentPeriodLabel: fmtPeriodFor(current.periodLabel),
      higherIsBetter: true,
      href: "/esg/overview",
    });
    if (item) items.push(item);
  }

  // Reduction-target status. Only the two states worth interrupting someone
  // for: a target that has slipped, and one that has been met. ON_TRACK and
  // AHEAD are the expected case and would just be noise on every load, and
  // NOT_TRACKABLE means there is nothing to say.
  //
  // selfReportedNotice is non-negotiable wherever a status appears (see
  // CompanyTargetsSummary) — carried here in short form so the strip cannot
  // imply Intellocarbon validated the target.
  for (const progress of targets.progress) {
    if (progress.status !== "BEHIND" && progress.status !== "ACHIEVED") continue;
    const target = targets.targets.find((t) => t.id === progress.targetId);
    if (!target) continue;

    const variance =
      progress.varianceTco2e != null
        ? `${Math.abs(round(progress.varianceTco2e)).toLocaleString("en-IN")} tCO2e ${
            progress.varianceTco2e > 0 ? "above" : "below"
          } the allowed path`
        : progress.reason;

    items.push({
      id: `esg-target-${progress.targetId}`,
      kind: "STATUS",
      label:
        progress.status === "ACHIEVED"
          ? `Reduction target for ${target.targetYear} achieved`
          : `Reduction target for ${target.targetYear} is behind`,
      detail: `${variance}. Self-reported target, not validated by Intellocarbon.`,
      timestamp: null,
      href: "/esg/overview",
    });
  }

  return sortLivePosition(items);
};

// ---------------------------------------------------------------------------
// GRI summary
// ---------------------------------------------------------------------------

// Read off the registry rather than hardcoded, so it cannot drift from what
// the accordance evaluation actually counts.
const GRI_UNIVERSAL_TOTAL = GRI_UNIVERSAL_DISCLOSURES.length;

/**
 * GRI rolled up across facilities.
 *
 * The hard part is that GRI has no company-level "X of Y disclosures" figure
 * to report. Which Topic Standards a facility reports is decided by its own
 * materiality assessment, so two facilities can both be fully compliant while
 * covering entirely different topics — summing their topic counts would
 * produce a number that means nothing, and averaging them would imply the
 * topics are interchangeable.
 *
 * So this reports the union and the intersection instead: how many distinct
 * topics are material somewhere, and how many are material everywhere. Those
 * two together describe the real shape of a multi-facility GRI programme
 * without inventing a total. The per-topic breakdown carries the "N of M
 * facilities" detail behind them.
 */
export interface GriTopicSpread {
  topicCode: string;
  label: string;
  title: string;
  /** How many reporting facilities judged this topic material. */
  facilities: number;
}

export interface GriOverviewSummary {
  hasReports: boolean;
  periodLabel: string | null;
  facilitiesReporting: number;
  /** Facilities whose report meets every GRI 1 requirement and can claim "in accordance". */
  facilitiesInAccordance: number;
  /** Distinct Topic Standards material at one or more facility — a union, never a sum. */
  distinctMaterialTopics: number;
  /** Topic Standards material at every reporting facility — the intersection. */
  topicsMaterialEverywhere: number;
  /** Ordered by how widely each topic was judged material. */
  topicSpread: GriTopicSpread[];
  /** Worst case across facilities, so the strip shows what is still outstanding somewhere. */
  universalDisclosuresReported: number;
  universalDisclosuresTotal: number;
  /** Deduped across facilities, capped for display. */
  outstandingRequirements: string[];
}

const EMPTY_GRI_SUMMARY: GriOverviewSummary = {
  hasReports: false,
  periodLabel: null,
  facilitiesReporting: 0,
  facilitiesInAccordance: 0,
  distinctMaterialTopics: 0,
  topicsMaterialEverywhere: 0,
  topicSpread: [],
  universalDisclosuresReported: 0,
  universalDisclosuresTotal: GRI_UNIVERSAL_TOTAL,
  outstandingRequirements: [],
};

/**
 * Scores GRI against GRI 1's reporting requirements rather than against a
 * field checklist — see GRI_REPORTING_REQUIREMENTS for why a field checklist
 * cannot work here.
 *
 * A requirement counts as complete company-wide only when every reporting
 * facility satisfies it, matching scoreCompleteness's strict reading: the
 * point of the strip is to surface what is still outstanding, and one
 * compliant facility should not mask a non-compliant one.
 */
const scoreGriCompleteness = (
  evaluations: GriAccordanceEvaluation[],
  periodLabel: string | null,
): FrameworkCompleteness => {
  if (evaluations.length === 0 || periodLabel == null) return EMPTY_COMPLETENESS(GRI_REPORTING_REQUIREMENTS);

  const every = (predicate: (e: GriAccordanceEvaluation) => boolean) => evaluations.every(predicate);

  const met: Record<string, boolean> = {
    materiality: every((e) => e.materialityAssessmentComplete),
    // An unexplained exclusion is a GRI 3-2 failure as much as having no
    // material topic at all — the standard requires the determination to be
    // stated, not merely made.
    materialTopics: every((e) => e.materialTopicCount > 0 && e.unexplainedExclusions.length === 0),
    managementApproach: every((e) => e.topics.filter((t) => t.isMaterial).every((t) => t.managementApproachComplete)),
    universal: every((e) => e.missingUniversalDisclosures.length === 0),
    topicData: every((e) => e.topics.filter((t) => t.isMaterial).every((t) => t.hasAnyData)),
  };

  const scored = GRI_REPORTING_REQUIREMENTS.map((requirement) => ({
    key: requirement.key,
    label: requirement.label,
    complete: met[requirement.key] ?? false,
  }));

  return {
    periodLabel,
    complete: scored.filter((r) => r.complete).length,
    total: GRI_REPORTING_REQUIREMENTS.length,
    requirements: scored,
  };
};

const buildGriSummary = async (
  reports: GriReportWithRelations[],
  company: { reportingFyStartMonth: number },
): Promise<{ summary: GriOverviewSummary; completeness: FrameworkCompleteness }> => {
  // Same latest-period selection as BRSR and ISSB: "FY2025-26" sorts
  // lexicographically in chronological order.
  const periodLabel = reports.map((r) => r.reportingPeriod).sort((a, b) => a.localeCompare(b)).at(-1) ?? null;
  const periodReports = periodLabel ? reports.filter((r) => r.reportingPeriod === periodLabel) : [];

  if (periodLabel == null || periodReports.length === 0) {
    return { summary: EMPTY_GRI_SUMMARY, completeness: EMPTY_COMPLETENESS(GRI_REPORTING_REQUIREMENTS) };
  }

  const metrics = await Promise.all(
    periodReports.map((report) => buildGriMetrics(report, { id: report.facilityId }, company)),
  );
  const evaluations = metrics.map((m) => m.accordance);

  // Union and intersection across facilities, never a sum.
  const facilityCountByTopic = new Map<string, number>();
  for (const report of periodReports) {
    for (const topic of report.materialTopics) {
      if (!topic.isMaterial) continue;
      facilityCountByTopic.set(topic.topicCode, (facilityCountByTopic.get(topic.topicCode) ?? 0) + 1);
    }
  }

  const topicSpread: GriTopicSpread[] = Array.from(facilityCountByTopic.entries())
    .map(([topicCode, facilities]) => {
      const standard = getGriTopic(topicCode);
      return {
        topicCode,
        label: standard?.label ?? topicCode,
        title: standard?.title ?? topicCode,
        facilities,
      };
    })
    // Ties break on code so the ordering is stable between loads.
    .sort((a, b) => b.facilities - a.facilities || a.topicCode.localeCompare(b.topicCode));

  // Deduped: the same requirement outstanding at three facilities is one thing
  // to fix, not three.
  const outstandingRequirements = Array.from(new Set(evaluations.flatMap((e) => e.blockers))).slice(0, 8);

  return {
    summary: {
      hasReports: true,
      periodLabel,
      facilitiesReporting: periodReports.length,
      facilitiesInAccordance: evaluations.filter((e) => e.inAccordance).length,
      distinctMaterialTopics: facilityCountByTopic.size,
      topicsMaterialEverywhere: topicSpread.filter((t) => t.facilities === periodReports.length).length,
      topicSpread,
      // The weakest facility, not the average — the strip exists to show what
      // is outstanding somewhere.
      universalDisclosuresReported: Math.min(...evaluations.map((e) => e.universalDisclosuresReported)),
      universalDisclosuresTotal: evaluations[0]?.universalDisclosuresTotal ?? GRI_UNIVERSAL_TOTAL,
      outstandingRequirements,
    },
    completeness: scoreGriCompleteness(evaluations, periodLabel),
  };
};

// ---------------------------------------------------------------------------
// CSRD / CDP completeness
// ---------------------------------------------------------------------------

/**
 * Same shape as scoreGriCompleteness, and for the same reason: CSRD is
 * materiality-gated, so the fixed thing to score is the frame around the
 * assessment rather than a set of topics every company must report.
 *
 * `every` across the period's facilities, exactly as GRI does — the strip
 * exists to show what is still outstanding somewhere, not to average it away.
 */
const scoreCsrdCompleteness = (
  evaluations: CsrdConformityEvaluation[],
  periodLabel: string | null,
): FrameworkCompleteness => {
  if (evaluations.length === 0 || periodLabel == null) return EMPTY_COMPLETENESS(CSRD_REPORTING_REQUIREMENTS);

  const every = (predicate: (e: CsrdConformityEvaluation) => boolean) => evaluations.every(predicate);
  const materialStandards = (e: CsrdConformityEvaluation) => e.standards.filter((standard) => standard.isMaterial);

  const met: Record<string, boolean> = {
    materiality: every((e) => e.materialityAssessmentComplete),
    esrs2: every((e) => e.missingGeneralDisclosures.length === 0),
    // An unexplained exclusion fails this the same way having no material
    // standard at all does — ESRS requires the determination to be stated,
    // not merely made. Mirrors GRI's materialTopics rule.
    materialTopics: every((e) => e.materialStandardCount > 0 && e.unexplainedExclusions.length === 0),
    minimumDisclosures: every((e) => materialStandards(e).every((standard) => standard.minimumDisclosuresComplete)),
    standardData: every((e) => materialStandards(e).every((standard) => standard.hasAnyData)),
  };

  const scored = CSRD_REPORTING_REQUIREMENTS.map((requirement) => ({
    key: requirement.key,
    label: requirement.label,
    complete: met[requirement.key] ?? false,
  }));

  return {
    periodLabel,
    complete: scored.filter((r) => r.complete).length,
    total: scored.length,
    requirements: scored,
  };
};

/**
 * One requirement per required CDP module, complete when every question in it
 * is answered at every facility reporting this period.
 *
 * Reads assessCdpMaturity's per-module answered/total and ignores its bands
 * entirely. The bands are a readiness indicator, not a CDP score, and turning
 * one into a completeness tick would quietly restate it as a grade.
 */
const scoreCdpCompleteness = (
  assessments: CdpMaturityAssessment[],
  periodLabel: string | null,
): FrameworkCompleteness => {
  if (assessments.length === 0 || periodLabel == null) return EMPTY_COMPLETENESS(CDP_REPORTING_REQUIREMENTS);

  const scored = CDP_REPORTING_REQUIREMENTS.map((requirement) => ({
    key: requirement.key,
    label: requirement.label,
    complete: assessments.every((assessment) => {
      const module = assessment.modules.find((m) => m.moduleCode === requirement.key);
      // A module missing from the assessment is not evidence of completeness.
      return module != null && module.total > 0 && module.answered === module.total;
    }),
  }));

  return {
    periodLabel,
    complete: scored.filter((r) => r.complete).length,
    total: scored.length,
    requirements: scored,
  };
};

/** Latest submitted period, then that period's reports — the selection BRSR, ISSB and GRI all use. */
const latestPeriodReports = <T extends { reportingPeriod: string }>(reports: T[]) => {
  const periodLabel = reports.map((r) => r.reportingPeriod).sort((a, b) => a.localeCompare(b)).at(-1) ?? null;
  return { periodLabel, periodReports: periodLabel ? reports.filter((r) => r.reportingPeriod === periodLabel) : [] };
};

// ---------------------------------------------------------------------------
// Product footprint
// ---------------------------------------------------------------------------

/**
 * Per-SKU allocation for every facility, on the latest period any of them has
 * submitted products for.
 *
 * One GHG rollup per facility, not per SKU — the allocation divides a site's
 * total Scope 1 and 2, so the emissions query is per site regardless of how
 * many products it lists. Facilities with no products for the period are
 * skipped before the rollup runs, so a company that uses the module at one
 * site out of twenty pays for one query, not twenty.
 */
const buildCompanyFootprint = async (
  facilities: { id: string; name: string }[],
  company: { reportingFyStartMonth: number },
): Promise<CompanyProductFootprint> => {
  const facilityIds = facilities.map((f) => f.id);
  if (facilityIds.length === 0) return buildCompanyProductFootprint(null, []);

  const skus = await prisma.productSku.findMany({
    where: { facilityId: { in: facilityIds }, status: "SUBMITTED" },
    orderBy: { name: "asc" },
  });

  // Same latest-period selection as every other framework here.
  const periodLabel = skus.map((s) => s.reportingPeriod).sort((a, b) => a.localeCompare(b)).at(-1) ?? null;
  if (periodLabel == null) return buildCompanyProductFootprint(null, []);

  const periodSkus = skus.filter((s) => s.reportingPeriod === periodLabel);
  const byFacility = new Map<string, typeof periodSkus>();
  for (const sku of periodSkus) {
    byFacility.set(sku.facilityId, [...(byFacility.get(sku.facilityId) ?? []), sku]);
  }

  const window = resolveFyWindow(periodLabel, company.reportingFyStartMonth);
  const perFacility = await Promise.all(
    facilities
      .filter((facility) => byFacility.has(facility.id))
      .map(async (facility) => {
        const ghg = await rollupFacilityGhgForFy(facility.id, window);
        return {
          facilityId: facility.id,
          facilityName: facility.name,
          allocation: buildProductFootprint(
            periodLabel,
            ghg.totalCo2e,
            (byFacility.get(facility.id) ?? []).map((s) => ({
              id: s.id,
              name: s.name,
              skuCode: s.skuCode,
              productionQuantity: s.productionQuantity,
              unit: s.unit,
            })),
            ghg.productionQuantityT > 0 ? ghg.productionQuantityT : null,
            "tonnes",
          ),
        };
      }),
  );

  return buildCompanyProductFootprint(periodLabel, perFacility);
};

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export interface EsgOverview {
  companyName: string;
  facilityCount: number;
  currentFyLabel: string;
  brsr: CompanyBrsrAnalytics;
  issb: IssbOverviewSummary;
  gri: GriOverviewSummary;
  scope3: Scope3OverviewSummary;
  water: WaterFootprintRollup;
  circularity: CircularityRollup;
  energyMix: EnergyMixTrend;
  targets: Awaited<ReturnType<typeof listCompanyTargets>>;
  recCoverage: RecCoverage;
  governance: GovernanceSummary;
  suppliers: SupplierScorecard;
  benchmarks: BenchmarkSet;
  trajectory: NetZeroTrajectory;
  ecovadis: EcovadisReadiness;
  productFootprint: CompanyProductFootprint;
  offsets: OffsetsOverviewSummary;
  completeness: {
    brsr: FrameworkCompleteness;
    issb: FrameworkCompleteness;
    gri: FrameworkCompleteness;
    csrd: FrameworkCompleteness;
    cdp: FrameworkCompleteness;
    scope3: FrameworkCompleteness;
  };
  livePosition: LivePositionItem[];
}

export const getEsgOverview = async (userId: string, now: Date = new Date()): Promise<EsgOverview> => {
  const company = await requireMyCompany(userId);
  await requireEsgBundleAccess(company.id);

  const facilities = await prisma.facility.findMany({
    where: { companyId: company.id },
    orderBy: { createdAt: "asc" },
  });
  const facilityIds = facilities.map((f) => f.id);
  const facilityNameById = new Map(facilities.map((f) => [f.id, f.name]));

  const [brsr, brsrRows, issbReports, griReports, scope3All, relevance, waterRows, offsetPurchases, csrdReports, cdpReports] = await Promise.all([
    getCompanyBrsrAnalytics(facilities, company),
    facilityIds.length === 0
      ? Promise.resolve([])
      : prisma.brsrCoreReport.findMany({
          where: { facilityId: { in: facilityIds }, status: "SUBMITTED" },
          include: { facility: { select: { name: true } } },
        }),
    facilityIds.length === 0
      ? Promise.resolve([])
      : prisma.issbS1S2Report.findMany({
          where: { facilityId: { in: facilityIds }, status: "SUBMITTED" },
          include: { facility: true },
        }),
    // SUBMITTED only, like every other framework here. The full relation set
    // is needed because GRI completeness is evaluated from the materiality
    // assessment and per-topic rows, not from columns on the report itself.
    facilityIds.length === 0
      ? Promise.resolve([])
      : prisma.griReport.findMany({
          where: { facilityId: { in: facilityIds }, status: "SUBMITTED" },
          include: GRI_REPORT_INCLUDE,
        }),
    facilityIds.length === 0
      ? Promise.resolve([])
      : prisma.scope3Data.findMany({
          where: { facilityId: { in: facilityIds }, status: "SUBMITTED" },
        }),
    resolveScope3Relevance(company),
    // SUBMITTED only, matching every other framework here — a draft water
    // inventory is not a disclosure. Reuses the ActivityData rows that already
    // back the GHG numbers, so water and emissions can never describe
    // different periods or production volumes.
    facilityIds.length === 0
      ? Promise.resolve([])
      : prisma.activityData.findMany({
          where: { facilityId: { in: facilityIds }, status: "SUBMITTED" },
          // periodStart and the three energy columns are here for the energy
          // mix trend, which shares these rows rather than issuing a second
          // query over the same table.
          select: {
            facilityId: true,
            productionQuantityT: true,
            waterEntries: true,
            periodStart: true,
            gridElectricityMwh: true,
            renewableElectricityMwh: true,
            steamImportedGj: true,
          },
        }),
    // Every purchase, draft included — summariseOffsets filters to SUBMITTED,
    // so the same rule applies here as on the facility page.
    facilityIds.length === 0
      ? Promise.resolve([])
      : prisma.voluntaryOffsetPurchase.findMany({ where: { facilityId: { in: facilityIds } } }),
    // CSRD and CDP, on the same SUBMITTED-only terms as every framework above.
    // Both need their full relation sets for the same reason GRI does: neither
    // is scored from columns on the report row. CSRD conformity is evaluated
    // from the materiality assessment and the per-standard rows, and CDP
    // completeness from the per-module answer rows.
    facilityIds.length === 0
      ? Promise.resolve([])
      : prisma.csrdReport.findMany({
          where: { facilityId: { in: facilityIds }, status: "SUBMITTED" },
          include: CSRD_REPORT_INCLUDE,
        }),
    facilityIds.length === 0
      ? Promise.resolve([])
      : prisma.cdpReport.findMany({
          where: { facilityId: { in: facilityIds }, status: "SUBMITTED" },
          include: CDP_REPORT_INCLUDE,
        }),
  ]);

  const { summary: issbSummary, periodReports: issbPeriodReports, periodLabel: issbPeriod } = await buildIssbSummary(
    issbReports,
    company,
  );

  const { summary: griSummary, completeness: griCompleteness } = await buildGriSummary(griReports, company);

  // CSRD and CDP completeness. Each is evaluated on its own latest submitted
  // period, for the same reason BRSR and ISSB are: a company can be a year
  // ahead on one framework and behind on another, and flattening them to a
  // single period would misreport both.
  const productFootprint = await buildCompanyFootprint(facilities, company);

  const { periodLabel: csrdPeriod, periodReports: csrdPeriodReports } = latestPeriodReports(csrdReports);
  const csrdConformity = await Promise.all(
    csrdPeriodReports.map(async (report) =>
      (await buildCsrdMetrics(report, { id: report.facilityId }, company)).conformity,
    ),
  );

  const { periodLabel: cdpPeriod, periodReports: cdpPeriodReports } = latestPeriodReports(cdpReports);
  const cdpMaturity = await Promise.all(
    cdpPeriodReports.map(async (report) =>
      assessCdpMaturity(report, await buildCdpMetrics(report, { id: report.facilityId }, company)),
    ),
  );

  const relevanceByCategory = new Map(relevance.map((r) => [r.prismaCategory, r.relevance as string]));
  const scope3 = buildScope3Summary(scope3All, relevanceByCategory);

  // BRSR completeness is scored on its own latest submitted period, which
  // need not be the same FY as ISSB's — a company can be a year ahead on one
  // framework and behind on another, and flattening them to a single period
  // would misreport both.
  const brsrPeriod = brsrRows.map((r) => r.reportingPeriod).sort((a, b) => a.localeCompare(b)).at(-1) ?? null;
  const brsrPeriodRows = brsrPeriod ? brsrRows.filter((r) => r.reportingPeriod === brsrPeriod) : [];

  // Scope 3 has no per-field checklist — its "requirements" are the calculable
  // categories the company's sector makes mandatory, each met once at least
  // one submitted entry exists for it in the latest period.
  const scope3Requirements = scope3.categories
    .filter((c) => c.relevance === "MANDATORY")
    .map((c) => ({ key: c.prismaCategory, label: `Category ${c.category} — ${c.name}`, complete: c.entryCount > 0 }));

  const lastUpdateCandidates: { at: Date; label: string; detail: string }[] = [
    ...brsrRows.map((r) => ({
      at: r.updatedAt,
      label: "BRSR Core disclosure updated",
      detail: `${r.facility.name} — ${r.reportingPeriod}`,
    })),
    ...issbReports.map((r) => ({
      at: r.updatedAt,
      label: "ISSB IFRS S1/S2 disclosure updated",
      detail: `${r.facility.name} — ${r.reportingPeriod}`,
    })),
    // GRI reports are loaded without a facility join (GRI_REPORT_INCLUDE
    // carries the disclosure relations, not the facility), so the name comes
    // from the facilities array already in scope rather than a second query.
    ...griReports.map((r) => ({
      at: r.updatedAt,
      label: "GRI Standards report updated",
      detail: `${facilityNameById.get(r.facilityId) ?? "Facility"} — ${r.reportingPeriod}`,
    })),
    ...scope3All.map((e) => ({
      at: e.updatedAt,
      label: "Scope 3 entry updated",
      detail: `Category ${e.category.replace(/^CAT(\d+)_.*$/, "$1")} — ${e.reportingPeriod}`,
    })),
  ];
  const lastUpdate = lastUpdateCandidates.sort((a, b) => b.at.getTime() - a.at.getTime())[0] ?? null;

  // Waste circularity. Built from the GRI 306 rows already loaded above and
  // the BRSR waste columns, so it adds no query — see wasteCircularity for why
  // the two sources are kept apart rather than blended.
  const circularity = buildCircularityRollup(
    griReports
      .filter((r) => r.wasteDisclosure != null)
      .map((r) => ({ ...r.wasteDisclosure!, reportingPeriod: r.reportingPeriod })),
    brsrRows.map((r) => ({
      reportingPeriod: r.reportingPeriod,
      wasteGeneratedTonnes: r.wasteGeneratedTonnes,
      wasteRecoveredTonnes: r.wasteRecoveredTonnes,
    })),
  );

  // Energy mix trend. BRSR carries the total-energy split; the activity rows
  // already loaded for the water rollup are the fallback basis. See
  // energyMix.service for why the two are never mixed within one trend.
  const energyMix = buildEnergyMixTrend(
    brsrRows.map((r) => ({
      reportingPeriod: r.reportingPeriod,
      renewableEnergyConsumptionGj: r.renewableEnergyConsumptionGj,
      nonRenewableEnergyConsumptionGj: r.nonRenewableEnergyConsumptionGj,
    })),
    waterRows.map((r) => ({
      periodStart: r.periodStart,
      gridElectricityMwh: r.gridElectricityMwh,
      renewableElectricityMwh: r.renewableElectricityMwh,
      steamImportedGj: r.steamImportedGj,
    })),
  );

  // Self-reported reduction targets and progress against them. See
  // companyTarget.service — this is not an SBTi tool and says so.
  const targets = await listCompanyTargets(company.id, facilityIds);

  // REC coverage. SUBMITTED certificates only, matching how offsets are
  // treated, against the electricity rows already loaded above.
  const recPurchases = await prisma.recPurchase.findMany({
    where: { companyId: company.id, status: "SUBMITTED" },
    select: { vintageYear: true, quantityMwh: true },
  });
  // Governance, gathered from whichever disclosures exist. CSRD and CDP are
  // queried here rather than loaded with the frameworks above because only
  // these three rows are needed, not the full statements.
  const [latestCsrd, latestCdp] = await Promise.all([
    prisma.csrdReport.findFirst({
      where: { companyId: company.id, status: "SUBMITTED" },
      orderBy: { reportingPeriod: "desc" },
      select: { generalDisclosures: true, businessConductDisclosure: true },
    }),
    prisma.cdpReport.findFirst({
      where: { companyId: company.id, status: "SUBMITTED" },
      orderBy: { reportingPeriod: "desc" },
      select: { governance: true },
    }),
  ]);

  const latestGriUniversal =
    griReports
      .slice()
      .sort((a, b) => a.reportingPeriod.localeCompare(b.reportingPeriod))
      .at(-1)?.universalDisclosures ?? null;

  const governance = buildGovernanceSummary({
    gri: latestGriUniversal as Record<string, unknown> | null,
    esrs2: latestCsrd?.generalDisclosures as Record<string, unknown> | null,
    esrsG1: latestCsrd?.businessConductDisclosure as Record<string, unknown> | null,
    cdp: latestCdp?.governance as Record<string, unknown> | null,
  });

  // Supplier scorecard. The GRI 308/414 aggregates come from the reports
  // already loaded; the named supplier rows are their own table.
  const supplierRows = await prisma.supplier.findMany({
    where: { companyId: company.id, status: "SUBMITTED" },
  });
  const suppliers = buildSupplierScorecard(
    supplierRows,
    griReports.map((r) => ({
      reportingPeriod: r.reportingPeriod,
      env: r.supplierEnvDisclosure
        ? {
            newSuppliersScreenedPct: r.supplierEnvDisclosure.newSuppliersScreenedPct,
            suppliersAssessedCount: r.supplierEnvDisclosure.suppliersAssessedCount,
            suppliersWithNegativeImpactsCount: r.supplierEnvDisclosure.suppliersWithNegativeImpactsCount,
          }
        : null,
      social: r.supplierSocialDisclosure
        ? { newSuppliersScreenedPct: r.supplierSocialDisclosure.newSuppliersScreenedPct }
        : null,
    })),
  );

  // Sector benchmark. Gazetted CCTS notifications are the only public source
  // with real provenance here — see sectorBenchmark.service for why the EU
  // default SEE values were rejected. Expect NO_SECTOR_DATA in most cases;
  // that is the honest answer, not a gap.
  const [notifiedEntities, intensityRows] = await Promise.all([
    prisma.cctsObligatedEntity.findMany({
      where: { baselineIntensity: { not: null } },
      select: { sector: true, baselineIntensity: true, status: true },
    }),
    facilityIds.length === 0
      ? Promise.resolve([])
      : prisma.activityData.findMany({
          where: { facilityId: { in: facilityIds }, status: "SUBMITTED" },
          select: { productionQuantityT: true, calculationResult: { select: { ghgIntensityCcts: true } } },
        }),
  ]);

  // Production-weighted, so a small facility does not carry the same weight as
  // a large one in the company's own figure.
  const weighted = intensityRows.filter((r) => r.calculationResult?.ghgIntensityCcts != null && (r.productionQuantityT ?? 0) > 0);
  const totalProduction = weighted.reduce((sum, r) => sum + (r.productionQuantityT ?? 0), 0);
  const companyIntensity =
    totalProduction > 0
      ? weighted.reduce((sum, r) => sum + r.calculationResult!.ghgIntensityCcts! * (r.productionQuantityT ?? 0), 0) / totalProduction
      : null;

  const benchmarks = buildBenchmarkSet(company.sector, companyIntensity, notifiedEntities);

  // Emissions history against the stated target path. Reuses the targets and
  // annual actuals already resolved above — no extra query. The actual series
  // is never projected forward; see netZeroTrajectory.service.
  const trajectory = buildNetZeroTrajectory(targets.targets, targets.actuals);

  const recCoverage = buildRecCoverage(
    recPurchases,
    waterRows.map((r) => ({
      periodStart: r.periodStart,
      gridElectricityMwh: r.gridElectricityMwh,
      renewableElectricityMwh: r.renewableElectricityMwh,
    })),
  );


  // EcoVadis readiness. Every input is something already assembled above —
  // this collects nothing new and predicts no score. See
  // ecovadisReadiness.service.
  const griUniversalRow = latestGriUniversal as Record<string, unknown> | null;
  const brsrLatest = brsrRows
    .slice()
    .sort((a, b) => a.reportingPeriod.localeCompare(b.reportingPeriod))
    .at(-1);
  const governancePolicy = (key: string) =>
    governance.policies.find((p) => p.key === key)?.state === "DISCLOSED";

  const ecovadis = buildEcovadisReadiness({
    hasScope12: (brsr.hasReports || waterRows.length > 0) && energyMix.hasData,
    hasScope3: scope3All.length > 0,
    hasEnergySplit: energyMix.hasData,
    hasRenewableProcurement: recCoverage.totalRecsMwh > 0,
    hasWaterData: rollUpWaterFootprints(waterRows).hasData,
    hasWasteData: circularity.hasData,
    hasEmissionsTarget: targets.targets.length > 0,

    hasEmployeeHeadcount: griUniversalRow?.employeesTotal != null || brsrLatest?.employeeCountTotal != null,
    hasGenderDiversity: brsrLatest?.womenInWorkforcePct != null,
    hasSafetyIncidents: brsrLatest?.safetyIncidentsCount != null,
    hasHumanRightsPolicy: governancePolicy("humanRights"),
    hasCollectiveBargaining: griUniversalRow?.collectiveBargainingCoveragePct != null,

    hasCodeOfConduct: governancePolicy("conductPolicies"),
    hasAntiCorruption: governancePolicy("antiCorruption"),
    hasWhistleblowing: governancePolicy("whistleblowing"),
    hasConflictsOfInterest: governancePolicy("conflictsOfInterest"),
    hasBoardOversight: governancePolicy("boardClimateOversight"),

    hasSupplierList: suppliers.supplierCount > 0,
    hasSupplierDisclosures: suppliers.withDisclosureCount > 0,
    hasSupplierScreening: suppliers.gri.hasData,
    hasSupplierRiskAssessment: suppliers.riskBreakdown.LOW + suppliers.riskBreakdown.MEDIUM + suppliers.riskBreakdown.HIGH > 0,
  });

  return {
    companyName: company.name,
    facilityCount: facilities.length,
    currentFyLabel: currentBrsrFyLabel(now),
    brsr,
    issb: issbSummary,
    gri: griSummary,
    scope3,
    water: rollUpWaterFootprints(waterRows),
    circularity,
    energyMix,
    targets,
    recCoverage,
    governance,
    suppliers,
    benchmarks,
    trajectory,
    ecovadis,
    productFootprint,
    offsets: buildOffsetsSummary(offsetPurchases, summariseOffsets(offsetPurchases), issbSummary),
    completeness: {
      brsr: scoreCompleteness(brsrPeriodRows, BRSR_CORE_ATTRIBUTES, brsrPeriod),
      issb: scoreCompleteness(issbPeriodReports, ISSB_PILLARS, issbPeriod),
      gri: griCompleteness,
      csrd: scoreCsrdCompleteness(csrdConformity, csrdPeriod),
      cdp: scoreCdpCompleteness(cdpMaturity, cdpPeriod),
      scope3: {
        periodLabel: scope3.periodLabel,
        complete: scope3Requirements.filter((r) => r.complete).length,
        total: scope3Requirements.length,
        requirements: scope3Requirements,
      },
    },
    livePosition: buildEsgLivePosition({ now, brsr, scope3All, lastUpdate, circularity, energyMix, recCoverage, targets }),
  };
};
