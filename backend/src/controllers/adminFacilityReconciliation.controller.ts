import { asyncHandler } from "../utils/asyncHandler";
import * as adminFacilityReconciliationService from "../services/adminFacilityReconciliation.service";

export const getFacilityReconciliation = asyncHandler(async (_req, res) => {
  const report = await adminFacilityReconciliationService.getFacilityReconciliationReport();
  res.status(200).json(report);
});
