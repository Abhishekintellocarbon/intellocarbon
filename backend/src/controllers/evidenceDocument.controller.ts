import multer from "multer";
import type { NextFunction, Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import * as evidenceDocumentService from "../services/evidenceDocument.service";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new AppError("Unsupported file type — upload a PDF, JPG, PNG, or WEBP", 400, "UNSUPPORTED_FILE_TYPE"));
      return;
    }
    cb(null, true);
  },
});

const parseSingleFile = (req: Request, res: Response, next: NextFunction) => {
  upload.single("file")(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      return next(
        AppError.badRequest(err.code === "LIMIT_FILE_SIZE" ? "File is too large — max 10MB" : err.message, "UPLOAD_ERROR"),
      );
    }
    if (err) return next(err);
    next();
  });
};

const handleUpload = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw AppError.badRequest("No file uploaded", "NO_FILE");
  }
  const document = await evidenceDocumentService.uploadEvidenceDocument(req.user!.sub, req.params.facilityId, req.params.dataId, {
    originalname: req.file.originalname,
    buffer: req.file.buffer,
  });
  res.status(201).json({ document });
});

export const uploadEvidenceDocument = [parseSingleFile, handleUpload];

export const listFacilityDocuments = asyncHandler(async (req, res) => {
  const documents = await evidenceDocumentService.listFacilityDocuments(req.user!.sub, req.params.facilityId);
  res.status(200).json({ documents });
});

export const downloadFacilityDocument = asyncHandler(async (req, res) => {
  const { fileName, fileData } = await evidenceDocumentService.getFacilityDocumentFile(
    req.user!.sub,
    req.params.facilityId,
    req.params.documentId,
  );
  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  res.send(fileData);
});
