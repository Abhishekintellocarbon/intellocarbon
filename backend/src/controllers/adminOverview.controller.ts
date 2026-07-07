import { asyncHandler } from "../utils/asyncHandler";
import * as adminOverviewService from "../services/adminOverview.service";

export const getOverview = asyncHandler(async (_req, res) => {
  const overview = await adminOverviewService.getAdminOverview();
  res.status(200).json(overview);
});
