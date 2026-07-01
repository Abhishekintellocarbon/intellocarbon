import { asyncHandler } from "../utils/asyncHandler";
import * as activityDataService from "../services/steelActivityData.service";
import { generateReportPdf, getReportContext, type ReportType } from "../services/report.service";

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
    const ctx = await getReportContext(req.user!.sub, req.params.facilityId, req.params.dataId);
    const doc = generateReportPdf(ctx, type);

    const filename = `${type.toLowerCase()}-report-${ctx.facility.name.replace(/\s+/g, "-").toLowerCase()}-${ctx.id.slice(-8)}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    doc.pipe(res);
    doc.end();
  });

export const downloadCbamReport = downloadReport("CBAM");
export const downloadCctsReport = downloadReport("CCTS");
