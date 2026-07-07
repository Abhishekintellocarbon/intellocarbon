import { asyncHandler } from "../utils/asyncHandler";
import * as facilityDashboardService from "../services/facilityDashboard.service";

export const getFacilityDashboard = asyncHandler(async (req, res) => {
  const dashboard = await facilityDashboardService.getFacilityDashboard(req.user!.sub, req.params.facilityId);
  res.status(200).json({ dashboard });
});
