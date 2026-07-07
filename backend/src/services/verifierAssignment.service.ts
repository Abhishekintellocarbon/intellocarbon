import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";

export const listVerifiers = () =>
  prisma.user.findMany({
    where: { role: "VERIFIER" },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });

export const assignVerifierToCompany = async (companyId: string, verifierId: string) => {
  const verifier = await prisma.user.findUnique({ where: { id: verifierId } });
  if (!verifier || verifier.role !== "VERIFIER") {
    throw AppError.badRequest("That user is not a verifier", "NOT_A_VERIFIER");
  }

  return prisma.verifierCompanyAssignment.upsert({
    where: { verifierId_companyId: { verifierId, companyId } },
    create: { verifierId, companyId },
    update: {},
    include: { verifier: { select: { id: true, name: true, email: true } } },
  });
};

export const unassignVerifierFromCompany = async (companyId: string, verifierId: string) => {
  await prisma.verifierCompanyAssignment.deleteMany({ where: { companyId, verifierId } });
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
