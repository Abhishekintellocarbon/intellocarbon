import { asyncHandler } from "../utils/asyncHandler";
import * as adminCompaniesService from "../services/adminCompanies.service";

export const listCompanies = asyncHandler(async (_req, res) => {
  const companies = await adminCompaniesService.listCompanies();
  res.status(200).json({ companies });
});

export const getCompanyDetail = asyncHandler(async (req, res) => {
  const company = await adminCompaniesService.getCompanyDetail(req.params.companyId);
  res.status(200).json({ company });
});
