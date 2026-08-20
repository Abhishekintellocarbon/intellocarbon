import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";
import { loadReportPhase2Data } from "./reportSections/phase2Data";
import { requireOwnedFacilityForEsgBundle, throwEsgBundleAccessDenied } from "./esgBundleAccess.service";
import { isGriReportWindowOpen, griUnlockDate } from "../data/complianceDeadlines";
import { CDP_MODULES, getCdpModule } from "../data/cdpQuestionnaire";
import {
  buildCdpMetrics,
  moduleLabel,
  CDP_REPORT_INCLUDE,
  type CdpReportWithRelations,
} from "./cdpCalculation.service";
import { assessCdpMaturity } from "./cdpMaturity.service";
import { buildResponseIndex } from "./cdpResponseIndex.service";
import { parseModulePayload, type CdpDataInput } from "../validators/cdp.validators";

const fmtUnlockDate = (d: Date) => d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

/**
 * Report generation opens once the reporting year it covers has ended.
 *
 * This is NOT a CDP deadline — CDP has none that this platform could enforce.
 * Deadlines are set by CDP and by whichever customer or investor requested the
 * response, and they vary per requester. What this gate protects is arithmetic:
 * a response stating a full year's Scope 1 emissions before that year has
 * finished would understate them, and the number would go to a buyer.
 *
 * Named locally rather than calling the GRI helper directly so the two can
 * diverge — CDP's window is about data completeness, GRI's is about a filing
 * cycle, and they only coincide today.
 */
const requireCdpReportWindowOpen = (reportingPeriod: string, now: Date = new Date()): void => {
  if (!isGriReportWindowOpen(reportingPeriod, now)) {
    throw AppError.forbidden(
      `The reporting year ${reportingPeriod} has not finished — report generation opens on ${fmtUnlockDate(griUnlockDate(reportingPeriod))}`,
      "REPORT_WINDOW_CLOSED",
    );
  }
};

const requireDraft = (report: { status: string } | null, allow: boolean): void => {
  if (report && report.status === "SUBMITTED" && !allow) {
    throw AppError.badRequest(
      "This CDP response has already been marked complete — resubmit explicitly to edit it",
      "CDP_REPORT_NOT_DRAFT",
    );
  }
};

const upsertReportShell = async (companyId: string, facilityId: string, reportingPeriod: string) =>
  prisma.cdpReport.upsert({
    where: { facilityId_reportingPeriod: { facilityId, reportingPeriod } },
    create: { companyId, facilityId, reportingPeriod },
    update: {},
  });

export const listCdpReports = async (userId: string, facilityId: string) => {
  await requireOwnedFacilityForEsgBundle(userId, facilityId);
  return prisma.cdpReport.findMany({
    where: { facilityId },
    orderBy: { reportingPeriod: "desc" },
    include: {
      _count: { select: { risks: true, targets: true, breakdownRows: true } },
    },
  });
};

// ---------------------------------------------------------------------------
// Answer entry
// ---------------------------------------------------------------------------

const moduleDelegate = (relation: string) => {
  const delegates: Record<string, { upsert: (args: unknown) => Promise<unknown> }> = {
    introduction: prisma.cdpIntroduction as never,
    governance: prisma.cdpGovernance as never,
    risksOpportunities: prisma.cdpRisksOpportunities as never,
    businessStrategy: prisma.cdpBusinessStrategy as never,
    targetsPerformance: prisma.cdpTargetsPerformance as never,
    emissionsMethodology: prisma.cdpEmissionsMethodology as never,
    emissionsData: prisma.cdpEmissionsData as never,
    emissionsBreakdownModule: prisma.cdpEmissionsBreakdownModule as never,
    energy: prisma.cdpEnergy as never,
    additionalMetrics: prisma.cdpAdditionalMetrics as never,
    verification: prisma.cdpVerification as never,
    carbonPricing: prisma.cdpCarbonPricing as never,
    engagement: prisma.cdpEngagement as never,
    signoff: prisma.cdpSignoff as never,
  };
  return delegates[relation];
};

const normalise = (value: unknown): unknown => (value === "" || value === undefined ? null : value);

const normaliseRow = (payload: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(payload).map(([k, v]) => [k, normalise(v)]));

/**
 * Saves CDP module answers and the repeating blocks.
 *
 * Unlike GRI and CSRD there is no materiality gate to enforce — CDP asks every
 * responding company every question in the questionnaire it issues, so no
 * module is conditionally locked. What this does enforce is that a response
 * marked complete is at least identifiable and signed, since an anonymous
 * response is not something a buyer can act on. Everything beyond that is
 * allowed to be incomplete: CDP itself accepts partial responses and scores
 * them accordingly, so refusing to save one would be stricter than CDP and
 * would leave a responder with nothing to send.
 */
export const saveCdpData = async (userId: string, facilityId: string, input: CdpDataInput, submit: boolean) => {
  const facility = await requireOwnedFacilityForEsgBundle(userId, facilityId);

  const existing = await prisma.cdpReport.findUnique({
    where: { facilityId_reportingPeriod: { facilityId, reportingPeriod: input.reportingPeriod } },
  });
  requireDraft(existing, submit);

  const report = await upsertReportShell(facility.companyId, facilityId, input.reportingPeriod);

  // Only written when the key is actually present. The draft convention is
  // that an autosave carries every field with null meaning "cleared", so a
  // full payload still clears correctly — but a partial call (one module, or
  // an API client sending only what it changed) must not silently wipe the
  // fields it did not mention. Writing unconditionally does exactly that, and
  // it is invisible until someone notices a number has vanished.
  await prisma.cdpReport.update({
    where: { id: report.id },
    data: {
      ...("revenue" in input ? { revenue: normalise(input.revenue) as number | null } : {}),
      ...("notes" in input ? { notes: (normalise(input.notes) as string | null) ?? null } : {}),
      status: submit ? "SUBMITTED" : "DRAFT",
    },
  });

  for (const [moduleCode, payload] of Object.entries(input.modules ?? {})) {
    const module = getCdpModule(moduleCode);
    if (!module) throw AppError.badRequest(`Unknown CDP module "${moduleCode}"`, "CDP_UNKNOWN_MODULE");

    const parsed = parseModulePayload(moduleCode, payload, submit);
    if (!parsed.success) throw AppError.badRequest(parsed.message, "VALIDATION_ERROR");

    const data = normaliseRow(parsed.data);
    await moduleDelegate(module.relation).upsert({
      where: { cdpReportId: report.id },
      create: { cdpReportId: report.id, ...data },
      update: data,
    });
  }

  // Full replace per block, and only for blocks the payload actually carries.
  // The client always sends the complete list for a block it touched, and
  // diffing would leave orphans when a row is removed — but an absent key
  // means "not mentioned", not "delete them all", which is the same partial
  // save rule the scalar fields above follow.
  await prisma.$transaction(async (tx) => {
    if (input.risks) {
      await tx.cdpRisk.deleteMany({ where: { cdpReportId: report.id } });
      if (input.risks.length > 0) {
        await tx.cdpRisk.createMany({
          data: input.risks.map((risk) => ({
            cdpReportId: report.id,
            kind: risk.kind,
            riskType: risk.riskType,
            description: risk.description,
            valueChainStage: (normalise(risk.valueChainStage) as string | null) ?? null,
            timeHorizon: (normalise(risk.timeHorizon) as "SHORT_TERM" | "MEDIUM_TERM" | "LONG_TERM" | null) ?? null,
            likelihood: (normalise(risk.likelihood) as string | null) ?? null,
            magnitude: (normalise(risk.magnitude) as string | null) ?? null,
            financialImpactMin: (normalise(risk.financialImpactMin) as number | null) ?? null,
            financialImpactMax: (normalise(risk.financialImpactMax) as number | null) ?? null,
            impactDescription: (normalise(risk.impactDescription) as string | null) ?? null,
            responseStrategy: (normalise(risk.responseStrategy) as string | null) ?? null,
            responseCost: (normalise(risk.responseCost) as number | null) ?? null,
          })),
        });
      }
    }

    if (input.targets) {
      await tx.cdpTarget.deleteMany({ where: { cdpReportId: report.id } });
      if (input.targets.length > 0) {
        await tx.cdpTarget.createMany({
          data: input.targets.map((target) => ({
            cdpReportId: report.id,
            kind: target.kind,
            scopesCovered: target.scopesCovered,
            baseYear: target.baseYear,
            baseYearEmissionsTco2e: (normalise(target.baseYearEmissionsTco2e) as number | null) ?? null,
            targetYear: target.targetYear,
            reductionPct: (normalise(target.reductionPct) as number | null) ?? null,
            intensityMetric: (normalise(target.intensityMetric) as string | null) ?? null,
            baseYearIntensity: (normalise(target.baseYearIntensity) as number | null) ?? null,
            targetIntensity: (normalise(target.targetIntensity) as number | null) ?? null,
            percentAchieved: (normalise(target.percentAchieved) as number | null) ?? null,
            isScienceBased: target.isScienceBased ?? false,
            description: (normalise(target.description) as string | null) ?? null,
          })),
        });
      }
    }

    if (input.breakdownRows) {
      await tx.cdpEmissionsBreakdown.deleteMany({ where: { cdpReportId: report.id } });
      if (input.breakdownRows.length > 0) {
        await tx.cdpEmissionsBreakdown.createMany({
          data: input.breakdownRows.map((row) => ({
            cdpReportId: report.id,
            dimension: row.dimension,
            scope: row.scope ?? "SCOPE_1",
            label: row.label,
            emissionsTco2e: row.emissionsTco2e,
          })),
        });
      }
    }
  });

  if (submit) await requireSubmittable(report.id);

  return loadReport(report.id);
};

/**
 * The minimum for a response to be marked complete.
 *
 * Deliberately short. A CDP response is graded on completeness by CDP, not
 * gated on it — a responder who can only answer half the questionnaire is
 * still better off submitting that half than submitting nothing, and the
 * maturity indicator already tells them exactly what is thin. So the only
 * things required here are the two that make the document usable at all:
 * who is responding, and who signed it off.
 */
const requireSubmittable = async (reportId: string): Promise<void> => {
  const report = await loadReport(reportId);
  const missing: string[] = [];

  if (!report.introduction?.organizationDescription?.trim()) {
    missing.push("C0.1 — a description of the organization");
  }
  if (!report.signoff?.submitterJobTitle?.trim()) {
    missing.push("C15.1 — the job title of the person submitting this response");
  }

  if (missing.length > 0) {
    throw AppError.badRequest(
      `A CDP response needs at least the following before it can be marked complete: ${missing.join("; ")}`,
      "CDP_RESPONSE_INCOMPLETE",
    );
  }
};

const loadReport = async (id: string): Promise<CdpReportWithRelations> => {
  const report = await prisma.cdpReport.findUnique({ where: { id }, include: CDP_REPORT_INCLUDE });
  if (!report) throw AppError.notFound("CDP response not found");
  return report;
};

// ---------------------------------------------------------------------------
// Retrieval
// ---------------------------------------------------------------------------

export const getCdpDraft = async (userId: string, facilityId: string, reportingPeriod: string) => {
  const facility = await requireOwnedFacilityForEsgBundle(userId, facilityId);
  const report = await prisma.cdpReport.findUnique({
    where: { facilityId_reportingPeriod: { facilityId, reportingPeriod } },
    include: CDP_REPORT_INCLUDE,
  });
  if (!report) return { report: null, metrics: null, maturity: null };

  const metrics = await buildCdpMetrics(report, facility, facility.company);
  return { report, metrics, maturity: assessCdpMaturity(report, metrics) };
};

export const getCdpReportData = async (userId: string, facilityId: string, reportingPeriod: string) => {
  const facility = await requireOwnedFacilityForEsgBundle(userId, facilityId);

  const report = await prisma.cdpReport.findUnique({
    where: { facilityId_reportingPeriod: { facilityId, reportingPeriod } },
    include: CDP_REPORT_INCLUDE,
  });
  if (!report) throw AppError.notFound("CDP response not found for this facility and reporting period");
  if (report.status !== "SUBMITTED") {
    throw AppError.badRequest("Mark this CDP response complete before generating it", "CDP_REPORT_NOT_SUBMITTED");
  }
  requireCdpReportWindowOpen(reportingPeriod);

  const metrics = await buildCdpMetrics(report, facility, facility.company);
  const maturity = assessCdpMaturity(report, metrics);
  const phase2 = await loadReportPhase2Data(facility.companyId, facility.id, reportingPeriod);
  return { report, facility, metrics, maturity, phase2, responseIndex: buildResponseIndex(report, metrics, maturity) };
};

export const getCdpReportContextById = async (userId: string, reportId: string) => {
  const report = await prisma.cdpReport.findUnique({
    where: { id: reportId },
    include: {
      ...CDP_REPORT_INCLUDE,
      facility: {
        include: {
          company: {
            include: {
              owner: true,
              subscriptions: { where: { status: "ACTIVE", tier: "BRSR_CORE_REPORTING" }, select: { id: true } },
            },
          },
        },
      },
    },
  });

  if (!report || report.facility.company.ownerId !== userId) {
    throw AppError.notFound("CDP response not found");
  }
  if (report.facility.company.subscriptions.length === 0) throwEsgBundleAccessDenied();
  if (report.status !== "SUBMITTED") {
    throw AppError.badRequest("Mark this CDP response complete before generating it", "CDP_REPORT_NOT_SUBMITTED");
  }
  requireCdpReportWindowOpen(report.reportingPeriod);

  const metrics = await buildCdpMetrics(report, report.facility, report.facility.company);
  const maturity = assessCdpMaturity(report, metrics);
  const phase2 = await loadReportPhase2Data(report.facility.companyId, report.facility.id, report.reportingPeriod);
  return {
    report,
    facility: report.facility,
    metrics,
    maturity,
    phase2,
    responseIndex: buildResponseIndex(report, metrics, maturity),
  };
};

/** Exposed for the overview rollup, which needs module counts without loading every row. */
export const cdpModuleCount = CDP_MODULES.length;

export { moduleLabel };
