import { prisma } from "../config/prisma";
import type { Company, CompanyTarget, Facility, IssbS1S2Report } from "@prisma/client";
import { primaryCompanyTarget, resolveEffectiveTarget } from "./companyTarget.service";
import { resolveFyWindow as resolveBrsrFyWindow, type BrsrFyWindow } from "./brsrCalculation.service";

const round = (value: number, decimals = 4) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

// Same "FY2025-26" parsing/window resolution as BRSR Core — reported here
// under an IFRS-flavoured name rather than duplicating the date math.
export type IssbFyWindow = BrsrFyWindow;
export const resolveFyWindow = resolveBrsrFyWindow;

export interface IssbGhgRollup {
  scope1Co2e: number;
  scope2Co2e: number;
  totalScope1And2Co2e: number;
  activityDataCount: number;
}

/**
 * Sums the existing Scope 1 + Scope 2 emissions already computed for this
 * facility's ActivityData entries that fall inside the FY window — reads
 * EmissionCalculationResult only, recomputes nothing. Unlike BRSR Core (which
 * reports on the AR2/BUR3-CCTS basis for Indian regulatory alignment), IFRS
 * S2 follows GHG Protocol/TCFD convention, so this reads the AR5 columns —
 * the single point of contact between the ISSB module and the CBAM/CCTS
 * calculation engine.
 */
export const rollupFacilityGhgForFy = async (facilityId: string, window: IssbFyWindow): Promise<IssbGhgRollup> => {
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

  for (const entry of entries) {
    if (entry.calculationResult) {
      scope1Co2e += entry.calculationResult.totalDirectCo2eAr5;
      scope2Co2e += entry.calculationResult.indirectElectricityCo2e + entry.calculationResult.indirectSteamCo2e;
    }
  }

  return {
    scope1Co2e: round(scope1Co2e, 2),
    scope2Co2e: round(scope2Co2e, 2),
    totalScope1And2Co2e: round(scope1Co2e + scope2Co2e, 2),
    activityDataCount: entries.length,
  };
};

export interface IssbS1S2Metrics {
  fyWindow: IssbFyWindow;
  ghg: {
    scope1Co2e: number;
    scope2Co2e: number;
    scope3Co2e: number | null;
    totalCo2e: number | null;
    activityDataCount: number;
  };
  targets: {
    targetYear: number | null;
    baselineYear: number | null;
    baselineEmissionsTco2e: number | null;
    /** True where a figure above came from CompanyTarget rather than the report. */
    fromCompanyTarget?: boolean;
    /** % change from baseline to current total Scope 1+2+3 (where both are known). Negative = reduction. */
    changeFromBaselinePct: number | null;
  };
  transition: {
    internalCarbonPriceInr: number | null;
    climateCapexInr: number | null;
  };
}

/**
 * Combines the reused Scope 1/2 rollup with IssbS1S2Report's manual Scope 3 /
 * target disclosures into the Metrics & Targets pillar. Pure computation —
 * no recalculation of underlying emissions.
 */
export const computeIssbS1S2Metrics = (
  report: IssbS1S2Report,
  ghg: IssbGhgRollup,
  fyWindow: IssbFyWindow,
  /**
   * The company's canonical target, used only to fill fields this report
   * leaves empty. Optional so existing callers and tests that predate
   * CompanyTarget keep working unchanged — with no target passed, behaviour is
   * exactly what it was.
   */
  companyTarget: Pick<CompanyTarget, "targetYear" | "baselineYear" | "baselineEmissionsTco2e"> | null = null,
): IssbS1S2Metrics => {
  const totalCo2e =
    report.scope3Tco2e != null ? round(ghg.totalScope1And2Co2e + report.scope3Tco2e, 2) : ghg.totalScope1And2Co2e;

  const changeFromBaselinePct =
    report.baselineEmissionsTco2e != null && report.baselineEmissionsTco2e > 0 && totalCo2e != null
      ? round(((totalCo2e - report.baselineEmissionsTco2e) / report.baselineEmissionsTco2e) * 100, 1)
      : null;

  return {
    fyWindow,
    ghg: {
      scope1Co2e: ghg.scope1Co2e,
      scope2Co2e: ghg.scope2Co2e,
      scope3Co2e: report.scope3Tco2e ?? null,
      totalCo2e,
      activityDataCount: ghg.activityDataCount,
    },
    targets: {
      targetYear: resolveEffectiveTarget(report.targetYear, companyTarget?.targetYear ?? null),
      baselineYear: resolveEffectiveTarget(report.baselineYear, companyTarget?.baselineYear ?? null),
      baselineEmissionsTco2e: resolveEffectiveTarget(
        report.baselineEmissionsTco2e,
        companyTarget?.baselineEmissionsTco2e ?? null,
      ),
      changeFromBaselinePct,
      /** True where any figure above came from the company target rather than this report. */
      fromCompanyTarget:
        companyTarget != null &&
        (report.targetYear == null || report.baselineYear == null || report.baselineEmissionsTco2e == null),
    },
    transition: {
      internalCarbonPriceInr: report.internalCarbonPriceInr ?? null,
      climateCapexInr: report.climateCapexInr ?? null,
    },
  };
};

/** Convenience wrapper used by both the JSON report endpoint and the PDF builder. */
/**
 * `company.id` is read so the report can fall back to the company's canonical
 * reduction target (CompanyTarget) where this report states none of its own.
 * The report's explicit value always wins — see resolveEffectiveTarget: an
 * ISSB statement that has been submitted is a signed disclosure, and pulling
 * a different target year in from another table would change it after the
 * fact. The fallback only fills a gap, so the duplication stops growing.
 */
export const buildIssbS1S2Metrics = async (
  report: IssbS1S2Report,
  facility: Pick<Facility, "id">,
  company: Pick<Company, "id" | "reportingFyStartMonth">,
): Promise<IssbS1S2Metrics> => {
  const fyWindow = resolveFyWindow(report.reportingPeriod, company.reportingFyStartMonth);
  const [ghg, companyTarget] = await Promise.all([
    rollupFacilityGhgForFy(facility.id, fyWindow),
    primaryCompanyTarget(company.id),
  ]);
  return computeIssbS1S2Metrics(report, ghg, fyWindow, companyTarget);
};
