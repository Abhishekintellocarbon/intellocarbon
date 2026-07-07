import { asyncHandler } from "../utils/asyncHandler";
import * as verifierFacilityService from "../services/verifierFacility.service";

export const listAssignedFacilities = asyncHandler(async (req, res) => {
  const facilities = await verifierFacilityService.listAssignedFacilities(req.user!.sub);
  res.status(200).json({ facilities });
});

export const getFacilityDetail = asyncHandler(async (req, res) => {
  const facility = await verifierFacilityService.getFacilityDetail(req.user!.sub, req.params.facilityId);
  res.status(200).json(facility);
});

export const downloadDocument = asyncHandler(async (req, res) => {
  const { fileName, fileData } = await verifierFacilityService.getDocumentFile(
    req.user!.sub,
    req.params.facilityId,
    req.params.documentId,
  );
  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  res.send(fileData);
});
