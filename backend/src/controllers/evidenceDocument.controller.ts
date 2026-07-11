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

// multer's fileFilter only sees the client-declared Content-Type header —
// trusting it alone means uploading e.g. an HTML/SVG file with a script
// payload just requires lying about the header. This checks the actual
// bytes against each allowed type's magic number instead. Runs here rather
// than in fileFilter because with memoryStorage the buffer isn't available
// until the upload completes — fileFilter only ever sees file metadata.
const matchesMagicBytes = (mimetype: string, buffer: Buffer): boolean => {
  switch (mimetype) {
    case "application/pdf":
      return buffer.subarray(0, 5).toString("latin1") === "%PDF-";
    case "image/jpeg":
      return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    case "image/png":
      return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case "image/webp":
      return (
        buffer.length >= 12 &&
        buffer.subarray(0, 4).toString("latin1") === "RIFF" &&
        buffer.subarray(8, 12).toString("latin1") === "WEBP"
      );
    default:
      return false;
  }
};

const handleUpload = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw AppError.badRequest("No file uploaded", "NO_FILE");
  }
  if (!matchesMagicBytes(req.file.mimetype, req.file.buffer)) {
    throw AppError.badRequest(
      "This file's content doesn't match a PDF, JPG, PNG, or WEBP — it may be mislabeled or corrupted",
      "FILE_CONTENT_MISMATCH",
    );
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
