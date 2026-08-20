import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import * as issbService from "../services/issb.service";
import { buildIssbS1S2Pdf } from "../services/issbReport/build";
import { logFacilityAudit } from "../services/auditLog.service";
import { issbS1S2ReportSchema, issbS1S2ReportDraftSchema } from "../validators/issb.validators";

// One endpoint serves both draft-autosave and final submit — `submit: true`
// in the body switches which zod schema validates the payload (strict vs.
// permissive), matching BRSR Core's draft/submit pattern over a single
// resource keyed by (facilityId, reportingPeriod).
export const listIssbReports = asyncHandler(async (req, res) => {
  const reports = await issbService.listIssbReports(req.user!.sub, req.params.facilityId);
  res.status(200).json({ reports });
});

export const saveIssbData = asyncHandler(async (req, res) => {
  const submit = req.body?.submit === true;
  const schema = submit ? issbS1S2ReportSchema : issbS1S2ReportDraftSchema;
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    throw AppError.badRequest(parsed.error.issues[0]?.message ?? "Invalid request body", "VALIDATION_ERROR");
  }

  const report = await issbService.saveIssbS1S2Data(req.user!.sub, req.params.facilityId, parsed.data, submit);
  res.status(200).json({ report });
});

export const getIssbReport = asyncHandler(async (req, res) => {
  const data = await issbService.getIssbReportData(req.user!.sub, req.params.facilityId, req.params.period);
  res.status(200).json(data);
});

export const downloadIssbReportPdf = asyncHandler(async (req, res) => {
  const { report, facility, metrics, phase2 } = await issbService.getIssbReportContextById(req.user!.sub, req.params.reportId);
  const doc = await buildIssbS1S2Pdf(report, facility, metrics, phase2);

  logFacilityAudit(
    facility.id,
    report.companyId,
    "REPORT_GENERATED",
    `ISSB IFRS S1/S2 report — ${report.reportingPeriod}`,
    req.user!.sub,
  );

  const filename = `issb-s1-s2-report-${facility.name.replace(/\s+/g, "-").toLowerCase()}-${report.id.slice(-8)}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  doc.pipe(res);
  doc.end();
});
