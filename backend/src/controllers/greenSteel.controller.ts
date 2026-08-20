import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { getGreenSteelAssessment, getGreenSteelAssessmentById } from "../services/greenSteel.service";
import { generateGreenSteelPdf } from "../services/greenSteelReport/build";
import { logFacilityAudit } from "../services/auditLog.service";

/**
 * The facility's Green Steel assessment for a reporting period.
 *
 * Non-steel accounts get a 200 with `applicable: false` rather than an error:
 * the dashboard asks this question for every facility it renders and "the
 * taxonomy does not cover you" is an answer, not a failure. The PDF route
 * below does refuse, since producing a document is a deliberate act.
 */
export const getAssessment = asyncHandler(async (req, res) => {
  const reportingPeriod = String(req.query.reportingPeriod ?? "").trim();
  if (!reportingPeriod) {
    throw AppError.badRequest("reportingPeriod is required, e.g. FY2025-26", "REPORTING_PERIOD_REQUIRED");
  }

  const result = await getGreenSteelAssessment(req.user!.sub, req.params.facilityId, reportingPeriod);
  res.status(200).json(result);
});

/** Streams the calculation summary. Not a certificate — see the builder. */
export const downloadAssessmentPdf = asyncHandler(async (req, res) => {
  const assessment = await getGreenSteelAssessmentById(req.user!.sub, req.params.assessmentId);

  logFacilityAudit(
    assessment.facilityId,
    assessment.companyId,
    "REPORT_GENERATED",
    `Green Steel calculation summary — ${assessment.reportingPeriod}`,
    req.user!.sub,
  );

  const slug = assessment.facility.name.replace(/\s+/g, "-").toLowerCase();
  res.setHeader("Content-Type", "application/pdf");
  // "calculation-summary", never "certificate" — the filename is the first
  // thing a recipient sees when it is forwarded on.
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="green-steel-calculation-summary-${slug}-${assessment.reportingPeriod}.pdf"`,
  );

  const doc = generateGreenSteelPdf(assessment, assessment.facility);
  doc.pipe(res);
  doc.end();
});
