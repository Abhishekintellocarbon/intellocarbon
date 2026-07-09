import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";
import { env } from "../config/env";
import { requireCompanyAssigned } from "./verifierAssignment.service";
import type { AccessTokenPayload } from "../utils/tokens";
import type { UpsertCrossCheckReviewInput } from "../validators/crossCheckReview.validators";

const superAdminEmails = env.SUPER_ADMIN_EMAILS.split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const isSuperAdmin = (email: string): boolean => superAdminEmails.includes(email.toLowerCase());

/** Single access-control chokepoint for cross-check review — a Super Admin sees every company, a Verifier only companies they're assigned to. */
const requireReviewerAccess = async (user: AccessTokenPayload, companyId: string): Promise<void> => {
  if (isSuperAdmin(user.email)) return;
  if (user.role === "VERIFIER") {
    await requireCompanyAssigned(user.sub, companyId);
    return;
  }
  throw AppError.forbidden("You don't have access to cross-check review", "FORBIDDEN_ROLE");
};

export const upsertCrossCheckReview = async (
  user: AccessTokenPayload,
  activityDataId: string,
  documentId: string,
  input: UpsertCrossCheckReviewInput,
) => {
  const document = await prisma.document.findUnique({ where: { id: documentId } });
  if (!document || document.activityDataId !== activityDataId) {
    throw AppError.notFound("Document not found for this activity data entry");
  }

  await requireReviewerAccess(user, document.companyId);

  const review = await prisma.crossCheckReview.upsert({
    where: { documentId },
    create: {
      activityDataId,
      documentId,
      status: input.status,
      notes: input.notes ?? null,
      reviewedBy: user.sub,
      reviewedAt: new Date(),
    },
    update: {
      status: input.status,
      notes: input.notes ?? null,
      reviewedBy: user.sub,
      reviewedAt: new Date(),
    },
    include: { reviewer: { select: { id: true, name: true, email: true } } },
  });

  return review;
};

/**
 * One entry per SUBMITTED activity_data row that has at least one linked
 * SUPPORTING_EVIDENCE document, each carrying its documents paired with
 * their review (null review == NOT_REVIEWED, never persisted until acted on).
 */
export const listCrossCheckReviewsForFacility = async (user: AccessTokenPayload, facilityId: string) => {
  const facility = await prisma.facility.findUnique({ where: { id: facilityId } });
  if (!facility) {
    throw AppError.notFound("Facility not found");
  }

  await requireReviewerAccess(user, facility.companyId);

  const entries = await prisma.activityData.findMany({
    where: {
      facilityId,
      status: "SUBMITTED",
      documents: { some: { documentType: "SUPPORTING_EVIDENCE" } },
    },
    include: {
      fuelEntries: true,
      processMaterialEntries: true,
      precursorEntries: true,
      documents: {
        where: { documentType: "SUPPORTING_EVIDENCE" },
        select: {
          id: true,
          fileName: true,
          createdAt: true,
          crossCheckReview: {
            include: { reviewer: { select: { id: true, name: true, email: true } } },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { periodEnd: "desc" },
  });

  return entries;
};
