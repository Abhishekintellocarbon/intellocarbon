import PDFDocument from "pdfkit";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";
import { requireOwnedFacilityForCbam } from "./cbamAccess.service";
import { loadReportContext } from "./report.service";
import { computeCbamFinancialImpact } from "./cbamFinancialImpact.service";
import { listCbamCertificatePriceHistory } from "./certificatePriceHistory.service";
import { buildCbamExecutiveSummary } from "./cbamReport/executiveSummary";

/**
 * One-click board summary for the CBAM dashboard.
 *
 * Summarises the facility's most recent SUBMITTED activity data — the same
 * period the dashboard's CBAM card is already showing — so the button needs no
 * period picker and can never disagree with the number on screen next to it.
 *
 * Everything is reused: computeCbamFinancialImpact is the same function the
 * Communication Package is built from, the price series is the Emission Factor
 * Manager's supersession chain, and the PDF is assembled with the Communication
 * Package's own PageBuilder. No calculation is duplicated here.
 */
export const generateCbamExecutiveSummary = async (userId: string, facilityId: string) => {
  const facility = await requireOwnedFacilityForCbam(userId, facilityId);

  const latest = await prisma.activityData.findFirst({
    where: { facilityId, status: "SUBMITTED", calculationResult: { isNot: null } },
    orderBy: { periodEnd: "desc" },
    select: { id: true },
  });

  if (!latest) {
    throw AppError.badRequest(
      "Submit at least one activity data entry for this facility before generating an executive summary",
      "NO_SUBMITTED_ACTIVITY_DATA",
    );
  }

  // Deliberately loadReportContext, not getReportContext: the latter enforces
  // the CBAM filing window, which is correct for a regulatory submission and
  // wrong for an internal board pack. Ownership, SUBMITTED status and a
  // present calculationResult are all still enforced.
  const ctx = await loadReportContext(userId, facilityId, latest.id);
  const financials = computeCbamFinancialImpact(ctx, "CBAM");
  const priceHistory = await listCbamCertificatePriceHistory();

  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 50, left: 50, right: 50, bottom: 20 },
    bufferPages: true,
  });
  await buildCbamExecutiveSummary(doc, ctx, financials, priceHistory);

  return { doc, ctx, facility };
};
