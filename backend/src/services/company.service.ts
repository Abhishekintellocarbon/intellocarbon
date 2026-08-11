import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";
import type { CompanyInput } from "../validators/company.validators";

const cleanOptional = (value?: string) => (value ? value : undefined);

export const getMyCompany = async (userId: string) => {
  const company = await prisma.company.findUnique({
    where: { ownerId: userId },
    include: {
      _count: { select: { facilities: true } },
      // Drives `esgBundleActive` below. Fetched through the same query rather
      // than a second round trip, for the reason spelled out in
      // requireOwnedFacilityForEsgBundle.
      subscriptions: {
        where: { status: "ACTIVE", tier: "BRSR_CORE_REPORTING" },
        select: { id: true },
      },
    },
  });
  if (!company) return null;

  // Whether the company holds the ESG Disclosure Bundle. Exposed here because
  // the activity-data form already calls this endpoint and uses it to decide
  // whether to offer the optional ISO 14046 water inventory section — the
  // authoritative gate is still server-side on the ESG Overview aggregate;
  // this only avoids showing a section the company can't use.
  const { subscriptions, ...rest } = company;
  return { ...rest, esgBundleActive: subscriptions.length > 0 };
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
      gstin: cleanOptional(input.gstin),
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
      ownershipModel: input.ownershipModel,
      businessModel: input.businessModel,
      onboardingCompletedAt: new Date(),
      euImporterName: cleanOptional(input.euImporterName),
      euImporterEori: cleanOptional(input.euImporterEori),
      euImporterCountry: cleanOptional(input.euImporterCountry),
      euImporterContactEmail: cleanOptional(input.euImporterContactEmail),
      euImporterContactPhone: cleanOptional(input.euImporterContactPhone),
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
      gstin: cleanOptional(input.gstin),
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
      ownershipModel: input.ownershipModel,
      businessModel: input.businessModel,
      euImporterName: cleanOptional(input.euImporterName),
      euImporterEori: cleanOptional(input.euImporterEori),
      euImporterCountry: cleanOptional(input.euImporterCountry),
      euImporterContactEmail: cleanOptional(input.euImporterContactEmail),
      euImporterContactPhone: cleanOptional(input.euImporterContactPhone),
    },
  });
};
