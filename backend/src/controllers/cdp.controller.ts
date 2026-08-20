import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import * as cdpService from "../services/cdp.service";
import { buildCdpPdf } from "../services/cdpReport/build";
import { logFacilityAudit } from "../services/auditLog.service";
import { cdpDataSchema, cdpDataDraftSchema } from "../validators/cdp.validators";

const badRequest = (error: { issues: { path: (string | number)[]; message: string }[] }): never => {
  const issue = error.issues[0];
  throw AppError.badRequest(
    `${issue?.path.length ? `${issue.path.join(".")}: ` : ""}${issue?.message ?? "Invalid request body"}`,
    "VALIDATION_ERROR",
  );
};

export const listCdpReports = asyncHandler(async (req, res) => {
  const reports = await cdpService.listCdpReports(req.user!.sub, req.params.facilityId);
  res.status(200).json({ reports });
});

export const getCdpData = asyncHandler(async (req, res) => {
  const data = await cdpService.getCdpDraft(req.user!.sub, req.params.facilityId, req.params.period);
  res.status(200).json(data);
});

// `submit: true` switches to the strict schema and marks the response
// complete — same convention as GRI/CSRD/BRSR/ISSB.
export const saveCdpData = asyncHandler(async (req, res) => {
  const submit = req.body?.submit === true;
  const parsed = (submit ? cdpDataSchema : cdpDataDraftSchema).safeParse(req.body);
  if (!parsed.success) badRequest(parsed.error);

  const report = await cdpService.saveCdpData(req.user!.sub, req.params.facilityId, parsed.data as never, submit);
  res.status(200).json({ report });
});

export const getCdpReport = asyncHandler(async (req, res) => {
  const data = await cdpService.getCdpReportData(req.user!.sub, req.params.facilityId, req.params.period);
  res.status(200).json(data);
});

export const downloadCdpReportPdf = asyncHandler(async (req, res) => {
  const { report, facility, metrics, maturity, responseIndex, phase2 } = await cdpService.getCdpReportContextById(
    req.user!.sub,
    req.params.reportId,
  );
  const doc = await buildCdpPdf(report, facility, metrics, maturity, responseIndex, phase2);

  logFacilityAudit(
    facility.id,
    report.companyId,
    "REPORT_GENERATED",
    `CDP Climate Change response pack — ${report.reportingPeriod}`,
    req.user!.sub,
  );

  const filename = `cdp-climate-response-${facility.name.replace(/\s+/g, "-").toLowerCase()}-${report.id.slice(-8)}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  doc.pipe(res);
  doc.end();
});
