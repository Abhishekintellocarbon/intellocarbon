import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";
import { hashPassword } from "../utils/password";
import type { CreateInternalOperatorInput } from "../validators/facilityAssignment.validators";

export const listInternalOperators = () =>
  prisma.user.findMany({
    where: { role: "DATA_ENTRY_INTERNAL" },
    select: { id: true, name: true, email: true, createdAt: true },
    orderBy: { name: "asc" },
  });

// Internal operators don't self-signup — a Super Admin creates the account
// directly, already APPROVED (there's no company/approval workflow for
// Intellocarbon's own staff to wait through).
export const createInternalOperator = async (input: CreateInternalOperatorInput) => {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw AppError.conflict("An account with this email already exists", "EMAIL_TAKEN");
  }

  const passwordHash = await hashPassword(input.password);
  return prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
      role: "DATA_ENTRY_INTERNAL",
      approvalStatus: "APPROVED",
    },
    select: { id: true, name: true, email: true, createdAt: true },
  });
};

export const assignOperatorToFacility = async (facilityId: string, userId: string, assignedBy: string) => {
  const operator = await prisma.user.findUnique({ where: { id: userId } });
  if (!operator || operator.role !== "DATA_ENTRY_INTERNAL") {
    throw AppError.badRequest("That user is not an internal data entry operator", "NOT_AN_INTERNAL_OPERATOR");
  }

  const facility = await prisma.facility.findUnique({ where: { id: facilityId } });
  if (!facility) {
    throw AppError.notFound("Facility not found");
  }

  return prisma.facilityAssignment.upsert({
    where: { userId_facilityId: { userId, facilityId } },
    create: { userId, facilityId, assignedBy },
    update: {},
    include: { user: { select: { id: true, name: true, email: true } } },
  });
};

export const unassignOperatorFromFacility = async (facilityId: string, userId: string) => {
  await prisma.facilityAssignment.deleteMany({ where: { facilityId, userId } });
};

export const listAssignmentsForFacility = (facilityId: string) =>
  prisma.facilityAssignment.findMany({
    where: { facilityId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { assignedAt: "asc" },
  });

/** Facility ids this internal operator may see anywhere in the portal — the single access-control chokepoint for the internal data-entry portal. */
export const getAssignedFacilityIds = async (userId: string): Promise<string[]> => {
  const assignments = await prisma.facilityAssignment.findMany({
    where: { userId },
    select: { facilityId: true },
  });
  return assignments.map((a) => a.facilityId);
};

export const requireFacilityAssigned = async (userId: string, facilityId: string): Promise<void> => {
  const assignment = await prisma.facilityAssignment.findUnique({
    where: { userId_facilityId: { userId, facilityId } },
  });
  if (!assignment) {
    throw AppError.notFound("Facility not found");
  }
};
