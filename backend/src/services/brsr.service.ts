import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";
import { requireOwnedFacility } from "./facility.service";
import { buildBrsrCoreMetrics } from "./brsrCalculation.service";
import { isBrsrReportWindowOpen, brsrUnlockDate } from "../data/complianceDeadlines";

const fmtUnlockDate = (d: Date) => d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

// The actual security boundary — same pattern as CBAM/CCTS's
// requireReportWindowOpen in report.service.ts. BRSR Core is annual, so
// unlike CBAM/CCTS's recurring calendar window, each reporting period gets
// its own fixed one-time unlock date (see complianceDeadlines.ts).
const requireBrsrReportWindowOpen = (reportingPeriod: string, now: Date = new Date()): void => {
  if (!isBrsrReportWindowOpen(reportingPeriod, now)) {
    throw AppError.forbidden(
      `Report generation for ${reportingPeriod} opens on ${fmtUnlockDate(brsrUnlockDate(reportingPeriod))}`,
      "REPORT_WINDOW_CLOSED",
    );
  }
};

// Deliberately decoupled from the zod-inferred validator types — both the
// strict (submit) and permissive (draft) schemas produce values assignable
// to this shape (optional vs. nullable numbers both collapse to `?? null`
// below), so the service doesn't need to know which one validated the request.
export interface BrsrCoreDataInput {
  reportingPeriod: string;
  turnoverInr?: number | null;
  waterWithdrawnKl?: number | null;
  waterDischargedKl?: number | null;
  wasteGeneratedTonnes?: number | null;
  wasteRecoveredTonnes?: number | null;
  renewableEnergyConsumptionGj?: number | null;
  nonRenewableEnergyConsumptionGj?: number | null;
  employeeCountTotal?: number | null;
  employeeCountFemale?: number | null;
  wagesPaidMaleInr?: number | null;
  wagesPaidFemaleInr?: number | null;
  safetyIncidentsCount?: number | null;
  womenInWorkforcePct?: number | null;
  womenInManagementPct?: number | null;
  procurementFromMsmePct?: number | null;
  purchasesFromTop10SuppliersPct?: number | null;
  salesToTop10CustomersPct?: number | null;
  consumerComplaintsCount?: number | null;
  consumerComplaintsResolvedPct?: number | null;
  notes?: string | null;
}

export const listBrsrReports = async (userId: string, facilityId: string) => {
  await requireOwnedFacility(userId, facilityId);
  return prisma.brsrCoreReport.findMany({
    where: { facilityId },
    orderBy: { reportingPeriod: "desc" },
  });
};

const requireOwnedBrsrReport = async (userId: string, facilityId: string, reportingPeriod: string) => {
  await requireOwnedFacility(userId, facilityId);

  const report = await prisma.brsrCoreReport.findUnique({
    where: { facilityId_reportingPeriod: { facilityId, reportingPeriod } },
  });
  if (!report) {
    throw AppError.notFound("BRSR Core disclosure not found for this facility and reporting period");
  }
  return report;
};

/**
 * Single draft/submit endpoint for BRSR Core's manual disclosure fields —
 * upserts on the (facilityId, reportingPeriod) natural key rather than the
 * separate create/draft/submit-by-id endpoints ActivityData uses, since BRSR
 * Core has exactly one row per facility per financial year rather than
 * multiple drafts in flight.
 */
export const saveBrsrCoreData = async (
  userId: string,
  facilityId: string,
  input: BrsrCoreDataInput,
  submit: boolean,
) => {
  const facility = await requireOwnedFacility(userId, facilityId);

  const existing = await prisma.brsrCoreReport.findUnique({
    where: { facilityId_reportingPeriod: { facilityId, reportingPeriod: input.reportingPeriod } },
  });

  if (existing && existing.status === "SUBMITTED" && !submit) {
    // Already submitted, and this call isn't a (re-)submission — matches
    // ActivityData's autosave guard: a submitted entry can't be silently
    // autosaved over, only explicitly resubmitted.
    throw AppError.badRequest(
      "This BRSR Core disclosure has already been submitted — resubmit explicitly to edit it",
      "BRSR_REPORT_NOT_DRAFT",
    );
  }

  const data = {
    companyId: facility.companyId,
    facilityId,
    reportingPeriod: input.reportingPeriod,
    turnoverInr: input.turnoverInr ?? null,
    waterWithdrawnKl: input.waterWithdrawnKl ?? null,
    waterDischargedKl: input.waterDischargedKl ?? null,
    wasteGeneratedTonnes: input.wasteGeneratedTonnes ?? null,
    wasteRecoveredTonnes: input.wasteRecoveredTonnes ?? null,
    renewableEnergyConsumptionGj: input.renewableEnergyConsumptionGj ?? null,
    nonRenewableEnergyConsumptionGj: input.nonRenewableEnergyConsumptionGj ?? null,
    employeeCountTotal: input.employeeCountTotal ?? null,
    employeeCountFemale: input.employeeCountFemale ?? null,
    wagesPaidMaleInr: input.wagesPaidMaleInr ?? null,
    wagesPaidFemaleInr: input.wagesPaidFemaleInr ?? null,
    safetyIncidentsCount: input.safetyIncidentsCount ?? null,
    womenInWorkforcePct: input.womenInWorkforcePct ?? null,
    womenInManagementPct: input.womenInManagementPct ?? null,
    procurementFromMsmePct: input.procurementFromMsmePct ?? null,
    purchasesFromTop10SuppliersPct: input.purchasesFromTop10SuppliersPct ?? null,
    salesToTop10CustomersPct: input.salesToTop10CustomersPct ?? null,
    consumerComplaintsCount: input.consumerComplaintsCount ?? null,
    consumerComplaintsResolvedPct: input.consumerComplaintsResolvedPct ?? null,
    notes: input.notes || null,
    status: (submit ? "SUBMITTED" : "DRAFT") as "SUBMITTED" | "DRAFT",
  };

  return prisma.brsrCoreReport.upsert({
    where: { facilityId_reportingPeriod: { facilityId, reportingPeriod: input.reportingPeriod } },
    create: data,
    update: data,
  });
};

export const getBrsrReportData = async (userId: string, facilityId: string, reportingPeriod: string) => {
  const report = await requireOwnedBrsrReport(userId, facilityId, reportingPeriod);

  const facility = await prisma.facility.findUniqueOrThrow({
    where: { id: facilityId },
    include: { company: true },
  });

  if (report.status !== "SUBMITTED") {
    throw AppError.badRequest("Submit this BRSR Core disclosure before generating a report", "BRSR_REPORT_NOT_SUBMITTED");
  }
  requireBrsrReportWindowOpen(reportingPeriod);

  const metrics = await buildBrsrCoreMetrics(report, facility, facility.company);
  return { report, facility, metrics };
};

export const getBrsrReportContextById = async (userId: string, reportId: string) => {
  const report = await prisma.brsrCoreReport.findUnique({
    where: { id: reportId },
    include: {
      facility: { include: { company: { include: { owner: true } } } },
      verificationRequest: { include: { verifier: true } },
    },
  });

  if (!report || report.facility.company.ownerId !== userId) {
    throw AppError.notFound("BRSR Core report not found");
  }
  if (report.status !== "SUBMITTED") {
    throw AppError.badRequest("Submit this BRSR Core disclosure before generating a report", "BRSR_REPORT_NOT_SUBMITTED");
  }
  requireBrsrReportWindowOpen(report.reportingPeriod);

  const metrics = await buildBrsrCoreMetrics(report, report.facility, report.facility.company);
  return { report, facility: report.facility, metrics };
};
