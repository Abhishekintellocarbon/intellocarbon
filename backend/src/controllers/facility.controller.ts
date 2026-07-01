import { asyncHandler } from "../utils/asyncHandler";
import * as facilityService from "../services/facility.service";

export const listFacilities = asyncHandler(async (req, res) => {
  const facilities = await facilityService.listFacilities(req.user!.sub);
  res.status(200).json({ facilities });
});

export const createFacility = asyncHandler(async (req, res) => {
  const facility = await facilityService.createFacility(req.user!.sub, req.body);
  res.status(201).json({ facility });
});

export const getFacility = asyncHandler(async (req, res) => {
  const facility = await facilityService.getFacility(req.user!.sub, req.params.facilityId);
  res.status(200).json({ facility });
});

export const updateFacility = asyncHandler(async (req, res) => {
  const facility = await facilityService.updateFacility(req.user!.sub, req.params.facilityId, req.body);
  res.status(200).json({ facility });
});

export const deleteFacility = asyncHandler(async (req, res) => {
  await facilityService.deleteFacility(req.user!.sub, req.params.facilityId);
  res.status(204).send();
});
