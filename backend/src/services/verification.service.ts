import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";
import { requireOwnedActivityData } from "./activityData.service";
import { getAssignedCompanyIds } from "./verifierAssignment.service";
import { isAnnexVIChecklistComplete, ANNEX_VI_CHECKLIST_IDS } from "../data/annexVIChecklist";
import {
  sendVerificationSubmittedEmail,
  sendVerificationDecidedEmail,
  sendNewVerificationRequestEmail,
} from "./email.service";
import { env } from "../config/env";
import type { DecideVerificationInput } from "../validators/verification.validators";

const detailInclude = {
  activityData: {
    include: {
      facility: { include: { company: true } },
      fuelEntries: true,
      processMaterialEntries: true,
      precursorEntries: true,
      calculationResult: true,
      _count: { select: { documents: { where: { documentType: "SUPPORTING_EVIDENCE" as const } } } },
    },
  },
  verifier: true,
} as const;

/** "Evidence Pending" — a SUBMITTED entry with no linked supporting document. */
const withEvidencePending = <T extends { activityData: { status: string; _count: { documents: number } } }>(request: T) => ({
  ...request,
  activityData: {
    ...request.activityData,
    evidencePending: request.activityData.status === "SUBMITTED" && request.activityData._count.documents === 0,
  },
});

export const submitForVerification = async (userId: string, facilityId: string, activityDataId: string) => {
  const activityData = await requireOwnedActivityData(userId, facilityId, activityDataId);

  if (activityData.status !== "SUBMITTED") {
    throw AppError.badRequest(
      "Complete and submit this activity data entry before requesting verification",
      "ACTIVITY_DATA_NOT_SUBMITTED",
    );
  }

  const existing = await prisma.verificationRequest.findUnique({ where: { activityDataId } });
  if (existing) {
    throw AppError.conflict("This activity data entry has already been submitted for verification", "ALREADY_SUBMITTED");
  }

  const facility = await prisma.facility.findUniqueOrThrow({
    where: { id: facilityId },
    include: { company: { include: { owner: true } } },
  });

  const request = await prisma.verificationRequest.create({
    data: {
      activityDataId: activityData.id,
      companyId: facility.companyId,
    },
  });

  sendVerificationSubmittedEmail(facility.company.owner.email, facility.name).catch(() => {});

  // Only notify verifiers actually assigned to this company — the portal
  // no longer exposes an open pool of every company's requests.
  const assignedVerifiers = await prisma.verifierCompanyAssignment.findMany({
    where: { companyId: facility.companyId },
    include: { verifier: { select: { email: true } } },
  });
  Promise.all(assignedVerifiers.map((a) => sendNewVerificationRequestEmail(a.verifier.email, facility.name))).catch(() => {});

  return request;
};

export const getVerificationStatus = async (userId: string, facilityId: string, activityDataId: string) => {
  await requireOwnedActivityData(userId, facilityId, activityDataId);
  return prisma.verificationRequest.findUnique({
    where: { activityDataId },
    include: { verifier: { select: { id: true, name: true } } },
  });
};

export const listPending = async (verifierId: string) => {
  const companyIds = await getAssignedCompanyIds(verifierId);
  const requests = await prisma.verificationRequest.findMany({
    where: { status: "PENDING", companyId: { in: companyIds } },
    include: detailInclude,
    orderBy: { submittedAt: "asc" },
  });
  return requests.map(withEvidencePending);
};

export const listMyAssignments = async (verifierId: string) => {
  const requests = await prisma.verificationRequest.findMany({
    where: { verifierId },
    include: detailInclude,
    orderBy: { updatedAt: "desc" },
  });
  return requests.map(withEvidencePending);
};

const requireRequestVisibleTo = async (verifierId: string, requestId: string) => {
  const request = await prisma.verificationRequest.findUnique({
    where: { id: requestId },
    include: detailInclude,
  });
  if (!request) throw AppError.notFound("Verification request not found");
  if (request.verifierId && request.verifierId !== verifierId) {
    throw AppError.forbidden("This request has been claimed by another verifier");
  }
  if (!request.verifierId) {
    const companyIds = await getAssignedCompanyIds(verifierId);
    if (!companyIds.includes(request.companyId)) {
      throw AppError.forbidden("You are not assigned to this company", "NOT_ASSIGNED");
    }
  }
  return withEvidencePending(request);
};

export const getRequestDetail = async (verifierId: string, requestId: string) =>
  requireRequestVisibleTo(verifierId, requestId);

export const claimRequest = async (verifierId: string, requestId: string) => {
  const request = await requireRequestVisibleTo(verifierId, requestId);
  if (request.status !== "PENDING") {
    throw AppError.conflict("This request has already been claimed", "ALREADY_CLAIMED");
  }
  return prisma.verificationRequest.update({
    where: { id: requestId },
    data: { verifierId, status: "IN_REVIEW" },
  });
};

export const updateChecklist = async (verifierId: string, requestId: string, incoming: Record<string, boolean>) => {
  const request = await prisma.verificationRequest.findUnique({ where: { id: requestId } });
  if (!request) throw AppError.notFound("Verification request not found");
  if (request.verifierId !== verifierId) {
    throw AppError.forbidden("You can only update the checklist for requests assigned to you");
  }
  if (request.status !== "IN_REVIEW") {
    throw AppError.conflict("This request is not currently under review", "NOT_IN_REVIEW");
  }

  const existingState = (request.checklistState ?? {}) as Record<string, unknown>;
  const merged: Record<string, boolean> = { ...existingState } as Record<string, boolean>;
  for (const id of ANNEX_VI_CHECKLIST_IDS) {
    if (id in incoming) merged[id] = Boolean(incoming[id]);
  }

  return prisma.verificationRequest.update({
    where: { id: requestId },
    data: { checklistState: merged },
  });
};

export const decideRequest = async (
  verifierId: string,
  requestId: string,
  input: DecideVerificationInput,
) => {
  const request = await prisma.verificationRequest.findUnique({ where: { id: requestId } });
  if (!request) throw AppError.notFound("Verification request not found");
  if (request.verifierId !== verifierId) {
    throw AppError.forbidden("You can only decide on requests assigned to you");
  }
  if (request.status !== "IN_REVIEW") {
    throw AppError.conflict("This request is not currently under review", "NOT_IN_REVIEW");
  }

  if (input.status === "APPROVED") {
    if (!isAnnexVIChecklistComplete(request.checklistState)) {
      throw AppError.badRequest(
        "Complete every Annex VI checklist item before issuing the verification statement",
        "CHECKLIST_INCOMPLETE",
      );
    }
    const openQueryCount = await prisma.verificationQuery.count({
      where: { verificationRequestId: requestId, status: "OPEN" },
    });
    if (openQueryCount > 0) {
      throw AppError.badRequest(
        "Resolve every open query before issuing the verification statement",
        "OPEN_QUERIES_REMAIN",
      );
    }
  }

  const verifier = await prisma.user.findUniqueOrThrow({ where: { id: verifierId } });

  const updated = await prisma.verificationRequest.update({
    where: { id: requestId },
    data: {
      status: input.status,
      verifierOrg: input.verifierOrg || null,
      accreditationNumber: input.accreditationNumber || null,
      statement: input.statement || null,
      qualifications: input.qualifications || null,
      comments: input.comments || null,
      decidedAt: new Date(),
    },
  });

  const company = await prisma.company.findUnique({
    where: { id: request.companyId },
    include: { owner: true },
  });
  const activityData = await prisma.activityData.findUnique({
    where: { id: request.activityDataId },
    include: { facility: true },
  });

  if (company && activityData) {
    sendVerificationDecidedEmail(
      company.owner.email,
      activityData.facility.name,
      input.status === "APPROVED",
      `${env.CLIENT_URL}/facilities/${activityData.facilityId}/data-entry/${activityData.id}`,
    ).catch(() => {});
  }

  return { ...updated, verifierName: verifier.name };
};
