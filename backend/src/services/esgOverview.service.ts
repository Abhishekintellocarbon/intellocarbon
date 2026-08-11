import type { Facility, IssbS1S2Report, Scope3Data } from "@prisma/client";
import { prisma } from "../config/prisma";
import { requireMyCompany } from "./company.service";
import { requireEsgBundleAccess } from "./esgBundleAccess.service";
import { getCompanyBrsrAnalytics, type CompanyBrsrAnalytics } from "./companyDashboard.service";
import { resolveScope3Relevance } from "./scope3Relevance.service";
import { buildIssbS1S2Metrics } from "./issbCalculation.service";
import { SCOPE3_CATEGORY_CATALOG } from "../data/scope3Categories";
import {
  BRSR_CORE_ATTRIBUTES,
  ISSB_PILLARS,
  isRequirementMet,
  type DisclosureRequirement,
} from "../data/esgDisclosureChecklist";
import { getBrsrReportPeriodStatus, currentBrsrFyLabel } from "../data/complianceDeadlines";
import { round } from "./dashboardShared.helpers";
import { rollUpWaterFootprints, type WaterFootprintRollup } from "./waterCalculation.service";
import {
  buildDeadlineItem,
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
  company: { reportingFyStartMonth: number },
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
}): LivePositionItem[] => {
  const { now, brsr, scope3All, lastUpdate } = options;
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

  return sortLivePosition(items);
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
  scope3: Scope3OverviewSummary;
  water: WaterFootprintRollup;
  completeness: {
    brsr: FrameworkCompleteness;
    issb: FrameworkCompleteness;
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

  const [brsr, brsrRows, issbReports, scope3All, relevance, waterRows] = await Promise.all([
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
          select: { facilityId: true, productionQuantityT: true, waterEntries: true },
        }),
  ]);

  const { summary: issbSummary, periodReports: issbPeriodReports, periodLabel: issbPeriod } = await buildIssbSummary(
    issbReports,
    company,
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
    ...scope3All.map((e) => ({
      at: e.updatedAt,
      label: "Scope 3 entry updated",
      detail: `Category ${e.category.replace(/^CAT(\d+)_.*$/, "$1")} — ${e.reportingPeriod}`,
    })),
  ];
  const lastUpdate = lastUpdateCandidates.sort((a, b) => b.at.getTime() - a.at.getTime())[0] ?? null;

  return {
    companyName: company.name,
    facilityCount: facilities.length,
    currentFyLabel: currentBrsrFyLabel(now),
    brsr,
    issb: issbSummary,
    scope3,
    water: rollUpWaterFootprints(waterRows),
    completeness: {
      brsr: scoreCompleteness(brsrPeriodRows, BRSR_CORE_ATTRIBUTES, brsrPeriod),
      issb: scoreCompleteness(issbPeriodReports, ISSB_PILLARS, issbPeriod),
      scope3: {
        periodLabel: scope3.periodLabel,
        complete: scope3Requirements.filter((r) => r.complete).length,
        total: scope3Requirements.length,
        requirements: scope3Requirements,
      },
    },
    livePosition: buildEsgLivePosition({ now, brsr, scope3All, lastUpdate }),
  };
};
