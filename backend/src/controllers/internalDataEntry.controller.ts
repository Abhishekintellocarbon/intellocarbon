import { asyncHandler } from "../utils/asyncHandler";
import * as internalDataEntryService from "../services/internalDataEntry.service";

export const listAssignedFacilities = asyncHandler(async (req, res) => {
  const facilities = await internalDataEntryService.listAssignedFacilities(req.user!.sub);
  res.status(200).json({ facilities });
});

export const getFacilityDetail = asyncHandler(async (req, res) => {
  const facility = await internalDataEntryService.getAssignedFacilityDetail(req.user!.sub, req.params.facilityId);
  res.status(200).json(facility);
});
