import { prisma } from "../config/prisma";
import { requireOwnedFacility } from "./facility.service";
import { computeCbamFinancialImpact } from "./cbamFinancialImpact.service";
import { computeUkCbamFinancialImpact } from "./ukCbamFinancialImpact.service";
import { listCbamCertificatePriceHistory, listCccMarketPriceHistory } from "./certificatePriceHistory.service";
import { computeCctsCccMarketPosition, getCccMarketPriceStatus } from "./cctsMarketPosition.service";
import type { ReportContext } from "./report.service";
import { DISCLOSED_ATTRIBUTE_COUNT } from "./brsrReport/build";
import { round, quarterLabel, periodLabel, seeUnitFor, cctsTone, type CctsTone } from "./dashboardShared.helpers";
import {
  nextCbamDeadline,
  nextCbamAnnualDeclarationDeadline,
  nextUkCbamDeadline,
  nextCctsDeadline,
  nextCctsComplianceCycle,
  cctsComplianceYearFor,
  getCctsReportPeriodStatus,
  currentBrsrFyLabel,
  currentBrsrFyDeadline,
  daysUntil,
} from "../data/complianceDeadlines";

export type { CctsTone };

interface FeedItem {
  id: string;
  kind: "SUBMISSION" | "REPORT" | "VERIFICATION" | "ALERT";
  label: string;
  detail: string;
  timestamp: string;
}

/**
 * Everything the per-facility dashboard page needs, computed server-side —
 * the same convention as the CBAM/CCTS/BRSR PDF reports (cbamFinancialImpact.service.ts,
 * brsrCalculation.service.ts): one place owns the EU-default/GWP/certificate-price
 * business logic, the frontend just renders numbers it's handed.
 */
export const getFacilityDashboard = async (userId: string, facilityId: string) => {
  const facility = await requireOwnedFacility(userId, facilityId);

  const entries = await prisma.activityData.findMany({
    where: { facilityId, status: "SUBMITTED", calculationResult: { isNot: null } },
    include: {
      facility: { include: { company: { include: { owner: true } } } },
      calculationResult: true,
      _count: { select: { documents: { where: { documentType: "SUPPORTING_EVIDENCE" } } } },
    },
    orderBy: { periodEnd: "asc" },
  });

  // "Evidence Pending" — a SUBMITTED entry with no linked supporting
  // document. Computed on read (not stored) so it can never go stale: as
  // soon as a document is uploaded and linked, this flips false on its own.
  const evidencePendingFor = (entry: (typeof entries)[number]) => entry._count.documents === 0;
  const hasEvidencePendingSubmissions = entries.some(evidencePendingFor);
  const latestEvidencePending = entries.length > 0 ? evidencePendingFor(entries[entries.length - 1]) : false;

  // Draft facilities without a production route shouldn't happen for
  // submitted data in practice, but fall back to "OTHER" defensively rather
  // than letting getEuDefaultSee see a null — same fallback it already uses
  // internally for an unrecognised route.
  const contexts = entries.map((entry) => ({
    ...entry,
    facility: { ...entry.facility, productionRoute: entry.facility.productionRoute ?? "OTHER" },
  })) as unknown as ReportContext[];

  const financials = contexts.map((ctx) => ({ ctx, impact: computeCbamFinancialImpact(ctx, "CBAM") }));
  const latest = financials.at(-1) ?? null;

  // ---- Section 1, Card 1 — CBAM ----
  const cbam = latest
    ? {
        hasData: true as const,
        actualSee: latest.impact.actualSee,
        defaultSee: latest.impact.defaultSee,
        seeUnit: seeUnitFor(latest.ctx.sector),
        isBetterThanDefault: latest.impact.varianceIsBetterThanDefault,
        liabilityEur: latest.impact.grossLiabilityEur,
        certificatePrice: latest.impact.certificatePrice,
        certificatePriceQuarter: latest.impact.certificatePriceQuarter,
        periodLabel: periodLabel(latest.ctx.periodStart, latest.ctx.periodEnd),
        evidencePending: latestEvidencePending,
      }
    : { hasData: false as const };

  // ---- Section 1, Card 1b — UK CBAM ----
  // Shown only when the company carries UK_CBAM in cbamFrameworks. Kept as
  // its own card rather than folded into the CBAM card above: a company can
  // be in scope for both, the two count different emissions, and merging
  // them would present one number for two obligations. `applicable` is
  // decided here rather than in the frontend so the rule lives with the rest
  // of the regime logic.
  const ukCbamApplicable = facility.company.cbamFrameworks.includes("UK_CBAM");
  const ukCbam = !ukCbamApplicable
    ? { applicable: false as const }
    : latest
      ? (() => {
          const impact = computeUkCbamFinancialImpact(latest.ctx);
          const shared = {
            applicable: true as const,
            hasData: true as const,
            periodLabel: periodLabel(latest.ctx.periodStart, latest.ctx.periodEnd),
            evidencePending: latestEvidencePending,
          };
          if (impact.status === "OUT_OF_SCOPE") {
            return { ...shared, status: "OUT_OF_SCOPE" as const, reason: impact.reason };
          }
          if (impact.status === "RATE_PENDING") {
            return {
              ...shared,
              status: "RATE_PENDING" as const,
              emissionsTco2e: impact.emissionsTco2e,
              specificEmbeddedEmissions: impact.specificEmbeddedEmissions,
              excludedIndirectTco2e: impact.excludedIndirectTco2e,
              reason: impact.reason,
            };
          }
          return {
            ...shared,
            status: "CALCULATED" as const,
            emissionsTco2e: impact.emissionsTco2e,
            specificEmbeddedEmissions: impact.specificEmbeddedEmissions,
            excludedIndirectTco2e: impact.excludedIndirectTco2e,
            rateGbpPerTonne: impact.rateGbpPerTonne,
            rateQuarter: impact.rateQuarter,
            netLiabilityGbp: impact.netLiabilityGbp,
          };
        })()
      : { applicable: true as const, hasData: false as const };

  // ---- Section 1, Card 2 — CCTS ----
  const ccts = latest
    ? (() => {
        const pos = latest.impact.cctsPosition;
        const targetIntensity = pos.pending ? null : pos.targetIntensity;
        const actualIntensity = pos.pending ? latest.ctx.calculationResult.ghgIntensityCcts : pos.actualIntensity;
        return {
          hasData: true as const,
          actualIntensity: round(actualIntensity, 4),
          targetIntensity: targetIntensity != null ? round(targetIntensity, 4) : null,
          tone: cctsTone(targetIntensity, actualIntensity),
          deltaTco2e: pos.pending ? null : round(pos.deltaTco2e, 2),
          periodLabel: periodLabel(latest.ctx.periodStart, latest.ctx.periodEnd),
          evidencePending: latestEvidencePending,
        };
      })()
    : { hasData: false as const };

  // ---- Section 1, Card 3 — BRSR ----
  const now = new Date();
  const brsrFyLabel = currentBrsrFyLabel(now);
  const brsrReport = await prisma.brsrCoreReport.findUnique({
    where: { facilityId_reportingPeriod: { facilityId, reportingPeriod: brsrFyLabel } },
  });
  const brsr = {
    fyLabel: brsrFyLabel,
    status: !brsrReport ? ("NOT_STARTED" as const) : brsrReport.status === "SUBMITTED" ? ("SUBMITTED" as const) : ("DRAFT" as const),
    attributesFilled: brsrReport ? DISCLOSED_ATTRIBUTE_COUNT(brsrReport) : 0,
    attributesTotal: 9,
  };

  // ---- Section 2 — deadlines ----
  const deadlineInfo = (date: Date) => ({ deadline: date.toISOString(), daysRemaining: daysUntil(now, date) });
  const deadlines = {
    cbam: deadlineInfo(nextCbamDeadline(now)),
    cbamAnnual: deadlineInfo(nextCbamAnnualDeclarationDeadline(now)),
    ukCbam: deadlineInfo(nextUkCbamDeadline(now)),
    ccts: deadlineInfo(nextCctsDeadline(now)),
    brsr: deadlineInfo(currentBrsrFyDeadline(now)),
  };

  // ---- Section 3 — emissions breakdown (latest submitted period) ----
  const emissionsBreakdown = latest
    ? (() => {
        const r = latest.ctx.calculationResult;
        const combustion = round(r.directCombustionCo2eAr5);
        const process = round(r.directProcessCo2e + r.directPfcCo2eAr5 + r.directN2oProcessCo2eAr5);
        const indirect = round(r.indirectElectricityCo2e + r.indirectSteamCo2e);
        const precursors = round(r.directPrecursorCo2e);
        const total = round(combustion + process + indirect + precursors);
        const pct = (v: number) => (total > 0 ? round((v / total) * 100, 1) : 0);
        return {
          hasData: true as const,
          periodLabel: periodLabel(latest.ctx.periodStart, latest.ctx.periodEnd),
          totalTco2e: total,
          segments: [
            { label: "Scope 1 Combustion", valueTco2e: combustion, pct: pct(combustion) },
            { label: "Scope 1 Process", valueTco2e: process, pct: pct(process) },
            { label: "Scope 2 Indirect", valueTco2e: indirect, pct: pct(indirect) },
            { label: "Precursors", valueTco2e: precursors, pct: pct(precursors) },
          ],
        };
      })()
    : { hasData: false as const };

  // ---- Section 4 — CBAM liability trend, grouped by calendar quarter ----
  const liabilityByQuarter = new Map<string, { actual: number; default: number; sortKey: number }>();
  for (const { ctx, impact } of financials) {
    const label = quarterLabel(ctx.periodEnd);
    const sortKey = ctx.periodEnd.getUTCFullYear() * 4 + Math.floor(ctx.periodEnd.getUTCMonth() / 3);
    const production = ctx.sector === "ELECTRICITY" ? (ctx.electricityExportedEuMwh ?? 0) : ctx.productionQuantityT;
    const defaultLiabilityEur = impact.defaultSee * production * impact.certificatePrice;
    const bucket = liabilityByQuarter.get(label) ?? { actual: 0, default: 0, sortKey };
    bucket.actual += impact.grossLiabilityEur;
    bucket.default += defaultLiabilityEur;
    liabilityByQuarter.set(label, bucket);
  }
  const liabilityTrend = Array.from(liabilityByQuarter.entries())
    .sort((a, b) => a[1].sortKey - b[1].sortKey)
    .map(([label, v]) => ({
      quarterLabel: label,
      actualLiabilityEur: round(v.actual),
      defaultLiabilityEur: round(v.default),
    }));

  // ---- Section 5 — CCTS intensity trend, one point per submitted period ----
  const intensityTrend = financials.map(({ ctx, impact }) => {
    const pos = impact.cctsPosition;
    const actualIntensity = pos.pending ? ctx.calculationResult.ghgIntensityCcts : pos.actualIntensity;
    const targetIntensity = pos.pending ? null : pos.targetIntensity;
    return {
      periodLabel: periodLabel(ctx.periodStart, ctx.periodEnd),
      periodEnd: ctx.periodEnd.toISOString(),
      actualIntensity: round(actualIntensity, 4),
      targetIntensity: targetIntensity != null ? round(targetIntensity, 4) : null,
      aboveTarget: targetIntensity != null ? actualIntensity > targetIntensity : null,
    };
  });
  const latestWithTarget = [...financials].reverse().find((f) => !f.impact.cctsPosition.pending);
  const intensityTargetLine =
    latestWithTarget && !latestWithTarget.impact.cctsPosition.pending
      ? round(latestWithTarget.impact.cctsPosition.targetIntensity, 4)
      : null;

  // ---- Section 5b — CCC surplus/deficit position (latest submitted period) ----
  // The (target − achieved) × production arithmetic is NOT redone here: it is
  // read off latest.impact.cctsPosition, the same computed output the CCTS
  // report and the compliance strip already use. This only decides whether
  // the resulting credits can be given a rupee value yet.
  const cctsPosition = latest
    ? computeCctsCccMarketPosition(latest.impact.cctsPosition, now)
    : null;

  // ---- Section 5c — CCC market price ----
  // Company-independent, like the CBAM certificate price above: one market,
  // one price. Both the current status and the recorded history come from the
  // Emission Factor Manager's supersession chain, not a new data source.
  const cccMarketPrice = getCccMarketPriceStatus(now);
  const cccMarketPriceTrend = await listCccMarketPriceHistory();

  // ---- Section 5d — this facility's own multi-year target trajectory ----
  //
  // Deliberately the facility's *own* notified targets, one point per CCTS
  // compliance year, and nothing else. CCTS targets are notified per obligated
  // entity, not per sector, and this platform holds no verified sector-average
  // trajectory — so there is no sector curve to draw and none is drawn. A
  // compliance year with no target entered appears with targetIntensity null
  // rather than being interpolated between the years around it.
  //
  // The achieved figure beside it is an aggregation of numbers the engine has
  // already computed, not a recalculation: total CCTS-basis emissions over
  // total production for the year, which is the same ratio ghgIntensityCcts is
  // per period (identical denominator — production tonnes, or MWh exported for
  // electricity). Summing first is what makes the year's figure production-
  // weighted rather than a mean of ratios.
  const trajectoryByYear = new Map<
    string,
    { emissionsCctsTco2e: number; production: number; targetIntensity: number | null; periodCount: number }
  >();
  for (const { ctx, impact } of financials) {
    const complianceYear = cctsComplianceYearFor(ctx.periodEnd);
    const production = ctx.sector === "ELECTRICITY" ? (ctx.electricityExportedEuMwh ?? 0) : ctx.productionQuantityT;
    const bucket = trajectoryByYear.get(complianceYear) ?? {
      emissionsCctsTco2e: 0,
      production: 0,
      targetIntensity: null,
      periodCount: 0,
    };
    bucket.emissionsCctsTco2e += ctx.calculationResult.totalEmissionsCctsAr2Bur3;
    bucket.production += production;
    bucket.periodCount += 1;
    // Entries are ordered by periodEnd ascending, so the last target seen for
    // a year is the most recently entered one for that year.
    if (!impact.cctsPosition.pending) bucket.targetIntensity = impact.cctsPosition.targetIntensity;
    trajectoryByYear.set(complianceYear, bucket);
  }
  const cctsTargetTrajectory = Array.from(trajectoryByYear.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([complianceYear, v]) => ({
      complianceYear,
      targetIntensity: v.targetIntensity != null ? round(v.targetIntensity, 4) : null,
      achievedIntensity: v.production > 0 ? round(v.emissionsCctsTco2e / v.production, 4) : null,
      periodCount: v.periodCount,
    }));

  // ---- Section 5e — CCTS compliance cycle ----
  // Which FY the next 31 July deadline settles, and whether that year's
  // report can be generated yet — both from the existing regulatory calendar.
  const cctsCycle = nextCctsComplianceCycle(now);
  const cctsReportPeriod = getCctsReportPeriodStatus(now);
  const cctsCompliance = {
    complianceYear: cctsCycle.complianceYear,
    deadline: cctsCycle.deadline.toISOString(),
    daysRemaining: daysUntil(now, cctsCycle.deadline),
    reportPeriod: cctsReportPeriod.displayLabel,
    reportWindowIsOpen: cctsReportPeriod.isOpen,
    reportWindowOpens: cctsReportPeriod.windowStart.toISOString(),
    reportWindowCloses: cctsReportPeriod.windowEnd.toISOString(),
  };

  // ---- Section 6 — recent activity feed ----
  const feedItems: FeedItem[] = entries.map((entry) => ({
    id: `submission:${entry.id}`,
    kind: "SUBMISSION",
    label: "Activity data submitted",
    detail: periodLabel(entry.periodStart!, entry.periodEnd!),
    timestamp: entry.updatedAt.toISOString(),
  }));

  const verificationRequests = await prisma.verificationRequest.findMany({
    where: { activityData: { facilityId } },
    include: { verifier: true },
  });
  for (const vr of verificationRequests) {
    if (vr.verifierId && !vr.decidedAt) {
      feedItems.push({
        id: `verify-claim:${vr.id}`,
        kind: "VERIFICATION",
        label: "Verifier claimed for review",
        detail: vr.verifierOrg ?? vr.verifier?.name ?? "Verifier",
        timestamp: vr.updatedAt.toISOString(),
      });
    }
    if (vr.decidedAt) {
      feedItems.push({
        id: `verify-decide:${vr.id}`,
        kind: "VERIFICATION",
        label: vr.status === "APPROVED" ? "Verification approved" : "Verification rejected",
        detail: vr.verifierOrg ?? vr.verifier?.name ?? "Verifier",
        timestamp: vr.decidedAt.toISOString(),
      });
    }
  }

  const notifications = await prisma.notification.findMany({
    where: { facilityId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  for (const n of notifications) {
    feedItems.push({ id: `alert:${n.id}`, kind: "ALERT", label: n.title, detail: n.body, timestamp: n.createdAt.toISOString() });
  }

  const auditLogs = await prisma.auditLog.findMany({
    where: { facilityId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  for (const log of auditLogs) {
    feedItems.push({ id: `audit:${log.id}`, kind: "REPORT", label: "Report generated", detail: log.detail, timestamp: log.createdAt.toISOString() });
  }

  const recentActivity = feedItems
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 5);

  // ---- Cross-check summary — a submission counts as "cross-checked" once
  // every one of its supporting-evidence documents has a MATCHED review.
  const crossCheckableEntries = await prisma.activityData.findMany({
    where: { facilityId, status: "SUBMITTED", documents: { some: { documentType: "SUPPORTING_EVIDENCE" } } },
    select: {
      documents: {
        where: { documentType: "SUPPORTING_EVIDENCE" },
        select: { crossCheckReview: { select: { status: true } } },
      },
    },
  });
  const crossCheckSummary = {
    total: crossCheckableEntries.length,
    matched: crossCheckableEntries.filter((e) => e.documents.every((d) => d.crossCheckReview?.status === "MATCHED")).length,
  };

  // ---- CBAM certificate price history — the Emission Factor Manager's
  // supersession chain, not a new data source. Company-independent (the
  // Commission publishes one price), so it is read here rather than derived
  // per facility, and the frontend shows it only under the CBAM tier.
  const certificatePriceTrend = await listCbamCertificatePriceHistory();

  return {
    facility: { id: facility.id, name: facility.name, sector: facility.company.sector, productionRoute: facility.productionRoute },
    cbam,
    ukCbam,
    certificatePriceTrend,
    ccts,
    brsr,
    deadlines,
    emissionsBreakdown,
    liabilityTrend,
    intensityTrend,
    intensityTargetLine,
    cctsPosition,
    cccMarketPrice,
    cccMarketPriceTrend,
    cctsTargetTrajectory,
    cctsCompliance,
    recentActivity,
    hasEvidencePendingSubmissions,
    crossCheckSummary,
    // Equivalent to "some SUPPORTING_EVIDENCE document isn't MATCHED" — every
    // submission counted in crossCheckSummary.total that isn't in .matched
    // has at least one document short of MATCHED, and vice versa. See
    // reportGeneration.service.ts's hasUncrossCheckedEvidence, which this
    // mirrors for gating the "Generate Report" button's disabled state.
    hasUncrossCheckedEvidence: crossCheckSummary.matched < crossCheckSummary.total,
  };
};
