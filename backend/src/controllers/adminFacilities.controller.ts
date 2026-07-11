import { asyncHandler } from "../utils/asyncHandler";
import * as adminFacilitiesService from "../services/adminFacilities.service";

export const getFacilityDetail = asyncHandler(async (req, res) => {
  const facility = await adminFacilitiesService.getFacilityDetail(req.params.facilityId);
  res.status(200).json({ facility });
});

export const downloadDocument = asyncHandler(async (req, res) => {
  // Not always a PDF — this serves any Document row, including uploaded
  // SUPPORTING_EVIDENCE files (JPG/PNG/WEBP allowed at upload, see
  // evidenceDocument.controller.ts), not just server-generated REPORT PDFs.
  // octet-stream + attachment (like the other two download endpoints) forces
  // a download regardless of actual content, rather than mislabeling
  // everything as a PDF.
  const { fileName, fileData } = await adminFacilitiesService.getDocumentFile(req.params.documentId);
  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  res.send(fileData);
});
