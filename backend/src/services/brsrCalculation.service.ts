import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";
import type { BrsrCoreReport, Company, Facility } from "@prisma/client";

const round = (value: number, decimals = 4) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const MWH_TO_GJ = 3.6;

export interface BrsrFyWindow {
  start: Date;
  /** Exclusive upper bound. */
  end: Date;
  label: string;
}

/** Parses a "FY2025-26" style reporting period into a concrete date window using the company's fiscal year start month (Company.reportingFyStartMonth). */
export const resolveFyWindow = (reportingPeriod: string, fyStartMonth: number): BrsrFyWindow => {
  const match = reportingPeriod.match(/^FY(\d{4})-\d{2}$/);
  if (!match) {
    throw AppError.badRequest(
      `Invalid reporting period "${reportingPeriod}" — expected e.g. "FY2025-26"`,
      "INVALID_REPORTING_PERIOD",
    );
  }
  const startYear = Number(match[1]);
  return {
    start: new Date(Date.UTC(startYear, fyStartMonth - 1, 1)),
    end: new Date(Date.UTC(startYear + 1, fyStartMonth - 1, 1)),
    label: reportingPeriod,
  };
};

export interface BrsrGhgRollup {
  scope1Co2e: number;
  scope2Co2e: number;
  totalCo2e: number;
  /** Summed across every ActivityData entry inside the FY — denominator for "per unit of production". */
  productionQuantityT: number;
  /** Reused directly from ActivityData — no new energy-conversion logic (see energy footprint note below). */
  electricityAndSteamEnergyGj: number;
  activityDataCount: number;
}

/**
 * Sums the existing CCTS/AR2-BUR3 Scope 1 + Scope 2 emissions already computed
 * for this facility's ActivityData entries that fall inside the FY window —
 * reads EmissionCalculationResult only, recomputes nothing. This is the single
 * point of contact between BRSR Core and the CBAM/CCTS calculation engine.
 */
export const rollupFacilityGhgForFy = async (facilityId: string, window: BrsrFyWindow): Promise<BrsrGhgRollup> => {
  const entries = await prisma.activityData.findMany({
    where: {
      facilityId,
      status: "SUBMITTED",
      periodStart: { gte: window.start },
      periodEnd: { lt: window.end },
    },
    include: { calculationResult: true },
  });

  let scope1Co2e = 0;
  let scope2Co2e = 0;
  let productionQuantityT = 0;
  let electricityAndSteamEnergyGj = 0;

  for (const entry of entries) {
    if (entry.calculationResult) {
      // AR2/BUR3 (CCTS) basis, per the brief — NOT the AR5/CBAM columns.
      scope1Co2e += entry.calculationResult.totalDirectCo2eAr4;
      scope2Co2e += entry.calculationResult.indirectElectricityCo2e + entry.calculationResult.indirectSteamCo2e;
    }
    productionQuantityT += entry.productionQuantityT ?? 0;
    // Electricity and imported steam are already denominated in energy units
    // (MWh, GJ) on ActivityData, so they're reused as-is. Fuel combustion's
    // energy content (GJ per tonne/kilolitre) isn't modelled anywhere in the
    // existing emission-factor library (FUEL_LIBRARY only carries emission
    // factors, not calorific values) — inventing calorific conversion factors
    // here would be new, unvalidated calculation logic, not a reuse of
    // existing infrastructure, so combustion energy is intentionally excluded
    // from this total. See BrsrCoreReport's energy fields for the manual
    // renewable/non-renewable split, which covers the full facility figure.
    electricityAndSteamEnergyGj += (entry.gridElectricityMwh + entry.renewableElectricityMwh) * MWH_TO_GJ;
    electricityAndSteamEnergyGj += entry.steamImportedGj;
  }

  return {
    scope1Co2e: round(scope1Co2e, 2),
    scope2Co2e: round(scope2Co2e, 2),
    totalCo2e: round(scope1Co2e + scope2Co2e, 2),
    productionQuantityT: round(productionQuantityT, 2),
    electricityAndSteamEnergyGj: round(electricityAndSteamEnergyGj, 2),
    activityDataCount: entries.length,
  };
};

export interface BrsrCoreMetrics {
  fyWindow: BrsrFyWindow;
  turnoverInr: number | null;
  ghg: {
    scope1Co2e: number;
    scope2Co2e: number;
    totalCo2e: number;
    productionQuantityT: number;
    intensityPerRupeeTurnover: number | null;
    intensityPerUnitProduction: number | null;
    activityDataCount: number;
  };
  water: {
    withdrawnKl: number | null;
    dischargedKl: number | null;
    consumptionKl: number | null;
    intensityPerRupeeTurnover: number | null;
    /** Consumption as a % of water withdrawn — a real water-balance ratio, not a fresh input. */
    consumptionRatePct: number | null;
  };
  waste: {
    generatedTonnes: number | null;
    recoveredTonnes: number | null;
    recoveryRatePct: number | null;
    intensityPerRupeeTurnover: number | null;
  };
  energy: {
    renewableGj: number | null;
    nonRenewableGj: number | null;
    totalGj: number | null;
    renewablePct: number | null;
    electricityAndSteamGjReused: number;
  };
  employeeWellbeing: {
    /** Incidents per 1,000 employees — there's no hours-worked field captured, so this is the only rate computable from existing fields. */
    safetyIncidentRatePer1000: number | null;
  };
  genderDiversity: {
    /** Derived as employeeCountTotal - employeeCountFemale, not a separate captured field. */
    maleHeadcount: number | null;
    avgWageMaleInr: number | null;
    avgWageFemaleInr: number | null;
    /** % by which average female pay trails average male pay — positive means female average is lower. */
    payGapPct: number | null;
  };
}

const perRupee = (numerator: number | null | undefined, turnoverInr: number | null): number | null => {
  if (numerator == null || turnoverInr == null || turnoverInr <= 0) return null;
  return round(numerator / turnoverInr, 8);
};

/**
 * Combines the reused GHG rollup with BrsrCoreReport's manual disclosure
 * fields into the BRSR Core presentation ratios (all "per rupee of turnover",
 * the standard BRSR Core basis, plus GHG's additional "per unit of
 * production"). Pure computation — no recalculation of underlying emissions.
 */
export const computeBrsrCoreMetrics = (
  report: BrsrCoreReport,
  company: Pick<Company, "annualTurnoverInr">,
  ghg: BrsrGhgRollup,
  fyWindow: BrsrFyWindow,
): BrsrCoreMetrics => {
  const turnoverInr = report.turnoverInr ?? company.annualTurnoverInr ?? null;

  const consumptionKl =
    report.waterWithdrawnKl != null && report.waterDischargedKl != null
      ? Math.max(0, round(report.waterWithdrawnKl - report.waterDischargedKl, 2))
      : null;

  const totalEnergyGj =
    report.renewableEnergyConsumptionGj != null && report.nonRenewableEnergyConsumptionGj != null
      ? round(report.renewableEnergyConsumptionGj + report.nonRenewableEnergyConsumptionGj, 2)
      : null;

  const consumptionRatePct =
    consumptionKl != null && report.waterWithdrawnKl && report.waterWithdrawnKl > 0
      ? round((consumptionKl / report.waterWithdrawnKl) * 100, 1)
      : null;

  const safetyIncidentRatePer1000 =
    report.safetyIncidentsCount != null && report.employeeCountTotal && report.employeeCountTotal > 0
      ? round((report.safetyIncidentsCount / report.employeeCountTotal) * 1000, 2)
      : null;

  const maleHeadcount =
    report.employeeCountTotal != null && report.employeeCountFemale != null
      ? Math.max(0, report.employeeCountTotal - report.employeeCountFemale)
      : null;
  const avgWageMaleInr =
    report.wagesPaidMaleInr != null && maleHeadcount && maleHeadcount > 0
      ? round(report.wagesPaidMaleInr / maleHeadcount, 2)
      : null;
  const avgWageFemaleInr =
    report.wagesPaidFemaleInr != null && report.employeeCountFemale && report.employeeCountFemale > 0
      ? round(report.wagesPaidFemaleInr / report.employeeCountFemale, 2)
      : null;
  const payGapPct =
    avgWageMaleInr != null && avgWageFemaleInr != null && avgWageMaleInr > 0
      ? round(((avgWageMaleInr - avgWageFemaleInr) / avgWageMaleInr) * 100, 1)
      : null;

  return {
    fyWindow,
    turnoverInr,
    ghg: {
      scope1Co2e: ghg.scope1Co2e,
      scope2Co2e: ghg.scope2Co2e,
      totalCo2e: ghg.totalCo2e,
      productionQuantityT: ghg.productionQuantityT,
      intensityPerRupeeTurnover: perRupee(ghg.totalCo2e, turnoverInr),
      intensityPerUnitProduction: ghg.productionQuantityT > 0 ? round(ghg.totalCo2e / ghg.productionQuantityT, 4) : null,
      activityDataCount: ghg.activityDataCount,
    },
    water: {
      withdrawnKl: report.waterWithdrawnKl,
      dischargedKl: report.waterDischargedKl,
      consumptionKl,
      intensityPerRupeeTurnover: perRupee(consumptionKl, turnoverInr),
      consumptionRatePct,
    },
    waste: {
      generatedTonnes: report.wasteGeneratedTonnes,
      recoveredTonnes: report.wasteRecoveredTonnes,
      recoveryRatePct:
        report.wasteGeneratedTonnes && report.wasteGeneratedTonnes > 0 && report.wasteRecoveredTonnes != null
          ? round((report.wasteRecoveredTonnes / report.wasteGeneratedTonnes) * 100, 1)
          : null,
      intensityPerRupeeTurnover: perRupee(report.wasteGeneratedTonnes, turnoverInr),
    },
    energy: {
      renewableGj: report.renewableEnergyConsumptionGj,
      nonRenewableGj: report.nonRenewableEnergyConsumptionGj,
      totalGj: totalEnergyGj,
      renewablePct:
        totalEnergyGj && totalEnergyGj > 0 && report.renewableEnergyConsumptionGj != null
          ? round((report.renewableEnergyConsumptionGj / totalEnergyGj) * 100, 1)
          : null,
      electricityAndSteamGjReused: ghg.electricityAndSteamEnergyGj,
    },
    employeeWellbeing: {
      safetyIncidentRatePer1000,
    },
    genderDiversity: {
      maleHeadcount,
      avgWageMaleInr,
      avgWageFemaleInr,
      payGapPct,
    },
  };
};

/** Convenience wrapper used by both the JSON report endpoint and the PDF builder. */
export const buildBrsrCoreMetrics = async (
  report: BrsrCoreReport,
  facility: Pick<Facility, "id">,
  company: Pick<Company, "annualTurnoverInr" | "reportingFyStartMonth">,
): Promise<BrsrCoreMetrics> => {
  const fyWindow = resolveFyWindow(report.reportingPeriod, company.reportingFyStartMonth);
  const ghg = await rollupFacilityGhgForFy(facility.id, fyWindow);
  return computeBrsrCoreMetrics(report, company, ghg, fyWindow);
};
