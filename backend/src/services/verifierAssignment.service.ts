import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";
import { hashPassword } from "../utils/password";
import type { CreateVerifierInput } from "../validators/verifierAssignment.validators";

export const listVerifiers = async () => {
  const verifiers = await prisma.user.findMany({
    where: { role: "VERIFIER" },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      active: true,
      _count: { select: { verifierCompanyAssignments: true } },
    },
    orderBy: { name: "asc" },
  });
  return verifiers.map(({ _count, ...v }) => ({ ...v, assignedCompanyCount: _count.verifierCompanyAssignments }));
};

// Verifiers can also self-signup via the public /signup accountType toggle
// (see auth.service.ts) — this is the alternate path where a Super Admin
// creates the account directly, already APPROVED, same as
// facilityAssignment.service.ts's createInternalOperator.
export const createVerifier = async (input: CreateVerifierInput) => {
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
      role: "VERIFIER",
      approvalStatus: "APPROVED",
    },
    select: { id: true, name: true, email: true, createdAt: true },
  });
};

export const assignVerifierToCompany = async (companyId: string, verifierId: string, assignedBy: string) => {
  const verifier = await prisma.user.findUnique({ where: { id: verifierId } });
  if (!verifier || verifier.role !== "VERIFIER") {
    throw AppError.badRequest("That user is not a verifier", "NOT_A_VERIFIER");
  }

  return prisma.verifierCompanyAssignment.upsert({
    where: { verifierId_companyId: { verifierId, companyId } },
    create: { verifierId, companyId, assignedBy },
    update: {},
    include: { verifier: { select: { id: true, name: true, email: true } } },
  });
};

export const unassignVerifierFromCompany = async (companyId: string, verifierId: string) => {
  await prisma.verifierCompanyAssignment.deleteMany({ where: { companyId, verifierId } });
};

const findVerifierOrThrow = async (verifierId: string) => {
  const verifier = await prisma.user.findUnique({ where: { id: verifierId } });
  if (!verifier || verifier.role !== "VERIFIER") {
    throw AppError.badRequest("That user is not a verifier", "NOT_A_VERIFIER");
  }
  return verifier;
};

// Deactivation unassigns every company and revokes existing sessions so
// access is lost immediately — but never touches historical records
// (cross-check reviews, verification statements, etc. stay attributed to
// this user). Reactivating never restores the old assignments.
export const deactivateVerifier = async (verifierId: string) => {
  await findVerifierOrThrow(verifierId);
  await prisma.$transaction([
    prisma.user.update({ where: { id: verifierId }, data: { active: false } }),
    prisma.verifierCompanyAssignment.deleteMany({ where: { verifierId } }),
    prisma.refreshToken.updateMany({ where: { userId: verifierId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
};

export const reactivateVerifier = async (verifierId: string) => {
  await findVerifierOrThrow(verifierId);
  await prisma.user.update({ where: { id: verifierId }, data: { active: true } });
};

/** Company ids this verifier is allowed to see anywhere in the portal — the single access-control chokepoint for every verifier-scoped query. */
export const getAssignedCompanyIds = async (verifierId: string): Promise<string[]> => {
  const assignments = await prisma.verifierCompanyAssignment.findMany({
    where: { verifierId },
    select: { companyId: true },
  });
  return assignments.map((a) => a.companyId);
};

export const requireCompanyAssigned = async (verifierId: string, companyId: string): Promise<void> => {
  const assignment = await prisma.verifierCompanyAssignment.findUnique({
    where: { verifierId_companyId: { verifierId, companyId } },
  });
  if (!assignment) {
    throw AppError.forbidden("You are not assigned to this company", "NOT_ASSIGNED");
  }
};
