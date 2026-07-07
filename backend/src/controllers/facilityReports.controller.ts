import { asyncHandler } from "../utils/asyncHandler";
import * as reportGenerationService from "../services/reportGeneration.service";

export const getReportGenerationStatus = asyncHandler(async (req, res) => {
  const status = await reportGenerationService.getReportGenerationStatus(req.user!.sub, req.params.facilityId);
  res.status(200).json(status);
});

export const generateReport = asyncHandler(async (req, res) => {
  const report = await reportGenerationService.generateReport(req.user!.sub, req.params.facilityId, req.body.reportType);
  res.status(201).json({ report });
});

export const listReports = asyncHandler(async (req, res) => {
  const reports = await reportGenerationService.listReports(req.user!.sub, req.params.facilityId);
  res.status(200).json({ reports });
});

export const downloadReportPdf = asyncHandler(async (req, res) => {
  const { fileName, fileData } = await reportGenerationService.getReportPdf(
    req.user!.sub,
    req.params.facilityId,
    req.params.reportId,
  );

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  res.send(fileData);
});
