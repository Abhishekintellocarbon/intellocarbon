import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";

/**
 * Everything the Super Admin facility-detail page needs in one query —
 * full facility fields, owning company/owner (activity_data has no
 * per-entry submitter column, so "who submitted it" is the company owner —
 * this app has one user per company, not a multi-seat team model),
 * every activity_data entry with its calculated_emissions record, every
 * generated document, and every report.
 */
export const getFacilityDetail = async (facilityId: string) => {
  const facility = await prisma.facility.findUnique({
    where: { id: facilityId },
    include: {
      company: { include: { owner: { select: { id: true, name: true, email: true } } } },
      activityData: {
        include: {
          calculationResult: true,
          fuelEntries: true,
          processMaterialEntries: true,
          precursorEntries: true,
          _count: { select: { documents: { where: { documentType: "SUPPORTING_EVIDENCE" } } } },
        },
        orderBy: { periodEnd: "desc" },
      },
      documents: { orderBy: { createdAt: "desc" } },
      reports: { include: { document: { select: { id: true } } }, orderBy: { generatedAt: "desc" } },
      assignments: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { assignedAt: "asc" },
      },
    },
  });

  if (!facility) {
    throw AppError.notFound("Facility not found");
  }

  return {
    ...facility,
    // "Evidence Pending" — a SUBMITTED entry with no linked supporting document.
    activityData: facility.activityData.map((entry) => ({
      ...entry,
      evidencePending: entry.status === "SUBMITTED" && entry._count.documents === 0,
    })),
  };
};

/** Admin-scoped download — bypasses the facility-ownership check the customer-facing endpoint uses, since a Super Admin doesn't own the customer's facility. Gated by requireSuperAdmin at the router level instead. */
export const getDocumentFile = async (documentId: string) => {
  const document = await prisma.document.findUnique({ where: { id: documentId } });
  if (!document) {
    throw AppError.notFound("Document not found");
  }
  return { fileName: document.fileName, fileData: document.fileData };
};
