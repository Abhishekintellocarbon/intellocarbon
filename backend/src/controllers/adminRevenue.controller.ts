import { asyncHandler } from "../utils/asyncHandler";
import * as adminRevenueService from "../services/adminRevenue.service";

export const getRevenue = asyncHandler(async (_req, res) => {
  const revenue = await adminRevenueService.getAdminRevenue();
  res.status(200).json(revenue);
});
