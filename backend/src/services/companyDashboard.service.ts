import type { BrsrCoreReport, Company, Facility } from "@prisma/client";
import { prisma } from "../config/prisma";
import { requireMyCompany } from "./company.service";
import { computeCbamFinancialImpact } from "./cbamFinancialImpact.service";
import { buildBrsrCoreMetrics, type BrsrCoreMetrics } from "./brsrCalculation.service";
import type { ReportContext } from "./report.service";
import { getCbamCertificatePrice } from "../data/cbamReferenceData";
import { round, quarterLabel, quarterSortKey, periodLabel, seeUnitFor, cctsTone } from "./dashboardShared.helpers";

type BrsrReportWithFacility = BrsrCoreReport & { facility: Facility };

/**
 * Company-wide BRSR Core analytics — same "one place owns the aggregation"
 * convention as the CBAM/CCTS section above, reusing buildBrsrCoreMetrics
 * (the exact function the BRSR PDF report and facility dashboard already
 * call) rather than re-deriving any ratio. Gated on an active BRSR Core
 * subscription: the caller only includes this in the response when that
 * gate passes, so a company that never bought the module never pays for
 * these queries either.
 */
const getCompanyBrsrAnalytics = async (
  facilities: Facility[],
  company: Pick<Company, "annualTurnoverInr" | "reportingFyStartMonth">,
) => {
  const facilityIds = facilities.map((f) => f.id);
  const reports: BrsrReportWithFacility[] =
    facilityIds.length === 0
      ? []
      : await prisma.brsrCoreReport.findMany({
          where: { facilityId: { in: facilityIds }, status: "SUBMITTED" },
          include: { facility: true },
          // reportingPeriod is "FY2025-26" — same-length zero-padded years sort
          // lexicographically in chronological order, no date parsing needed.
          orderBy: { reportingPeriod: "asc" },
        });

  const withMetrics: { report: BrsrReportWithFacility; metrics: BrsrCoreMetrics }[] = await Promise.all(
    reports.map(async (report) => ({ report, metrics: await buildBrsrCoreMetrics(report, report.facility, company) })),
  );

  // ---- Water balance trend — withdrawn/discharged/consumed, by FY, company-wide sum ----
  const waterByPeriod = new Map<string, { withdrawn: number; discharged: number; consumed: number; hasData: boolean }>();
  for (const { report, metrics } of withMetrics) {
    if (metrics.water.withdrawnKl == null && metrics.water.dischargedKl == null) continue;
    const bucket = waterByPeriod.get(report.reportingPeriod) ?? { withdrawn: 0, discharged: 0, consumed: 0, hasData: true };
    bucket.withdrawn += metrics.water.withdrawnKl ?? 0;
    bucket.discharged += metrics.water.dischargedKl ?? 0;
    bucket.consumed += metrics.water.consumptionKl ?? 0;
    waterByPeriod.set(report.reportingPeriod, bucket);
  }
  const waterTrend = Array.from(waterByPeriod.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([periodLabel, v]) => ({
      periodLabel,
      withdrawnKl: round(v.withdrawn),
      dischargedKl: round(v.discharged),
      consumedKl: round(v.consumed),
    }));

  // ---- Waste generated trend — by FY, company-wide sum ----
  const wasteByPeriod = new Map<string, { generated: number; recovered: number }>();
  for (const { report, metrics } of withMetrics) {
    if (metrics.waste.generatedTonnes == null) continue;
    const bucket = wasteByPeriod.get(report.reportingPeriod) ?? { generated: 0, recovered: 0 };
    bucket.generated += metrics.waste.generatedTonnes ?? 0;
    bucket.recovered += metrics.waste.recoveredTonnes ?? 0;
    wasteByPeriod.set(report.reportingPeriod, bucket);
  }
  const wasteTrend = Array.from(wasteByPeriod.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([periodLabel, v]) => ({ periodLabel, generatedTonnes: round(v.generated), recoveredTonnes: round(v.recovered) }));

  // ---- Latest FY across all facilities' reports — anchors the two "current period" cards below ----
  const latestPeriod = reports.at(-1)?.reportingPeriod ?? null;

  // ---- Energy mix composition — renewable vs non-renewable, latest FY, company-wide sum ----
  let energyComposition:
    | { hasData: true; periodLabel: string; renewableGj: number; nonRenewableGj: number; renewablePct: number }
    | { hasData: false } = { hasData: false };
  if (latestPeriod) {
    let renewable = 0;
    let nonRenewable = 0;
    let any = false;
    for (const { report, metrics } of withMetrics) {
      if (report.reportingPeriod !== latestPeriod) continue;
      if (metrics.energy.renewableGj == null || metrics.energy.nonRenewableGj == null) continue;
      renewable += metrics.energy.renewableGj;
      nonRenewable += metrics.energy.nonRenewableGj;
      any = true;
    }
    if (any) {
      const total = renewable + nonRenewable;
      energyComposition = {
        hasData: true,
        periodLabel: latestPeriod,
        renewableGj: round(renewable),
        nonRenewableGj: round(nonRenewable),
        renewablePct: total > 0 ? round((renewable / total) * 100, 1) : 0,
      };
    }
  }

  // ---- Gender diversity — women vs men headcount, latest FY, company-wide sum ----
  let genderDiversity:
    | { hasData: true; periodLabel: string; femaleCount: number; maleCount: number; womenPct: number }
    | { hasData: false } = { hasData: false };
  if (latestPeriod) {
    let female = 0;
    let male = 0;
    let any = false;
    for (const { report, metrics } of withMetrics) {
      if (report.reportingPeriod !== latestPeriod) continue;
      if (report.employeeCountFemale == null || metrics.genderDiversity.maleHeadcount == null) continue;
      female += report.employeeCountFemale;
      male += metrics.genderDiversity.maleHeadcount;
      any = true;
    }
    if (any) {
      const total = female + male;
      genderDiversity = {
        hasData: true,
        periodLabel: latestPeriod,
        femaleCount: female,
        maleCount: male,
        womenPct: total > 0 ? round((female / total) * 100, 1) : 0,
      };
    }
  }

  // ---- Safety incident rate — company-wide incidents per 1,000 employees, latest FY vs the FY before it ----
  const safetyByPeriod = new Map<string, { incidents: number; employees: number }>();
  for (const { report } of withMetrics) {
    if (report.safetyIncidentsCount == null || !report.employeeCountTotal) continue;
    const bucket = safetyByPeriod.get(report.reportingPeriod) ?? { incidents: 0, employees: 0 };
    bucket.incidents += report.safetyIncidentsCount;
    bucket.employees += report.employeeCountTotal;
    safetyByPeriod.set(report.reportingPeriod, bucket);
  }
  const safetyPeriodsSorted = Array.from(safetyByPeriod.keys()).sort((a, b) => a.localeCompare(b));
  const rateFor = (period: string) => {
    const b = safetyByPeriod.get(period)!;
    return b.employees > 0 ? round((b.incidents / b.employees) * 1000, 2) : null;
  };
  let safetyIncidentRate:
    | { hasData: true; periodLabel: string; currentRate: number; previousRate: number; deltaPct: number | null }
    | { hasData: false } = { hasData: false };
  if (safetyPeriodsSorted.length >= 2) {
    const currentPeriod = safetyPeriodsSorted.at(-1)!;
    const previousPeriod = safetyPeriodsSorted.at(-2)!;
    const currentRate = rateFor(currentPeriod);
    const previousRate = rateFor(previousPeriod);
    if (currentRate != null && previousRate != null) {
      safetyIncidentRate = {
        hasData: true,
        periodLabel: currentPeriod,
        currentRate,
        previousRate,
        deltaPct: previousRate > 0 ? round(((currentRate - previousRate) / previousRate) * 100, 1) : null,
      };
    }
  }

  // ---- Facility comparison — water consumption, each facility's latest submitted FY, only meaningful with 2+ facilities ----
  const latestPerFacility = new Map<string, { report: BrsrReportWithFacility; metrics: BrsrCoreMetrics }>();
  for (const entry of withMetrics) {
    // withMetrics is chronological (reportingPeriod asc), so the last write
    // per facility below is always that facility's most recent submission.
    latestPerFacility.set(entry.report.facilityId, entry);
  }
  const brsrFacilityComparison =
    facilities.length >= 2
      ? Array.from(latestPerFacility.values())
          .filter(({ metrics }) => metrics.water.consumptionKl != null)
          .map(({ report, metrics }) => ({
            facilityId: report.facilityId,
            facilityName: report.facility.name,
            value: metrics.water.consumptionKl as number,
            unit: "KL",
            periodLabel: report.reportingPeriod,
          }))
      : [];

  return {
    hasReports: reports.length > 0,
    waterTrend,
    wasteTrend,
    energyComposition,
    genderDiversity,
    safetyIncidentRate,
    facilityComparison: brsrFacilityComparison,
  };
};

export type CompanyBrsrAnalytics = Awaited<ReturnType<typeof getCompanyBrsrAnalytics>>;

/**
 * Company-wide analytics for the Company Admin dashboard — same convention
 * as facilityDashboard.service.ts (one place owns the aggregation/rollup
 * logic, the frontend just renders numbers it's handed), but summed/blended
 * across every facility the company owns instead of scoped to one.
 */
export const getCompanyAnalytics = async (userId: string) => {
  const company = await requireMyCompany(userId);

  const facilities = await prisma.facility.findMany({
    where: { companyId: company.id },
    orderBy: { createdAt: "asc" },
  });
  const facilityIds = facilities.map((f) => f.id);

  const entries =
    facilityIds.length === 0
      ? []
      : await prisma.activityData.findMany({
          where: { facilityId: { in: facilityIds }, status: "SUBMITTED", calculationResult: { isNot: null } },
          include: {
            facility: { include: { company: { include: { owner: true } } } },
            calculationResult: true,
          },
          orderBy: { periodEnd: "asc" },
        });

  // Draft facilities without a production route shouldn't happen for
  // submitted data in practice, but fall back to "OTHER" defensively — same
  // reasoning as facilityDashboard.service.ts's identical cast.
  const contexts = entries.map((entry) => ({
    ...entry,
    facility: { ...entry.facility, productionRoute: entry.facility.productionRoute ?? "OTHER" },
  })) as unknown as ReportContext[];

  const financials = contexts.map((ctx) => ({ ctx, impact: computeCbamFinancialImpact(ctx, "CBAM") }));

  // ---- 1. Emissions trend over time — Scope 1 / Scope 2 / Precursor, by quarter, company-wide ----
  const emissionsByQuarter = new Map<string, { scope1: number; scope2: number; precursor: number; sortKey: number }>();
  for (const { ctx } of financials) {
    const r = ctx.calculationResult;
    const label = quarterLabel(ctx.periodEnd);
    const scope1 = r.directCombustionCo2eAr5 + r.directProcessCo2e + r.directPfcCo2eAr5 + r.directN2oProcessCo2eAr5;
    const scope2 = r.indirectElectricityCo2e + r.indirectSteamCo2e;
    const precursor = r.directPrecursorCo2e;
    const bucket = emissionsByQuarter.get(label) ?? { scope1: 0, scope2: 0, precursor: 0, sortKey: quarterSortKey(ctx.periodEnd) };
    bucket.scope1 += scope1;
    bucket.scope2 += scope2;
    bucket.precursor += precursor;
    emissionsByQuarter.set(label, bucket);
  }
  const emissionsTrend = Array.from(emissionsByQuarter.entries())
    .sort((a, b) => a[1].sortKey - b[1].sortKey)
    .map(([label, v]) => ({
      periodLabel: label,
      scope1Tco2e: round(v.scope1),
      scope2Tco2e: round(v.scope2),
      precursorTco2e: round(v.precursor),
      totalTco2e: round(v.scope1 + v.scope2 + v.precursor),
    }));

  // ---- 2. CBAM liability trend — by quarter, company-wide sum ----
  const liabilityByQuarter = new Map<string, { actual: number; default: number; sortKey: number }>();
  for (const { ctx, impact } of financials) {
    const label = quarterLabel(ctx.periodEnd);
    const production = ctx.sector === "ELECTRICITY" ? (ctx.electricityExportedEuMwh ?? 0) : ctx.productionQuantityT;
    const defaultLiabilityEur = impact.defaultSee * production * impact.certificatePrice;
    const bucket = liabilityByQuarter.get(label) ?? { actual: 0, default: 0, sortKey: quarterSortKey(ctx.periodEnd) };
    bucket.actual += impact.grossLiabilityEur;
    bucket.default += defaultLiabilityEur;
    liabilityByQuarter.set(label, bucket);
  }
  const liabilityTrend = Array.from(liabilityByQuarter.entries())
    .sort((a, b) => a[1].sortKey - b[1].sortKey)
    .map(([label, v]) => ({ quarterLabel: label, actualLiabilityEur: round(v.actual), defaultLiabilityEur: round(v.default) }));

  const currentCertPrice = getCbamCertificatePrice();

  // ---- 3. Emissions source composition — latest quarter with data, company-wide ----
  const latestQuarterLabel = emissionsTrend.at(-1)?.periodLabel ?? null;
  let emissionsComposition:
    | { hasData: true; periodLabel: string; totalTco2e: number; segments: { label: string; valueTco2e: number; pct: number }[] }
    | { hasData: false } = { hasData: false };
  if (latestQuarterLabel) {
    let combustion = 0;
    let process = 0;
    let indirect = 0;
    let precursor = 0;
    for (const { ctx } of financials) {
      if (quarterLabel(ctx.periodEnd) !== latestQuarterLabel) continue;
      const r = ctx.calculationResult;
      combustion += r.directCombustionCo2eAr5;
      process += r.directProcessCo2e + r.directPfcCo2eAr5 + r.directN2oProcessCo2eAr5;
      indirect += r.indirectElectricityCo2e + r.indirectSteamCo2e;
      precursor += r.directPrecursorCo2e;
    }
    const total = round(combustion + process + indirect + precursor);
    const pct = (v: number) => (total > 0 ? round((v / total) * 100, 1) : 0);
    emissionsComposition = {
      hasData: true,
      periodLabel: latestQuarterLabel,
      totalTco2e: total,
      segments: [
        { label: "Scope 1 Combustion", valueTco2e: round(combustion), pct: pct(combustion) },
        { label: "Scope 1 Process", valueTco2e: round(process), pct: pct(process) },
        { label: "Scope 2 Indirect", valueTco2e: round(indirect), pct: pct(indirect) },
        { label: "Precursors", valueTco2e: round(precursor), pct: pct(precursor) },
      ],
    };
  }

  // ---- 4. CCTS intensity vs target — company-wide production-weighted average for the latest period with a resolved target ----
  const latestWithTarget = [...financials].reverse().find((f) => !f.impact.cctsPosition.pending);
  let cctsIntensity:
    | { hasData: true; periodLabel: string; actualIntensity: number; targetIntensity: number | null; tone: ReturnType<typeof cctsTone> }
    | { hasData: false } = { hasData: false };
  if (latestWithTarget && !latestWithTarget.impact.cctsPosition.pending) {
    const label = quarterLabel(latestWithTarget.ctx.periodEnd);
    let weightedActual = 0;
    let weightedTarget = 0;
    let totalProduction = 0;
    for (const { ctx, impact } of financials) {
      if (quarterLabel(ctx.periodEnd) !== label) continue;
      if (impact.cctsPosition.pending) continue;
      const production = ctx.sector === "ELECTRICITY" ? (ctx.electricityExportedEuMwh ?? 0) : ctx.productionQuantityT;
      weightedActual += impact.cctsPosition.actualIntensity * production;
      weightedTarget += impact.cctsPosition.targetIntensity * production;
      totalProduction += production;
    }
    const actualIntensity = totalProduction > 0 ? round(weightedActual / totalProduction, 4) : 0;
    const targetIntensity = totalProduction > 0 ? round(weightedTarget / totalProduction, 4) : null;
    cctsIntensity = { hasData: true, periodLabel: label, actualIntensity, targetIntensity, tone: cctsTone(targetIntensity, actualIntensity) };
  }

  // ---- 5. Facility comparison — latest submitted period per facility, only meaningful with 2+ facilities ----
  const latestPerFacility = new Map<string, (typeof financials)[number]>();
  for (const f of financials) {
    // financials is chronological (periodEnd asc), so the last write per
    // facility below is always that facility's most recent submission.
    latestPerFacility.set(f.ctx.facilityId, f);
  }
  const facilityComparison =
    facilities.length >= 2
      ? Array.from(latestPerFacility.values()).map(({ ctx, impact }) => ({
          facilityId: ctx.facilityId,
          facilityName: ctx.facility.name,
          actualSee: impact.actualSee,
          seeUnit: seeUnitFor(ctx.sector),
          periodLabel: periodLabel(ctx.periodStart, ctx.periodEnd),
        }))
      : [];

  // ---- 6. Year-over-year — cumulative emissions/liability, this year-to-date vs the same calendar window last year ----
  const now = new Date();
  const yearWindow = (year: number) => ({
    start: Date.UTC(year, 0, 1),
    end: Date.UTC(year, now.getUTCMonth(), now.getUTCDate(), 23, 59, 59),
  });
  const sumInWindow = (start: number, end: number) => {
    let emissions = 0;
    let liability = 0;
    for (const { ctx, impact } of financials) {
      const t = ctx.periodEnd.getTime();
      if (t < start || t > end) continue;
      emissions += ctx.calculationResult.totalEmissionsCbamAr5;
      liability += impact.grossLiabilityEur;
    }
    return { emissions, liability };
  };
  const thisYearWindow = yearWindow(now.getUTCFullYear());
  const lastYearWindow = yearWindow(now.getUTCFullYear() - 1);
  const thisYear = sumInWindow(thisYearWindow.start, thisYearWindow.end);
  const lastYear = sumInWindow(lastYearWindow.start, lastYearWindow.end);
  const pctDelta = (curr: number, prev: number): number | null => (prev > 0 ? round(((curr - prev) / prev) * 100, 1) : null);

  const yearOverYear =
    lastYear.emissions > 0
      ? {
          hasData: true as const,
          thisYear: { emissionsTco2e: round(thisYear.emissions), liabilityEur: round(thisYear.liability) },
          lastYear: { emissionsTco2e: round(lastYear.emissions), liabilityEur: round(lastYear.liability) },
          emissionsDeltaPct: pctDelta(thisYear.emissions, lastYear.emissions),
          liabilityDeltaPct: pctDelta(thisYear.liability, lastYear.liability),
        }
      : { hasData: false as const };

  // ---- BRSR Core section — only queried at all when the company holds an
  // active BRSR Core subscription, so a company that never bought the
  // module never shows an empty ESG section (and never pays for the query).
  const brsrSubscription = await prisma.subscription.findFirst({
    where: { companyId: company.id, tier: "BRSR_CORE_REPORTING", status: "ACTIVE" },
  });
  const brsr = brsrSubscription ? await getCompanyBrsrAnalytics(facilities, company) : null;

  return {
    facilityCount: facilities.length,
    emissionsTrend,
    liabilityTrend,
    currentCertificatePrice: { pricePerTonneEur: currentCertPrice.pricePerTonneEur, quarterLabel: currentCertPrice.quarterLabel },
    emissionsComposition,
    cctsIntensity,
    facilityComparison,
    yearOverYear,
    // null when there's no active BRSR Core subscription — the frontend
    // hides the whole ESG/BRSR section in that case rather than rendering
    // it with hasReports: false.
    brsr,
  };
};
