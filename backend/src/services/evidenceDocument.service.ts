import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";
import { requireOwnedFacility } from "./facility.service";
import { requireOwnedActivityData } from "./activityData.service";

const fmt = (d: Date) => d.toISOString().slice(0, 10);

export const uploadEvidenceDocument = async (
  userId: string,
  facilityId: string,
  activityDataId: string,
  file: { originalname: string; buffer: Buffer },
) => {
  const facility = await requireOwnedFacility(userId, facilityId);
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
      fileName: file.originalname,
      fileData: file.buffer,
    },
  });
};

export const listFacilityDocuments = async (userId: string, facilityId: string) => {
  await requireOwnedFacility(userId, facilityId);
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
  await requireOwnedFacility(userId, facilityId);
  const document = await prisma.document.findUnique({ where: { id: documentId } });
  if (!document || document.facilityId !== facilityId) {
    throw AppError.notFound("Document not found");
  }
  return { fileName: document.fileName, fileData: document.fileData };
};
