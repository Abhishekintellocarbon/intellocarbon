import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";
import { requireOwnedFacility } from "./facility.service";
import { buildIssbS1S2Metrics } from "./issbCalculation.service";
import { isIssbReportWindowOpen, issbUnlockDate } from "../data/complianceDeadlines";

const fmtUnlockDate = (d: Date) => d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

// The actual security boundary — same pattern as BRSR Core's
// requireBrsrReportWindowOpen in brsr.service.ts.
const requireIssbReportWindowOpen = (reportingPeriod: string, now: Date = new Date()): void => {
  if (!isIssbReportWindowOpen(reportingPeriod, now)) {
    throw AppError.forbidden(
      `Report generation for ${reportingPeriod} opens on ${fmtUnlockDate(issbUnlockDate(reportingPeriod))}`,
      "REPORT_WINDOW_CLOSED",
    );
  }
};

// Deliberately decoupled from the zod-inferred validator types — both the
// strict (submit) and permissive (draft) schemas produce values assignable
// to this shape, matching BrsrCoreDataInput's rationale.
export interface IssbS1S2DataInput {
  reportingPeriod: string;
  governanceBodyOversight?: string | null;
  managementRole?: string | null;
  climateRisksOpportunities?: string | null;
  businessModelImpact?: string | null;
  financialEffects?: string | null;
  scenarioAnalysisResilience?: string | null;
  riskIdentificationProcess?: string | null;
  riskManagementProcess?: string | null;
  riskIntegrationOverall?: string | null;
  scope3Tco2e?: number | null;
  targetDescription?: string | null;
  targetYear?: number | null;
  baselineYear?: number | null;
  baselineEmissionsTco2e?: number | null;
  transitionPlan?: string | null;
  internalCarbonPriceInr?: number | null;
  climateCapexInr?: number | null;
  notes?: string | null;
}

export const listIssbReports = async (userId: string, facilityId: string) => {
  await requireOwnedFacility(userId, facilityId);
  return prisma.issbS1S2Report.findMany({
    where: { facilityId },
    orderBy: { reportingPeriod: "desc" },
  });
};

const requireOwnedIssbReport = async (userId: string, facilityId: string, reportingPeriod: string) => {
  await requireOwnedFacility(userId, facilityId);

  const report = await prisma.issbS1S2Report.findUnique({
    where: { facilityId_reportingPeriod: { facilityId, reportingPeriod } },
  });
  if (!report) {
    throw AppError.notFound("ISSB IFRS S1/S2 disclosure not found for this facility and reporting period");
  }
  return report;
};

/**
 * Single draft/submit endpoint for ISSB's manual disclosure fields — upserts
 * on the (facilityId, reportingPeriod) natural key, matching BRSR Core's
 * saveBrsrCoreData exactly (one row per facility per financial year).
 */
export const saveIssbS1S2Data = async (
  userId: string,
  facilityId: string,
  input: IssbS1S2DataInput,
  submit: boolean,
) => {
  const facility = await requireOwnedFacility(userId, facilityId);

  const existing = await prisma.issbS1S2Report.findUnique({
    where: { facilityId_reportingPeriod: { facilityId, reportingPeriod: input.reportingPeriod } },
  });

  if (existing && existing.status === "SUBMITTED" && !submit) {
    throw AppError.badRequest(
      "This ISSB IFRS S1/S2 disclosure has already been submitted — resubmit explicitly to edit it",
      "ISSB_REPORT_NOT_DRAFT",
    );
  }

  const data = {
    companyId: facility.companyId,
    facilityId,
    reportingPeriod: input.reportingPeriod,
    governanceBodyOversight: input.governanceBodyOversight || null,
    managementRole: input.managementRole || null,
    climateRisksOpportunities: input.climateRisksOpportunities || null,
    businessModelImpact: input.businessModelImpact || null,
    financialEffects: input.financialEffects || null,
    scenarioAnalysisResilience: input.scenarioAnalysisResilience || null,
    riskIdentificationProcess: input.riskIdentificationProcess || null,
    riskManagementProcess: input.riskManagementProcess || null,
    riskIntegrationOverall: input.riskIntegrationOverall || null,
    scope3Tco2e: input.scope3Tco2e ?? null,
    targetDescription: input.targetDescription || null,
    targetYear: input.targetYear ?? null,
    baselineYear: input.baselineYear ?? null,
    baselineEmissionsTco2e: input.baselineEmissionsTco2e ?? null,
    transitionPlan: input.transitionPlan || null,
    internalCarbonPriceInr: input.internalCarbonPriceInr ?? null,
    climateCapexInr: input.climateCapexInr ?? null,
    notes: input.notes || null,
    status: (submit ? "SUBMITTED" : "DRAFT") as "SUBMITTED" | "DRAFT",
  };

  return prisma.issbS1S2Report.upsert({
    where: { facilityId_reportingPeriod: { facilityId, reportingPeriod: input.reportingPeriod } },
    create: data,
    update: data,
  });
};

export const getIssbReportData = async (userId: string, facilityId: string, reportingPeriod: string) => {
  const report = await requireOwnedIssbReport(userId, facilityId, reportingPeriod);

  const facility = await prisma.facility.findUniqueOrThrow({
    where: { id: facilityId },
    include: { company: true },
  });

  if (report.status !== "SUBMITTED") {
    throw AppError.badRequest(
      "Submit this ISSB IFRS S1/S2 disclosure before generating a report",
      "ISSB_REPORT_NOT_SUBMITTED",
    );
  }
  requireIssbReportWindowOpen(reportingPeriod);

  const metrics = await buildIssbS1S2Metrics(report, facility, facility.company);
  return { report, facility, metrics };
};

export const getIssbReportContextById = async (userId: string, reportId: string) => {
  const report = await prisma.issbS1S2Report.findUnique({
    where: { id: reportId },
    include: {
      facility: { include: { company: { include: { owner: true } } } },
    },
  });

  if (!report || report.facility.company.ownerId !== userId) {
    throw AppError.notFound("ISSB IFRS S1/S2 report not found");
  }
  if (report.status !== "SUBMITTED") {
    throw AppError.badRequest(
      "Submit this ISSB IFRS S1/S2 disclosure before generating a report",
      "ISSB_REPORT_NOT_SUBMITTED",
    );
  }
  requireIssbReportWindowOpen(report.reportingPeriod);

  const metrics = await buildIssbS1S2Metrics(report, report.facility, report.facility.company);
  return { report, facility: report.facility, metrics };
};
