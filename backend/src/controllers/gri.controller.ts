import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import * as griService from "../services/gri.service";
import { buildGriPdf } from "../services/griReport/build";
import { logFacilityAudit } from "../services/auditLog.service";
import {
  griDataSchema,
  griDataDraftSchema,
  griMaterialityAssessmentSchema,
  griMaterialityAssessmentDraftSchema,
} from "../validators/gri.validators";

export const listGriReports = asyncHandler(async (req, res) => {
  const reports = await griService.listGriReports(req.user!.sub, req.params.facilityId);
  res.status(200).json({ reports });
});

// --- GRI 3 materiality assessment ---

export const getMateriality = asyncHandler(async (req, res) => {
  const data = await griService.getMaterialityAssessment(
    req.user!.sub,
    req.params.facilityId,
    req.params.period,
  );
  res.status(200).json(data);
});

// One endpoint serves both draft-autosave and the explicit "complete
// assessment" action — `complete: true` in the body is what flips completedAt
// and activates topic gating, while `submit` chooses strict vs permissive
// validation, matching BRSR/ISSB's convention over a single resource.
export const saveMateriality = asyncHandler(async (req, res) => {
  const strict = req.body?.complete === true;
  const schema = strict ? griMaterialityAssessmentSchema : griMaterialityAssessmentDraftSchema;
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw AppError.badRequest(
      `${issue?.path.length ? `${issue.path.join(".")}: ` : ""}${issue?.message ?? "Invalid request body"}`,
      "VALIDATION_ERROR",
    );
  }

  const result = await griService.saveMaterialityAssessment(
    req.user!.sub,
    req.params.facilityId,
    parsed.data as never,
  );
  res.status(200).json(result);
});

// --- Disclosure data ---

export const getGriData = asyncHandler(async (req, res) => {
  const data = await griService.getGriDraft(req.user!.sub, req.params.facilityId, req.params.period);
  res.status(200).json(data);
});

export const saveGriData = asyncHandler(async (req, res) => {
  const submit = req.body?.submit === true;
  const schema = submit ? griDataSchema : griDataDraftSchema;
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw AppError.badRequest(
      `${issue?.path.length ? `${issue.path.join(".")}: ` : ""}${issue?.message ?? "Invalid request body"}`,
      "VALIDATION_ERROR",
    );
  }

  const report = await griService.saveGriData(req.user!.sub, req.params.facilityId, parsed.data as never, submit);
  res.status(200).json({ report });
});

// --- Report ---

export const getGriReport = asyncHandler(async (req, res) => {
  const data = await griService.getGriReportData(req.user!.sub, req.params.facilityId, req.params.period);
  res.status(200).json(data);
});

export const downloadGriReportPdf = asyncHandler(async (req, res) => {
  const { report, facility, metrics, contentIndex, phase2 } = await griService.getGriReportContextById(
    req.user!.sub,
    req.params.reportId,
  );
  const doc = await buildGriPdf(report, facility, metrics, contentIndex, phase2);

  logFacilityAudit(
    facility.id,
    report.companyId,
    "REPORT_GENERATED",
    `GRI Standards 2021 report — ${report.reportingPeriod}`,
    req.user!.sub,
  );

  const filename = `gri-report-${facility.name.replace(/\s+/g, "-").toLowerCase()}-${report.id.slice(-8)}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  doc.pipe(res);
  doc.end();
});
