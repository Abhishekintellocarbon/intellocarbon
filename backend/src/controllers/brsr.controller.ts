import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import * as brsrService from "../services/brsr.service";
import { buildBrsrCorePdf } from "../services/brsrReport/build";
import { brsrCoreReportSchema, brsrCoreReportDraftSchema } from "../validators/brsr.validators";

// One endpoint serves both draft-autosave and final submit — `submit: true`
// in the body switches which zod schema validates the payload (strict vs.
// permissive), matching the "draft/submit pattern" over a single resource
// keyed by (facilityId, reportingPeriod) rather than ActivityData's
// multi-endpoint, multi-draft-per-facility shape.
export const listBrsrReports = asyncHandler(async (req, res) => {
  const reports = await brsrService.listBrsrReports(req.user!.sub, req.params.facilityId);
  res.status(200).json({ reports });
});

export const saveBrsrData = asyncHandler(async (req, res) => {
  const submit = req.body?.submit === true;
  const schema = submit ? brsrCoreReportSchema : brsrCoreReportDraftSchema;
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    throw AppError.badRequest(parsed.error.issues[0]?.message ?? "Invalid request body", "VALIDATION_ERROR");
  }

  const report = await brsrService.saveBrsrCoreData(req.user!.sub, req.params.facilityId, parsed.data, submit);
  res.status(200).json({ report });
});

export const getBrsrReport = asyncHandler(async (req, res) => {
  const data = await brsrService.getBrsrReportData(req.user!.sub, req.params.facilityId, req.params.period);
  res.status(200).json(data);
});

export const downloadBrsrReportPdf = asyncHandler(async (req, res) => {
  const { report, facility, metrics } = await brsrService.getBrsrReportContextById(req.user!.sub, req.params.reportId);
  const doc = await buildBrsrCorePdf(report, facility, metrics);

  const filename = `brsr-core-report-${facility.name.replace(/\s+/g, "-").toLowerCase()}-${report.id.slice(-8)}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  doc.pipe(res);
  doc.end();
});
