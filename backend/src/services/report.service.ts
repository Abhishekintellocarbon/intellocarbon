import PDFDocument from "pdfkit";
import { prisma } from "../config/prisma";
import { requireOwnedActivityData } from "./activityData.service";
import { computeCbamFinancialImpact } from "./cbamFinancialImpact.service";
import { buildCbamCommunicationPackage } from "./cbamReport/build";
import { buildCctsGhgIntensityReport } from "./cctsReport/build";
import { AppError } from "../utils/AppError";
import {
  isCbamReportWindowOpen,
  isCctsReportWindowOpen,
  nextCbamUnlockDate,
  nextCctsUnlockDate,
} from "../data/complianceDeadlines";

export type ReportType = "CBAM" | "CCTS";

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
};

export const getReportContext = async (
  userId: string,
  facilityId: string,
  activityDataId: string,
  type: ReportType,
) => {
  requireReportWindowOpen(type);
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

export type ReportContext = Awaited<ReturnType<typeof getReportContext>>;

export const buildCbamReportPdf = async (doc: PDFKit.PDFDocument, ctx: ReportContext) => {
  const financials = computeCbamFinancialImpact(ctx, "CBAM");
  await buildCbamCommunicationPackage(doc, ctx, financials);
};

export const buildCctsReportPdf = async (doc: PDFKit.PDFDocument, ctx: ReportContext) => {
  await buildCctsGhgIntensityReport(doc, ctx);
};

export const generateReportPdf = async (ctx: ReportContext, type: ReportType): Promise<PDFKit.PDFDocument> => {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 50, left: 50, right: 50, bottom: 20 },
    bufferPages: true,
  });
  if (type === "CBAM") {
    await buildCbamReportPdf(doc, ctx);
  } else {
    await buildCctsReportPdf(doc, ctx);
  }
  return doc;
};
