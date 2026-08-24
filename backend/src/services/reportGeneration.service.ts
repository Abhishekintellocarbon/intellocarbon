import type { CbamFramework, ReportType, SubscriptionTier } from "@prisma/client";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";
import { requireOwnedFacility } from "./facility.service";
import { generateReportPdf, loadReportContext } from "./report.service";
import { buildBrsrCoreMetrics } from "./brsrCalculation.service";
import { buildBrsrCorePdf } from "./brsrReport/build";
import { buildGriPdf } from "./griReport/build";
import { buildCsrdPdf } from "./csrdReport/build";
import { getGriReportContextById } from "./gri.service";
import { getCsrdReportContextById } from "./csrd.service";
import { logFacilityAudit } from "./auditLog.service";
import { loadReportPhase2Data } from "./reportSections/phase2Data";
import {
  getCbamReportPeriodStatus,
  getCctsReportPeriodStatus,
  getBrsrReportPeriodStatus,
  getUkCbamReportPeriodStatus,
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
  // Deliberately the same grants as EU CBAM: UK CBAM is included in the
  // existing CBAM tiers rather than sold separately, so a CBAM subscriber in
  // UK scope gets the return without a second purchase. Change this only
  // alongside a pricing decision.
  UK_CBAM: ["CBAM_COMPLIANCE", "CBAM_PLUS_CCTS"],
  CCTS: ["CCTS_COMPLIANCE", "CBAM_PLUS_CCTS"],
  BRSR: ["BRSR_CORE_REPORTING"],
  // GRI folds into the same ESG Disclosure Bundle as BRSR Core and ISSB — no
  // separate tier, per the standing no-new-price-points rule.
  GRI: ["BRSR_CORE_REPORTING"],
  // Same bundle again. CSRD's mandatory scope under Omnibus I is far above
  // this customer base, so it is sold as part of the ESG bundle for voluntary
  // and value-chain-request use rather than priced as a premium tier.
  CSRD: ["BRSR_CORE_REPORTING"],
};

const hasAccess = async (companyId: string, reportType: ReportType): Promise<boolean> => {
  const active = await prisma.subscription.findMany({ where: { companyId, status: "ACTIVE" } });
  const tiers = new Set(active.map((s) => s.tier));
  return TIER_GRANTS[reportType].some((t) => tiers.has(t));
};

const periodStatusFor = (reportType: ReportType, now: Date): ReportPeriodStatus => {
  if (reportType === "CBAM") return getCbamReportPeriodStatus(now);
  if (reportType === "UK_CBAM") return getUkCbamReportPeriodStatus(now);
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

/**
 * Distinct from Evidence Pending — a document can exist and still block
 * generation if no reviewer has explicitly confirmed it matches (no row, or
 * status NOT_REVIEWED) or a reviewer flagged a mismatch. See CrossCheckReview.
 */
const hasUncrossCheckedEvidence = async (facilityId: string): Promise<boolean> => {
  const uncheckedCount = await prisma.document.count({
    where: {
      facilityId,
      documentType: "SUPPORTING_EVIDENCE",
      activityData: { status: "SUBMITTED" },
      OR: [{ crossCheckReview: null }, { crossCheckReview: { status: { not: "MATCHED" } } }],
    },
  });
  return uncheckedCount > 0;
};

// Exported so the generate-report validator can be tested against it — the two
// have to list the same types, and nothing else ties them together.
export const REPORT_TYPES: ReportType[] = ["CBAM", "UK_CBAM", "CCTS", "BRSR"];

/**
 * Which report types this company can see a card for. Subscription access is
 * a separate question, handled by hasAccess — this is about the regime
 * applying at all: a company not in UK scope shouldn't be offered a UK CBAM
 * return even on a CBAM plan that technically grants it. Only the UK card is
 * gated this way; the EU card's behaviour is unchanged.
 */
const applicableReportTypes = (cbamFrameworks: CbamFramework[]): ReportType[] =>
  REPORT_TYPES.filter((t) => t !== "UK_CBAM" || cbamFrameworks.includes("UK_CBAM"));

export const getReportGenerationStatus = async (userId: string, facilityId: string) => {
  const facility = await requireOwnedFacility(userId, facilityId);
  const now = new Date();

  const cards = await Promise.all(
    applicableReportTypes(facility.company.cbamFrameworks).map(async (reportType) => {
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
    hasUncrossCheckedEvidence: await hasUncrossCheckedEvidence(facilityId),
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

  if (await hasUncrossCheckedEvidence(facilityId)) {
    throw AppError.forbidden(
      "All submitted evidence must be cross-checked and matched before generating a report",
      "EVIDENCE_NOT_CROSS_CHECKED",
    );
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

  if (reportType === "UK_CBAM" && !facility.company.cbamFrameworks.includes("UK_CBAM")) {
    throw AppError.forbidden(
      "This company is not registered for UK CBAM. Add UK CBAM in company settings first.",
      "UK_CBAM_NOT_APPLICABLE",
    );
  }

  if (reportType === "CBAM" || reportType === "CCTS" || reportType === "UK_CBAM") {
    // Resolve *which* entry this period's report is built from here, but load
    // it through loadReportContext rather than re-querying it.
    //
    // This used to run its own findFirst with its own include, and that include
    // omitted fuelEntries, processMaterialEntries and precursorEntries — which
    // every CBAM/CCTS/UK CBAM builder dereferences. An `as unknown as
    // ReportContext` cast defeated the type error that would have caught it, so
    // the mistake surfaced only at runtime, as a TypeError inside the PDF
    // builder. Two queries claiming to produce the same context is the actual
    // defect; there is now one loader, and the cast is gone with it.
    const candidate = await prisma.activityData.findFirst({
      where: {
        facilityId,
        status: "SUBMITTED",
        calculationResult: { isNot: null },
        periodEnd: { gte: period.dataRangeStart, lte: period.dataRangeEnd },
      },
      select: { id: true },
      orderBy: { periodEnd: "desc" },
    });

    if (!candidate) {
      throw AppError.badRequest(`No submitted activity data found for ${period.displayLabel} yet`, "NO_ACTIVITY_DATA_FOR_PERIOD");
    }

    const ctx = await loadReportContext(userId, facilityId, candidate.id);

    pdfDoc = await generateReportPdf(ctx, reportType);
  } else if (reportType === "GRI") {
    // GRI, CSRD and BRSR Core share the FY period convention but are three
    // different documents. This branch used to build a BRSR Core PDF for all
    // three, then file it under a gri-report-*.pdf or csrd-report-*.pdf name —
    // so asking for a GRI report handed back somebody's BRSR disclosure with
    // the wrong title on it. The real builders already existed and were
    // reachable only from their own download endpoints; they are wired here now.
    const griReport = await prisma.griReport.findUnique({
      where: { facilityId_reportingPeriod: { facilityId, reportingPeriod: period.period } },
      select: { id: true },
    });
    if (!griReport) {
      throw AppError.badRequest(`No GRI report found for ${period.displayLabel} yet`, "NO_GRI_REPORT_FOR_PERIOD");
    }
    // The context loader carries its own ownership, ESG-bundle, SUBMITTED and
    // GRI-window checks, so this deliberately does not repeat them — one place
    // decides whether a GRI report may be produced, and it is the same place
    // the /api/gri download endpoint asks.
    const { report, facility: griFacility, metrics, contentIndex, phase2 } = await getGriReportContextById(
      userId,
      griReport.id,
    );
    pdfDoc = await buildGriPdf(report, griFacility, metrics, contentIndex, phase2);
  } else if (reportType === "CSRD") {
    const csrdReport = await prisma.csrdReport.findUnique({
      where: { facilityId_reportingPeriod: { facilityId, reportingPeriod: period.period } },
      select: { id: true },
    });
    if (!csrdReport) {
      throw AppError.badRequest(`No CSRD report found for ${period.displayLabel} yet`, "NO_CSRD_REPORT_FOR_PERIOD");
    }
    const { report, facility: csrdFacility, metrics, disclosureIndex, phase2 } = await getCsrdReportContextById(
      userId,
      csrdReport.id,
    );
    pdfDoc = await buildCsrdPdf(report, csrdFacility, metrics, disclosureIndex, phase2);
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
    const phase2 = await loadReportPhase2Data(
      facilityWithCompany.companyId,
      facilityWithCompany.id,
      brsrReport.reportingPeriod,
    );
    pdfDoc = await buildBrsrCorePdf(brsrReport, facilityWithCompany, metrics, phase2);
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
