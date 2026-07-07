import { asyncHandler } from "../utils/asyncHandler";
import * as adminFacilitiesService from "../services/adminFacilities.service";

export const getFacilityDetail = asyncHandler(async (req, res) => {
  const facility = await adminFacilitiesService.getFacilityDetail(req.params.facilityId);
  res.status(200).json({ facility });
});

export const downloadDocument = asyncHandler(async (req, res) => {
  const { fileName, fileData } = await adminFacilitiesService.getDocumentFile(req.params.documentId);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  res.send(fileData);
});
