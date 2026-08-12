import PDFDocument from "pdfkit";
import { prisma } from "../config/prisma";
import { requireOwnedActivityData } from "./activityData.service";
import { computeCbamFinancialImpact } from "./cbamFinancialImpact.service";
import { buildCbamCommunicationPackage } from "./cbamReport/build";
import { computeUkCbamFinancialImpact } from "./ukCbamFinancialImpact.service";
import { buildUkCbamReturn } from "./ukCbamReport/build";
import { buildCctsGhgIntensityReport } from "./cctsReport/build";
import { AppError } from "../utils/AppError";
import {
  isCbamReportWindowOpen,
  isCctsReportWindowOpen,
  nextCbamUnlockDate,
  nextCctsUnlockDate,
  getUkCbamReportPeriodStatus,
} from "../data/complianceDeadlines";

export type ReportType = "CBAM" | "CCTS" | "UK_CBAM";

const fmtUnlockDate = (d: Date) => d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

// The actual security boundary — the frontend also disables the button and
// shows this same message, but that's cosmetic; this is what stops someone
// hitting the download URL directly outside the reporting window.
const requireReportWindowOpen = (type: ReportType, now: Date = new Date()): void => {
  if (type === "CBAM" && !isCbamReportWindowOpen(now)) {
    throw AppError.forbidden(
      `Report generation opens on ${fmtUnlockDate(nextCbamUnlockDate(now))}`,
      "REPORT_WINDOW_CLOSED",
    );
  }
  if (type === "CCTS" && !isCctsReportWindowOpen(now)) {
    throw AppError.forbidden(
      `Report generation opens on ${fmtUnlockDate(nextCctsUnlockDate(now))}`,
      "REPORT_WINDOW_CLOSED",
    );
  }
  // The UK's window isn't a recurring calendar rule like the EU's — the first
  // accounting period has a one-off window and quarterly filing only starts
  // in 2028 — so the period status owns the question rather than a separate
  // predicate that would have to repeat that shape.
  if (type === "UK_CBAM") {
    const period = getUkCbamReportPeriodStatus(now);
    if (!period.isOpen) {
      throw AppError.forbidden(
        `Report generation opens on ${fmtUnlockDate(period.windowStart)}`,
        "REPORT_WINDOW_CLOSED",
      );
    }
  }
};

/**
 * Loads and narrows the report context, without any reporting-window check.
 *
 * Split out of getReportContext so the CBAM executive summary can reuse the
 * exact same query and narrowing: that summary is an internal board document,
 * not a regulatory submission, so gating it on the CBAM filing window would
 * make a management report unavailable for most of the year for no
 * regulatory reason. Every other guard — ownership, SUBMITTED status, a
 * completed facility, a present calculationResult — still applies.
 */
export const loadReportContext = async (userId: string, facilityId: string, activityDataId: string) => {
  await requireOwnedActivityData(userId, facilityId, activityDataId);

  const activityData = await prisma.activityData.findUniqueOrThrow({
    where: { id: activityDataId },
    include: {
      facility: { include: { company: { include: { owner: true } } } },
      fuelEntries: true,
      processMaterialEntries: true,
      precursorEntries: true,
      calculationResult: true,
      verificationRequest: { include: { verifier: true } },
    },
  });

  // Drafts never reach here in practice — they never have a
  // calculationResult, since that's only ever produced by submitting —
  // but this gives a clearer error than the generic one below, and lets us
  // narrow away the nullability that drafts require on these columns.
  if (activityData.status !== "SUBMITTED") {
    throw new Error("Cannot generate a report for a draft entry — submit it first");
  }
  if (activityData.facility.isDraft) {
    throw new Error("Cannot generate a report for a facility that hasn't been marked complete yet");
  }
  if (!activityData.calculationResult) {
    throw new Error("Activity data has not been calculated yet");
  }

  return activityData as typeof activityData & {
    periodStart: Date;
    periodEnd: Date;
    productCategory: string;
    productionQuantityT: number;
    facility: typeof activityData.facility & {
      facilityType: NonNullable<(typeof activityData.facility)["facilityType"]>;
      productionRoute: NonNullable<(typeof activityData.facility)["productionRoute"]>;
    };
    calculationResult: NonNullable<typeof activityData.calculationResult>;
  };
};

export const getReportContext = async (
  userId: string,
  facilityId: string,
  activityDataId: string,
  type: ReportType,
) => {
  requireReportWindowOpen(type);
  return loadReportContext(userId, facilityId, activityDataId);
};

export type ReportContext = Awaited<ReturnType<typeof getReportContext>>;

export const buildCbamReportPdf = async (doc: PDFKit.PDFDocument, ctx: ReportContext) => {
  const financials = computeCbamFinancialImpact(ctx, "CBAM");
  await buildCbamCommunicationPackage(doc, ctx, financials);
};

export const buildCctsReportPdf = async (doc: PDFKit.PDFDocument, ctx: ReportContext) => {
  await buildCctsGhgIntensityReport(doc, ctx);
};

export const buildUkCbamReportPdf = async (doc: PDFKit.PDFDocument, ctx: ReportContext) => {
  await buildUkCbamReturn(doc, ctx, computeUkCbamFinancialImpact(ctx));
};

export const generateReportPdf = async (ctx: ReportContext, type: ReportType): Promise<PDFKit.PDFDocument> => {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 50, left: 50, right: 50, bottom: 20 },
    bufferPages: true,
  });
  if (type === "CBAM") {
    await buildCbamReportPdf(doc, ctx);
  } else if (type === "UK_CBAM") {
    await buildUkCbamReportPdf(doc, ctx);
  } else {
    await buildCctsReportPdf(doc, ctx);
  }
  return doc;
};
