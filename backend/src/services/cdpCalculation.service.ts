import { prisma } from "../config/prisma";
import type { Company, Facility, Prisma, Scope3Category } from "@prisma/client";
import { resolveFyWindow as resolveBrsrFyWindow, type BrsrFyWindow } from "./brsrCalculation.service";
import { buildWaterFootprint } from "./waterCalculation.service";
import { CDP_MODULES, getCdpModule } from "../data/cdpQuestionnaire";

const round = (value: number, decimals = 4) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

/** CDP states energy in MWh, like ESRS and unlike GRI 302's GJ. */
const GJ_TO_MWH = 1 / 3.6;

// Same "FY2025-26" parsing as every other framework here.
export type CdpFyWindow = BrsrFyWindow;
export const resolveFyWindow = resolveBrsrFyWindow;

// ---------------------------------------------------------------------------
// Reuse of existing platform data
// ---------------------------------------------------------------------------

export interface CdpScope3CategoryTotal {
  category: Scope3Category;
  emissionsTco2e: number;
}

export interface CdpMetricsRollup {
  /**
   * C6.1 / C6.3 — AR5 basis, which is the GHG Protocol convention CDP
   * follows. Deliberately distinct from the AR2/BUR3 figures computed on the
   * same activity records for India's CCTS.
   */
  scope1Tco2e: number;
  scope2LocationTco2e: number;
  scope3Tco2e: number | null;
  /** C6.5 — CDP asks for Scope 3 category by category, not as a single total. */
  scope3ByCategory: CdpScope3CategoryTotal[];
  totalScope12Tco2e: number;

  /** C8.2 — energy, in MWh as CDP states it. */
  totalEnergyMwh: number;
  purchasedElectricityMwh: number;
  renewableElectricityMwh: number;
  purchasedSteamMwh: number;
  renewableSharePct: number | null;

  /** C9.2 / C9.3 — optional module, reused where the source disclosure exists. */
  wasteGeneratedTonnes: number | null;
  waterWithdrawalM3: number | null;

  /** C11.2a, from the voluntary offsets log. */
  carbonCreditsCancelledTco2e: number | null;

  productionQuantityT: number;
  activityDataCount: number;
}

/**
 * What the platform can already see about this company's exposure to carbon
 * pricing — the C11 bridge.
 *
 * Deliberately advisory rather than authoritative. Whether an operation is
 * actually *regulated* by a carbon pricing system turns on entity-level facts
 * this platform does not hold: which legal entity holds the account, whether
 * an installation clears a capacity threshold, whether a free allocation
 * applies. So this reports what the platform observed and names it as a
 * prompt, and C11.1 stays a question the responder answers rather than one
 * the platform answers for them. Pre-filling a regulatory status from
 * circumstantial evidence would be exactly the kind of unearned compliance
 * claim this codebase refuses to make elsewhere.
 */
export interface CdpCarbonPricingExposure {
  /** Systems the platform has evidence for, as display strings for C11.1a. */
  observedSystems: string[];
  appliesCbam: boolean;
  appliesCcts: boolean;
  cbamFrameworks: string[];
  /** Highest carbon price already recorded as paid, from CBAM Article 9 inputs. */
  carbonPricePaidEurPerTonne: number | null;
  /** True where a BEE-notified CCTS intensity target is present on activity data. */
  hasCctsTarget: boolean;
}

export const rollupCdpMetrics = async (
  facilityId: string,
  reportingPeriod: string,
  window: CdpFyWindow,
): Promise<CdpMetricsRollup> => {
  const [entries, scope3Rows, griWaste, offsets] = await Promise.all([
    prisma.activityData.findMany({
      where: {
        facilityId,
        status: "SUBMITTED",
        periodStart: { gte: window.start },
        periodEnd: { lt: window.end },
      },
      include: { calculationResult: true, waterEntries: true },
    }),
    prisma.scope3Data.findMany({
      where: { facilityId, reportingPeriod, status: "SUBMITTED" },
      select: { category: true, calculatedEmissionsTco2e: true },
    }),
    prisma.griWasteDisclosure.findFirst({ where: { griReport: { facilityId, reportingPeriod } } }),
    prisma.voluntaryOffsetPurchase.findMany({
      where: { facilityId, status: "SUBMITTED" },
      select: { tonnageTco2e: true },
    }),
  ]);

  let scope1 = 0;
  let scope2 = 0;
  let purchasedElectricity = 0;
  let renewableElectricity = 0;
  let purchasedSteam = 0;
  let productionQuantityT = 0;
  let withdrawnM3 = 0;
  let entriesWithWater = 0;

  for (const entry of entries) {
    if (entry.calculationResult) {
      scope1 += entry.calculationResult.totalDirectCo2eAr5;
      scope2 += entry.calculationResult.indirectElectricityCo2e + entry.calculationResult.indirectSteamCo2e;
    }
    productionQuantityT += entry.productionQuantityT ?? 0;

    // C8.2b is purchased electricity in total; C8.2c is the renewable portion
    // of it. Renewable electricity here is purchased renewable — electricity
    // generated on site is a separate CDP question (C8.2f) and is entered
    // manually, so adding it in would double-count against that answer.
    purchasedElectricity += entry.gridElectricityMwh + entry.renewableElectricityMwh;
    renewableElectricity += entry.renewableElectricityMwh;
    purchasedSteam += entry.steamImportedGj * GJ_TO_MWH;

    if (entry.waterEntries.length > 0) {
      entriesWithWater += 1;
      withdrawnM3 += buildWaterFootprint(entry.waterEntries, entry.productionQuantityT).totalWithdrawnM3;
    }
  }

  const scope3ByCategory = Array.from(
    scope3Rows
      .reduce((map, row) => {
        map.set(row.category, (map.get(row.category) ?? 0) + row.calculatedEmissionsTco2e);
        return map;
      }, new Map<Scope3Category, number>())
      .entries(),
  )
    .map(([category, emissionsTco2e]) => ({ category, emissionsTco2e: round(emissionsTco2e, 2) }))
    // Ordered by category rather than by size: CDP's C6.5 table is ordered by
    // GHG Protocol category number, and a report that reorders it makes the
    // transfer into CDP's platform harder to check row by row.
    .sort((a, b) => a.category.localeCompare(b.category, undefined, { numeric: true }));

  const scope3 = scope3Rows.length ? round(scope3Rows.reduce((sum, r) => sum + r.calculatedEmissionsTco2e, 0), 2) : null;

  const wasteGenerated = griWaste
    ? (griWaste.hazardousDivertedReuseT ?? 0) +
      (griWaste.hazardousDivertedRecyclingT ?? 0) +
      (griWaste.hazardousDivertedOtherRecoveryT ?? 0) +
      (griWaste.hazardousDisposalIncinerationWithRecoveryT ?? 0) +
      (griWaste.hazardousDisposalIncinerationNoRecoveryT ?? 0) +
      (griWaste.hazardousDisposalLandfillT ?? 0) +
      (griWaste.hazardousDisposalOtherT ?? 0) +
      (griWaste.nonHazardousDivertedReuseT ?? 0) +
      (griWaste.nonHazardousDivertedRecyclingT ?? 0) +
      (griWaste.nonHazardousDivertedOtherRecoveryT ?? 0) +
      (griWaste.nonHazardousDisposalIncinerationWithRecoveryT ?? 0) +
      (griWaste.nonHazardousDisposalIncinerationNoRecoveryT ?? 0) +
      (griWaste.nonHazardousDisposalLandfillT ?? 0) +
      (griWaste.nonHazardousDisposalOtherT ?? 0)
    : null;

  const totalEnergyMwh = round(purchasedElectricity + purchasedSteam, 3);

  return {
    scope1Tco2e: round(scope1, 2),
    scope2LocationTco2e: round(scope2, 2),
    scope3Tco2e: scope3,
    scope3ByCategory,
    totalScope12Tco2e: round(scope1 + scope2, 2),
    totalEnergyMwh,
    purchasedElectricityMwh: round(purchasedElectricity, 3),
    renewableElectricityMwh: round(renewableElectricity, 3),
    purchasedSteamMwh: round(purchasedSteam, 3),
    // Null rather than zero when there is no energy at all — a facility with
    // no activity data has no renewable share, and reporting 0% would assert
    // something the data does not support.
    renewableSharePct: totalEnergyMwh > 0 ? round((renewableElectricity / totalEnergyMwh) * 100, 2) : null,
    wasteGeneratedTonnes: wasteGenerated != null ? round(wasteGenerated, 3) : null,
    waterWithdrawalM3: entriesWithWater > 0 ? round(withdrawnM3, 3) : null,
    carbonCreditsCancelledTco2e: offsets.length
      ? round(offsets.reduce((sum, o) => sum + o.tonnageTco2e, 0), 2)
      : null,
    productionQuantityT: round(productionQuantityT, 3),
    activityDataCount: entries.length,
  };
};

const CBAM_FRAMEWORK_LABELS: Record<string, string> = {
  EU_CBAM: "EU Carbon Border Adjustment Mechanism (CBAM)",
  UK_CBAM: "UK Carbon Border Adjustment Mechanism",
};

export const buildCarbonPricingExposure = async (
  facilityId: string,
  company: Pick<Company, "appliesCbam" | "appliesCcts" | "cbamFrameworks">,
  window: CdpFyWindow,
): Promise<CdpCarbonPricingExposure> => {
  const entries = await prisma.activityData.findMany({
    where: {
      facilityId,
      status: "SUBMITTED",
      periodStart: { gte: window.start },
      periodEnd: { lt: window.end },
    },
    select: { carbonPricePaidEurPerTonne: true, cctsTargetIntensity: true },
  });

  const pricesPaid = entries.map((e) => e.carbonPricePaidEurPerTonne).filter((v): v is number => v != null);
  const cbamFrameworks = company.cbamFrameworks.map(String);

  const observedSystems: string[] = [];
  if (company.appliesCbam) {
    // Falls back to the generic label when the company is CBAM-enabled but
    // has not yet said which regime, rather than silently naming neither.
    const named = cbamFrameworks.map((f) => CBAM_FRAMEWORK_LABELS[f]).filter(Boolean);
    observedSystems.push(...(named.length > 0 ? named : ["Carbon Border Adjustment Mechanism"]));
  }
  if (company.appliesCcts) observedSystems.push("India Carbon Credit Trading Scheme (CCTS)");
  if (entries.some((e) => e.cctsTargetIntensity != null) && !company.appliesCcts) {
    observedSystems.push("India Carbon Credit Trading Scheme (CCTS) — intensity target present on activity data");
  }

  return {
    observedSystems,
    appliesCbam: company.appliesCbam,
    appliesCcts: company.appliesCcts,
    cbamFrameworks,
    carbonPricePaidEurPerTonne: pricesPaid.length > 0 ? Math.max(...pricesPaid) : null,
    hasCctsTarget: entries.some((e) => e.cctsTargetIntensity != null),
  };
};

/** C6.10 — combined Scope 1 and 2 per unit of revenue, in the currency stated at C0.4. */
export const computeIntensity = (
  rollup: Pick<CdpMetricsRollup, "totalScope12Tco2e">,
  revenue: number | null,
): number | null => (revenue != null && revenue > 0 ? round(rollup.totalScope12Tco2e / revenue, 12) : null);

// ---------------------------------------------------------------------------
// Assembled metrics
// ---------------------------------------------------------------------------

export const CDP_REPORT_INCLUDE = {
  introduction: true,
  governance: true,
  risksOpportunities: true,
  businessStrategy: true,
  targetsPerformance: true,
  emissionsMethodology: true,
  emissionsData: true,
  emissionsBreakdownModule: true,
  energy: true,
  additionalMetrics: true,
  verification: true,
  carbonPricing: true,
  engagement: true,
  signoff: true,
  risks: { orderBy: { createdAt: "asc" } },
  targets: { orderBy: { targetYear: "asc" } },
  breakdownRows: { orderBy: { label: "asc" } },
} satisfies Prisma.CdpReportInclude;

export type CdpReportWithRelations = Prisma.CdpReportGetPayload<{ include: typeof CDP_REPORT_INCLUDE }>;

/** Maps a module code to its loaded row via the registry's `relation` name. */
export const moduleRowsFrom = (report: CdpReportWithRelations): Record<string, Record<string, unknown> | null> => {
  const rows: Record<string, Record<string, unknown> | null> = {};
  for (const module of CDP_MODULES) {
    rows[module.code] =
      ((report as unknown as Record<string, unknown>)[module.relation] as Record<string, unknown> | null) ?? null;
  }
  return rows;
};

/**
 * Whether a derived question actually resolved to a value.
 *
 * Derived questions have no stored column, so "answered" means the
 * calculation produced something — a facility with no water inventory has not
 * answered C9.3 just because the field is computed. Mapped explicitly rather
 * than by naming convention so a renamed rollup field fails loudly here
 * instead of silently reporting every derived question as answered. Same rule
 * as the CSRD disclosure index.
 */
export const derivedQuestionHasValue = (field: string, metrics: CdpMetrics): boolean => {
  const r = metrics.rollup;
  switch (field) {
    case "reportingYearDescription":
      // C0.2 is the reporting window, which always resolves.
      return true;
    case "scope1Tco2e":
      return r.scope1Tco2e > 0;
    case "scope2LocationTco2e":
      return r.scope2LocationTco2e > 0;
    case "scope3Tco2e":
      return r.scope3Tco2e != null;
    case "intensityPerRevenue":
      return metrics.intensityPerRevenue != null;
    case "totalEnergyMwh":
      return r.totalEnergyMwh > 0;
    case "purchasedElectricityMwh":
      return r.purchasedElectricityMwh > 0;
    case "renewableElectricityMwh":
      return r.renewableElectricityMwh > 0;
    case "purchasedSteamMwh":
      return r.purchasedSteamMwh > 0;
    case "renewableSharePct":
      return r.renewableSharePct != null;
    case "wasteGeneratedTonnes":
      return r.wasteGeneratedTonnes != null;
    case "waterWithdrawalM3":
      return r.waterWithdrawalM3 != null;
    case "creditsCancelledTco2e":
      return r.carbonCreditsCancelledTco2e != null;
    default:
      return false;
  }
};

export interface CdpMetrics {
  fyWindow: CdpFyWindow;
  rollup: CdpMetricsRollup;
  /** C6.10 — null when no revenue was entered. */
  intensityPerRevenue: number | null;
  carbonPricingExposure: CdpCarbonPricingExposure;
}

export const buildCdpMetrics = async (
  report: CdpReportWithRelations,
  facility: Pick<Facility, "id">,
  company: Pick<Company, "reportingFyStartMonth" | "appliesCbam" | "appliesCcts" | "cbamFrameworks">,
): Promise<CdpMetrics> => {
  const fyWindow = resolveFyWindow(report.reportingPeriod, company.reportingFyStartMonth);
  const [rollup, carbonPricingExposure] = await Promise.all([
    rollupCdpMetrics(facility.id, report.reportingPeriod, fyWindow),
    buildCarbonPricingExposure(facility.id, company, fyWindow),
  ]);

  return {
    fyWindow,
    rollup,
    intensityPerRevenue: computeIntensity(rollup, report.revenue),
    carbonPricingExposure,
  };
};

/** Resolves a module code to its human label for error messages. */
export const moduleLabel = (code: string): string => {
  const module = getCdpModule(code);
  return module ? `${module.label} ${module.title}` : code;
};
