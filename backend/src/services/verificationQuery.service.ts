import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";
import { requireOwnedFacility } from "./facility.service";
import { sendVerificationQueryRaisedEmail } from "./email.service";

export const raiseQuery = async (verifierId: string, verificationRequestId: string, queryText: string) => {
  const request = await prisma.verificationRequest.findUnique({
    where: { id: verificationRequestId },
    include: { activityData: { include: { facility: { include: { company: { include: { owner: true } } } } } } },
  });
  if (!request) {
    throw AppError.notFound("Verification request not found");
  }
  if (request.verifierId !== verifierId) {
    throw AppError.forbidden("You can only raise queries on requests assigned to you");
  }

  const facility = request.activityData.facility;

  const query = await prisma.verificationQuery.create({
    data: {
      verificationRequestId,
      companyId: request.companyId,
      facilityId: facility.id,
      raisedByVerifierId: verifierId,
      queryText,
    },
  });

  sendVerificationQueryRaisedEmail(facility.company.owner.email, facility.name, queryText, facility.id).catch(() => {});

  return query;
};

export const listQueriesForRequest = async (verifierId: string, verificationRequestId: string) => {
  const request = await prisma.verificationRequest.findUnique({ where: { id: verificationRequestId } });
  if (!request) {
    throw AppError.notFound("Verification request not found");
  }
  if (request.verifierId !== verifierId) {
    throw AppError.forbidden("You can only view queries for requests assigned to you");
  }
  return prisma.verificationQuery.findMany({
    where: { verificationRequestId },
    orderBy: { createdAt: "desc" },
  });
};

export const listQueriesForFacility = async (userId: string, facilityId: string) => {
  await requireOwnedFacility(userId, facilityId);
  return prisma.verificationQuery.findMany({
    where: { facilityId },
    include: { raisedByVerifier: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
};

export const respondToQuery = async (userId: string, facilityId: string, queryId: string, responseText: string) => {
  await requireOwnedFacility(userId, facilityId);
  const query = await prisma.verificationQuery.findUnique({ where: { id: queryId } });
  if (!query || query.facilityId !== facilityId) {
    throw AppError.notFound("Query not found");
  }
  if (query.status === "RESOLVED") {
    throw AppError.conflict("This query has already been resolved", "ALREADY_RESOLVED");
  }

  return prisma.verificationQuery.update({
    where: { id: queryId },
    data: { responseText, status: "RESOLVED", respondedAt: new Date() },
  });
};
