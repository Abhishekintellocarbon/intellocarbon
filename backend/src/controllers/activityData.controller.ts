import { asyncHandler } from "../utils/asyncHandler";
import * as activityDataService from "../services/activityData.service";
import { generateReportPdf, getReportContext, type ReportType } from "../services/report.service";
import { logFacilityAudit } from "../services/auditLog.service";

export const listActivityData = asyncHandler(async (req, res) => {
  const entries = await activityDataService.listActivityData(req.user!.sub, req.params.facilityId);
  res.status(200).json({ entries });
});

export const createActivityData = asyncHandler(async (req, res) => {
  const entry = await activityDataService.createActivityData(
    req.user!.sub,
    req.params.facilityId,
    req.body,
  );
  res.status(201).json({ entry });
});

export const autosaveNewActivityData = asyncHandler(async (req, res) => {
  const entry = await activityDataService.autosaveActivityData(
    req.user!.sub,
    req.params.facilityId,
    undefined,
    req.body,
  );
  res.status(201).json({ entry });
});

export const autosaveActivityData = asyncHandler(async (req, res) => {
  const entry = await activityDataService.autosaveActivityData(
    req.user!.sub,
    req.params.facilityId,
    req.params.dataId,
    req.body,
  );
  res.status(200).json({ entry });
});

export const submitActivityData = asyncHandler(async (req, res) => {
  const entry = await activityDataService.submitActivityData(
    req.user!.sub,
    req.params.facilityId,
    req.params.dataId,
    req.body,
  );
  res.status(200).json({ entry });
});

export const getActivityData = asyncHandler(async (req, res) => {
  const entry = await activityDataService.getActivityData(
    req.user!.sub,
    req.params.facilityId,
    req.params.dataId,
  );
  res.status(200).json({ entry });
});

export const deleteActivityData = asyncHandler(async (req, res) => {
  await activityDataService.deleteActivityData(req.user!.sub, req.params.facilityId, req.params.dataId);
  res.status(204).send();
});

const downloadReport = (type: ReportType) =>
  asyncHandler(async (req, res) => {
    const ctx = await getReportContext(req.user!.sub, req.params.facilityId, req.params.dataId, type);
    const doc = await generateReportPdf(ctx, type);

    logFacilityAudit(ctx.facility.id, ctx.facility.companyId, "REPORT_GENERATED", `${type} report — ${ctx.periodStart.toLocaleDateString("en-IN")} to ${ctx.periodEnd.toLocaleDateString("en-IN")}`);

    const filename = `${type.toLowerCase()}-report-${ctx.facility.name.replace(/\s+/g, "-").toLowerCase()}-${ctx.id.slice(-8)}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    doc.pipe(res);
    doc.end();
  });

export const downloadCbamReport = downloadReport("CBAM");
export const downloadCctsReport = downloadReport("CCTS");
