import type { ReportType, SubscriptionTier } from "@prisma/client";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";
import { requireOwnedFacility } from "./facility.service";
import { generateReportPdf, type ReportContext } from "./report.service";
import { buildBrsrCoreMetrics } from "./brsrCalculation.service";
import { buildBrsrCorePdf } from "./brsrReport/build";
import { logFacilityAudit } from "./auditLog.service";
import {
  getCbamReportPeriodStatus,
  getCctsReportPeriodStatus,
  getBrsrReportPeriodStatus,
  type ReportPeriodStatus,
} from "../data/complianceDeadlines";

const pdfToBuffer = (doc: PDFKit.PDFDocument): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });

const TIER_GRANTS: Record<ReportType, SubscriptionTier[]> = {
  CBAM: ["CBAM_COMPLIANCE", "CBAM_PLUS_CCTS"],
  CCTS: ["CCTS_COMPLIANCE", "CBAM_PLUS_CCTS"],
  BRSR: ["BRSR_CORE_REPORTING"],
};

const hasAccess = async (companyId: string, reportType: ReportType): Promise<boolean> => {
  const active = await prisma.subscription.findMany({ where: { companyId, status: "ACTIVE" } });
  const tiers = new Set(active.map((s) => s.tier));
  return TIER_GRANTS[reportType].some((t) => tiers.has(t));
};

const periodStatusFor = (reportType: ReportType, now: Date): ReportPeriodStatus => {
  if (reportType === "CBAM") return getCbamReportPeriodStatus(now);
  if (reportType === "CCTS") return getCctsReportPeriodStatus(now);
  return getBrsrReportPeriodStatus(now);
};

/** Any SUBMITTED activity_data entry for this facility with no linked supporting document blocks report generation entirely, not just its own period. */
const hasEvidencePendingSubmissions = async (facilityId: string): Promise<boolean> => {
  const pendingCount = await prisma.activityData.count({
    where: {
      facilityId,
      status: "SUBMITTED",
      documents: { none: { documentType: "SUPPORTING_EVIDENCE" } },
    },
  });
  return pendingCount > 0;
};

const REPORT_TYPES: ReportType[] = ["CBAM", "CCTS", "BRSR"];

export const getReportGenerationStatus = async (userId: string, facilityId: string) => {
  const facility = await requireOwnedFacility(userId, facilityId);
  const now = new Date();

  const cards = await Promise.all(
    REPORT_TYPES.map(async (reportType) => {
      const access = await hasAccess(facility.companyId, reportType);
      const period = periodStatusFor(reportType, now);
      const existing = access
        ? await prisma.report.findUnique({
            where: { facilityId_reportType_period: { facilityId, reportType, period: period.period } },
          })
        : null;

      return {
        reportType,
        hasAccess: access,
        period,
        existingReport: existing ? { id: existing.id, generatedAt: existing.generatedAt, pdfPath: existing.pdfPath } : null,
      };
    }),
  );

  return {
    hasAnySubscription: cards.some((c) => c.hasAccess),
    hasEvidencePendingSubmissions: await hasEvidencePendingSubmissions(facilityId),
    cards,
  };
};

/**
 * Builds the PDF via the same engines the older per-activity-data download
 * endpoints use (report.service.ts / brsrReport/build.ts), but resolves the
 * source data from a calendar period rather than a specific activityDataId —
 * this flow is the dashboard's "Generate Report" button, which only ever
 * offers the one currently-reportable period per type.
 */
export const generateReport = async (userId: string, facilityId: string, reportType: ReportType) => {
  const facility = await requireOwnedFacility(userId, facilityId);

  if (!(await hasAccess(facility.companyId, reportType))) {
    throw AppError.forbidden("Your current subscription doesn't include this report type", "REPORT_TYPE_NOT_SUBSCRIBED");
  }

  if (await hasEvidencePendingSubmissions(facilityId)) {
    throw AppError.forbidden("Upload supporting documents to generate report.", "EVIDENCE_PENDING");
  }

  const now = new Date();
  const period = periodStatusFor(reportType, now);
  if (!period.isOpen) {
    throw AppError.forbidden(
      `Report generation for this period opens on ${period.windowStart.toLocaleDateString("en-IN")}`,
      "REPORT_WINDOW_CLOSED",
    );
  }

  let pdfDoc: PDFKit.PDFDocument;

  if (reportType === "CBAM" || reportType === "CCTS") {
    const activityData = await prisma.activityData.findFirst({
      where: {
        facilityId,
        status: "SUBMITTED",
        calculationResult: { isNot: null },
        periodEnd: { gte: period.dataRangeStart, lte: period.dataRangeEnd },
      },
      include: {
        facility: { include: { company: { include: { owner: true } } } },
        calculationResult: true,
      },
      orderBy: { periodEnd: "desc" },
    });

    if (!activityData) {
      throw AppError.badRequest(`No submitted activity data found for ${period.displayLabel} yet`, "NO_ACTIVITY_DATA_FOR_PERIOD");
    }

    const ctx = {
      ...activityData,
      facility: { ...activityData.facility, productionRoute: activityData.facility.productionRoute ?? "OTHER" },
    } as unknown as ReportContext;

    pdfDoc = await generateReportPdf(ctx, reportType);
  } else {
    const brsrReport = await prisma.brsrCoreReport.findUnique({
      where: { facilityId_reportingPeriod: { facilityId, reportingPeriod: period.period } },
    });
    if (!brsrReport || brsrReport.status !== "SUBMITTED") {
      throw AppError.badRequest(`No submitted BRSR Core disclosure found for ${period.displayLabel} yet`, "NO_BRSR_REPORT_FOR_PERIOD");
    }

    const facilityWithCompany = await prisma.facility.findUniqueOrThrow({
      where: { id: facilityId },
      include: { company: { include: { owner: true } } },
    });
    const metrics = await buildBrsrCoreMetrics(brsrReport, facilityWithCompany, facilityWithCompany.company);
    pdfDoc = await buildBrsrCorePdf(brsrReport, facilityWithCompany, metrics);
  }

  const pdfBuffer = await pdfToBuffer(pdfDoc);
  const fileName = `${reportType.toLowerCase()}-report-${facility.name.replace(/\s+/g, "-").toLowerCase()}-${period.period}.pdf`;

  const report = await prisma.report.upsert({
    where: { facilityId_reportType_period: { facilityId, reportType, period: period.period } },
    create: {
      facilityId,
      companyId: facility.companyId,
      reportType,
      period: period.period,
      pdfPath: fileName,
      status: "GENERATED",
    },
    update: { generatedAt: now, pdfPath: fileName, status: "GENERATED" },
  });

  await prisma.document.upsert({
    where: { reportId: report.id },
    create: {
      facilityId,
      companyId: facility.companyId,
      reportId: report.id,
      documentType: "REPORT",
      reportingPeriod: period.period,
      verified: false,
      fileName,
      fileData: pdfBuffer,
    },
    update: { fileName, fileData: pdfBuffer, reportingPeriod: period.period },
  });

  logFacilityAudit(facilityId, facility.companyId, "REPORT_GENERATED", `${reportType} report — ${period.displayLabel}`, userId);

  return report;
};

export const listReports = async (userId: string, facilityId: string) => {
  await requireOwnedFacility(userId, facilityId);
  return prisma.report.findMany({
    where: { facilityId },
    orderBy: { generatedAt: "desc" },
    include: { document: { select: { id: true, verified: true, fileName: true } } },
  });
};

export const getReportPdf = async (userId: string, facilityId: string, reportId: string) => {
  await requireOwnedFacility(userId, facilityId);

  const report = await prisma.report.findUnique({ where: { id: reportId }, include: { document: true } });
  if (!report || report.facilityId !== facilityId || !report.document) {
    throw AppError.notFound("Report not found");
  }

  return { fileName: report.document.fileName, fileData: report.document.fileData };
};
