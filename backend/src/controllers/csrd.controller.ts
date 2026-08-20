import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import * as csrdService from "../services/csrd.service";
import { buildCsrdPdf } from "../services/csrdReport/build";
import { logFacilityAudit } from "../services/auditLog.service";
import {
  csrdDataSchema,
  csrdDataDraftSchema,
  csrdMaterialityCompleteSchema,
  csrdMaterialityDraftSchema,
} from "../validators/csrd.validators";

const badRequest = (error: { issues: { path: (string | number)[]; message: string }[] }): never => {
  const issue = error.issues[0];
  throw AppError.badRequest(
    `${issue?.path.length ? `${issue.path.join(".")}: ` : ""}${issue?.message ?? "Invalid request body"}`,
    "VALIDATION_ERROR",
  );
};

export const listCsrdReports = asyncHandler(async (req, res) => {
  const reports = await csrdService.listCsrdReports(req.user!.sub, req.params.facilityId);
  res.status(200).json({ reports });
});

export const getMateriality = asyncHandler(async (req, res) => {
  const data = await csrdService.getMaterialityAssessment(req.user!.sub, req.params.facilityId, req.params.period);
  res.status(200).json(data);
});

// `complete: true` flips completedAt and activates standard gating, and also
// switches to the strict schema — same convention as GRI's materiality
// endpoint and BRSR/ISSB's submit flag.
export const saveMateriality = asyncHandler(async (req, res) => {
  const strict = req.body?.complete === true;
  const parsed = (strict ? csrdMaterialityCompleteSchema : csrdMaterialityDraftSchema).safeParse(req.body);
  if (!parsed.success) badRequest(parsed.error);

  const result = await csrdService.saveMaterialityAssessment(
    req.user!.sub,
    req.params.facilityId,
    parsed.data as never,
  );
  res.status(200).json(result);
});

export const getCsrdData = asyncHandler(async (req, res) => {
  const data = await csrdService.getCsrdDraft(req.user!.sub, req.params.facilityId, req.params.period);
  res.status(200).json(data);
});

export const saveCsrdData = asyncHandler(async (req, res) => {
  const submit = req.body?.submit === true;
  const parsed = (submit ? csrdDataSchema : csrdDataDraftSchema).safeParse(req.body);
  if (!parsed.success) badRequest(parsed.error);

  const report = await csrdService.saveCsrdData(req.user!.sub, req.params.facilityId, parsed.data as never, submit);
  res.status(200).json({ report });
});

export const getCsrdReport = asyncHandler(async (req, res) => {
  const data = await csrdService.getCsrdReportData(req.user!.sub, req.params.facilityId, req.params.period);
  res.status(200).json(data);
});

export const downloadCsrdReportPdf = asyncHandler(async (req, res) => {
  const { report, facility, metrics, disclosureIndex, phase2 } = await csrdService.getCsrdReportContextById(
    req.user!.sub,
    req.params.reportId,
  );
  const doc = await buildCsrdPdf(report, facility, metrics, disclosureIndex, phase2);

  logFacilityAudit(
    facility.id,
    report.companyId,
    "REPORT_GENERATED",
    `CSRD/ESRS sustainability statement — ${report.reportingPeriod}`,
    req.user!.sub,
  );

  const filename = `csrd-statement-${facility.name.replace(/\s+/g, "-").toLowerCase()}-${report.id.slice(-8)}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  doc.pipe(res);
  doc.end();
});
