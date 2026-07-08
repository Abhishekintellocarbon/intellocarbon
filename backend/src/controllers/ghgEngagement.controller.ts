import { asyncHandler } from "../utils/asyncHandler";
import * as ghgEngagementService from "../services/ghgEngagement.service";
import * as ghgReportService from "../services/ghgReport.service";
import { calculateGhgEngagement } from "../services/ghgCalculation.service";
import { asScope1Entries, asScope2Entries } from "../services/ghgEngagement.service";

// Every response that returns an engagement also returns its computed
// breakdown (per-row factor/source/co2e + subtotals) alongside it — the
// calculation logic lives in exactly one place (ghgCalculation.service.ts),
// so the frontend never re-implements it just to render the on-screen
// breakdown.
const withCalculation = (engagement: Awaited<ReturnType<typeof ghgEngagementService.getEngagement>>) => ({
  engagement,
  calculation: calculateGhgEngagement(
    asScope1Entries(engagement.scope1Entries),
    asScope2Entries(engagement.scope2Entries),
    engagement.jurisdiction,
  ),
});

export const listEngagements = asyncHandler(async (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  const engagements = await ghgEngagementService.listEngagements(search);
  res.status(200).json({ engagements });
});

export const getEngagement = asyncHandler(async (req, res) => {
  const engagement = await ghgEngagementService.getEngagement(req.params.id);
  res.status(200).json(withCalculation(engagement));
});

export const createEngagement = asyncHandler(async (req, res) => {
  const engagement = await ghgEngagementService.createEngagement(req.body, req.user!.sub);
  res.status(201).json(withCalculation(engagement));
});

export const updateEngagement = asyncHandler(async (req, res) => {
  const engagement = await ghgEngagementService.updateEngagement(req.params.id, req.body);
  res.status(200).json(withCalculation(engagement));
});

export const finalizeEngagement = asyncHandler(async (req, res) => {
  const engagement = await ghgEngagementService.finalizeEngagement(req.params.id);
  res.status(200).json(withCalculation(engagement));
});

export const duplicateEngagement = asyncHandler(async (req, res) => {
  const engagement = await ghgEngagementService.duplicateEngagement(req.params.id, req.user!.sub);
  res.status(201).json(withCalculation(engagement));
});

// Stateless live preview — called as the admin edits rows in a draft,
// before saving, so the on-screen breakdown updates without persisting
// anything yet.
export const calculatePreview = asyncHandler(async (req, res) => {
  const calculation = calculateGhgEngagement(req.body.scope1Entries, req.body.scope2Entries, req.body.jurisdiction);
  res.status(200).json({ calculation });
});

export const generateReport = asyncHandler(async (req, res) => {
  const engagement = await ghgReportService.generateEngagementReport(req.params.id);
  res.status(200).json({ engagement });
});

export const downloadReport = asyncHandler(async (req, res) => {
  const { fileName, fileData } = await ghgReportService.getEngagementReportFile(req.params.id);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  res.send(fileData);
});
