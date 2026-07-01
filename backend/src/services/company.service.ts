import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";
import type { CompanyInput } from "../validators/company.validators";

const cleanOptional = (value?: string) => (value ? value : undefined);

export const getMyCompany = async (userId: string) => {
  const company = await prisma.company.findUnique({
    where: { ownerId: userId },
    include: { _count: { select: { facilities: true } } },
  });
  return company;
};

export const requireMyCompany = async (userId: string) => {
  const company = await prisma.company.findUnique({ where: { ownerId: userId } });
  if (!company) {
    throw AppError.notFound(
      "Complete company setup before continuing",
      "COMPANY_NOT_FOUND",
    );
  }
  return company;
};

export const createCompany = async (userId: string, input: CompanyInput) => {
  const existing = await prisma.company.findUnique({ where: { ownerId: userId } });
  if (existing) {
    throw AppError.conflict("Company profile already exists for this account", "COMPANY_EXISTS");
  }

  return prisma.company.create({
    data: {
      ownerId: userId,
      name: input.name,
      registrationNumber: cleanOptional(input.registrationNumber),
      sector: input.sector,
      subSector: cleanOptional(input.subSector),
      address: cleanOptional(input.address),
      city: cleanOptional(input.city),
      state: cleanOptional(input.state),
      pincode: cleanOptional(input.pincode),
      annualTurnoverInr: input.annualTurnoverInr,
      employeeCount: input.employeeCount,
      reportingFyStartMonth: input.reportingFyStartMonth,
      appliesCbam: input.appliesCbam,
      appliesCcts: input.appliesCcts,
      isPatDesignatedConsumer: input.isPatDesignatedConsumer,
      onboardingCompletedAt: new Date(),
    },
  });
};

export const updateCompany = async (userId: string, input: CompanyInput) => {
  await requireMyCompany(userId);

  return prisma.company.update({
    where: { ownerId: userId },
    data: {
      name: input.name,
      registrationNumber: cleanOptional(input.registrationNumber),
      sector: input.sector,
      subSector: cleanOptional(input.subSector),
      address: cleanOptional(input.address),
      city: cleanOptional(input.city),
      state: cleanOptional(input.state),
      pincode: cleanOptional(input.pincode),
      annualTurnoverInr: input.annualTurnoverInr,
      employeeCount: input.employeeCount,
      reportingFyStartMonth: input.reportingFyStartMonth,
      appliesCbam: input.appliesCbam,
      appliesCcts: input.appliesCcts,
      isPatDesignatedConsumer: input.isPatDesignatedConsumer,
    },
  });
};
