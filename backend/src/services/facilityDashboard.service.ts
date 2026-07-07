import { prisma } from "../config/prisma";
import type { Sector } from "@prisma/client";
import { requireOwnedFacility } from "./facility.service";
import { computeCbamFinancialImpact } from "./cbamFinancialImpact.service";
import type { ReportContext } from "./report.service";
import { DISCLOSED_ATTRIBUTE_COUNT } from "./brsrReport/build";
import {
  nextCbamDeadline,
  nextCctsDeadline,
  currentBrsrFyLabel,
  currentBrsrFyDeadline,
  daysUntil,
} from "../data/complianceDeadlines";

const round = (value: number, decimals = 2) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const quarterLabel = (date: Date): string => `Q${Math.floor(date.getUTCMonth() / 3) + 1} ${date.getUTCFullYear()}`;

const periodLabel = (start: Date, end: Date): string => {
  const fmt = (d: Date) => d.toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });
  return `${fmt(start)} – ${fmt(end)}`;
};

const seeUnitFor = (sector: Sector): string => (sector === "ELECTRICITY" ? "tCO2e/MWh" : "tCO2e/t");

export type CctsTone = "SURPLUS" | "ON_TRACK" | "DEFICIT" | "NO_TARGET";

/**
 * Green if actual intensity beats target by more than 5%, amber if within
 * 5% either side (roughly on track), red if missing target by more than 5%.
 */
const cctsTone = (target: number | null, actual: number): CctsTone => {
  if (target == null || target <= 0) return "NO_TARGET";
  const pctDelta = (target - actual) / target;
  if (pctDelta > 0.05) return "SURPLUS";
  if (pctDelta >= -0.05) return "ON_TRACK";
  return "DEFICIT";
};

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

  return {
    facility: { id: facility.id, name: facility.name, sector: facility.company.sector, productionRoute: facility.productionRoute },
    cbam,
    ccts,
    brsr,
    deadlines,
    emissionsBreakdown,
    liabilityTrend,
    intensityTrend,
    intensityTargetLine,
    recentActivity,
    hasEvidencePendingSubmissions,
  };
};
