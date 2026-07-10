import { prisma } from "../config/prisma";
import { requireMyCompany } from "./company.service";
import { computeCbamFinancialImpact } from "./cbamFinancialImpact.service";
import type { ReportContext } from "./report.service";
import { getCbamCertificatePrice } from "../data/cbamReferenceData";
import { round, quarterLabel, quarterSortKey, periodLabel, seeUnitFor, cctsTone } from "./dashboardShared.helpers";

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

  return {
    facilityCount: facilities.length,
    emissionsTrend,
    liabilityTrend,
    currentCertificatePrice: { pricePerTonneEur: currentCertPrice.pricePerTonneEur, quarterLabel: currentCertPrice.quarterLabel },
    emissionsComposition,
    cctsIntensity,
    facilityComparison,
    yearOverYear,
  };
};
