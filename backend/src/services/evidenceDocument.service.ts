import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";
import { requireAccessibleFacility } from "./facility.service";
import { requireOwnedActivityData } from "./activityData.service";

const fmt = (d: Date) => d.toISOString().slice(0, 10);

// Every download endpoint (evidence, admin, verifier) interpolates fileName
// straight into `Content-Disposition: attachment; filename="${fileName}"` —
// sanitizing once here, at the single point the raw client-supplied
// originalname enters the system, means none of those three call sites can
// forget it. Strips quotes (would break out of the quoted attribute) and
// control characters (Node's setHeader already rejects raw CR/LF, but this
// still catches other control bytes rather than relying on that alone), and
// caps length defensively.
const sanitizeFileName = (name: string): string =>
  (name.replace(/["\x00-\x1f\x7f]/g, "_").trim() || "upload").slice(0, 255);

export const uploadEvidenceDocument = async (
  userId: string,
  facilityId: string,
  activityDataId: string,
  file: { originalname: string; buffer: Buffer },
) => {
  const facility = await requireAccessibleFacility(userId, facilityId);
  const activityData = await requireOwnedActivityData(userId, facilityId, activityDataId);

  const reportingPeriod =
    activityData.periodStart && activityData.periodEnd
      ? `${fmt(activityData.periodStart)} to ${fmt(activityData.periodEnd)}`
      : "Draft period";

  return prisma.document.create({
    data: {
      facilityId,
      companyId: facility.companyId,
      activityDataId,
      documentType: "SUPPORTING_EVIDENCE",
      reportingPeriod,
      verified: false,
      fileName: sanitizeFileName(file.originalname),
      fileData: file.buffer,
    },
  });
};

export const listFacilityDocuments = async (userId: string, facilityId: string) => {
  await requireAccessibleFacility(userId, facilityId);
  return prisma.document.findMany({
    where: { facilityId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      documentType: true,
      reportingPeriod: true,
      verified: true,
      fileName: true,
      createdAt: true,
      activityDataId: true,
      reportId: true,
    },
  });
};

export const getFacilityDocumentFile = async (userId: string, facilityId: string, documentId: string) => {
  await requireAccessibleFacility(userId, facilityId);
  const document = await prisma.document.findUnique({ where: { id: documentId } });
  if (!document || document.facilityId !== facilityId) {
    throw AppError.notFound("Document not found");
  }
  return { fileName: document.fileName, fileData: document.fileData };
};
