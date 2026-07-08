import PDFDocument from "pdfkit";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";
import { calculateGhgEngagement } from "./ghgCalculation.service";
import { asScope1Entries, asScope2Entries, getEngagement } from "./ghgEngagement.service";
import { buildGhgInventoryReport } from "./ghgReport/build";

const pdfToBuffer = (doc: PDFKit.PDFDocument): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });

/**
 * Only callable on a FINALIZED engagement — a draft's numbers aren't locked
 * yet, so a report generated from one would risk going stale the moment
 * the admin edits another field. Regenerating overwrites the stored PDF;
 * that's fine, since a finalized engagement's inputs (and therefore the
 * calculation) never change.
 */
export const generateEngagementReport = async (id: string) => {
  const engagement = await getEngagement(id);
  if (engagement.status !== "FINALIZED") {
    throw AppError.badRequest("Finalize the engagement before generating a report", "ENGAGEMENT_NOT_FINALIZED");
  }

  const calc = calculateGhgEngagement(
    asScope1Entries(engagement.scope1Entries),
    asScope2Entries(engagement.scope2Entries),
    engagement.jurisdiction,
  );

  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 50, left: 50, right: 50, bottom: 20 },
    bufferPages: true,
  });
  buildGhgInventoryReport(doc, engagement, calc);
  const pdfBuffer = await pdfToBuffer(doc);

  const fileName = `ghg-inventory-${engagement.organizationName.replace(/\s+/g, "-").toLowerCase()}-${engagement.id.slice(-8)}.pdf`;

  return prisma.ghgEngagement.update({
    where: { id },
    data: { reportPdfFileName: fileName, reportPdfData: pdfBuffer, reportGeneratedAt: new Date() },
  });
};

export const getEngagementReportFile = async (id: string) => {
  const engagement = await getEngagement(id);
  if (!engagement.reportPdfData || !engagement.reportPdfFileName) {
    throw AppError.notFound("No report has been generated for this engagement yet");
  }
  return { fileName: engagement.reportPdfFileName, fileData: engagement.reportPdfData };
};
