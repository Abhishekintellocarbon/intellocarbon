import { asyncHandler } from "../utils/asyncHandler";
import * as companyService from "../services/company.service";
import * as companyDashboardService from "../services/companyDashboard.service";
import * as esgOverviewService from "../services/esgOverview.service";

export const getMyCompany = asyncHandler(async (req, res) => {
  const company = await companyService.getMyCompany(req.user!.sub);
  res.status(200).json({ company });
});

export const getCompanyDashboard = asyncHandler(async (req, res) => {
  const analytics = await companyDashboardService.getCompanyAnalytics(req.user!.sub);
  res.status(200).json({ analytics });
});

export const getEsgOverview = asyncHandler(async (req, res) => {
  const overview = await esgOverviewService.getEsgOverview(req.user!.sub);
  res.status(200).json({ overview });
});

export const createCompany = asyncHandler(async (req, res) => {
  const company = await companyService.createCompany(req.user!.sub, req.body);
  res.status(201).json({ company });
});

export const updateCompany = asyncHandler(async (req, res) => {
  const company = await companyService.updateCompany(req.user!.sub, req.body);
  res.status(200).json({ company });
});
