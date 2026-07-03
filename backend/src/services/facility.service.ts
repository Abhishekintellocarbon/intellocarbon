import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";
import { requireMyCompany } from "./company.service";
import { requireCapacityForNewFacility } from "./billing.service";
import type { FacilityInput } from "../validators/facility.validators";

const cleanOptional = (value?: string) => (value ? value : undefined);

const requireOwnedFacility = async (userId: string, facilityId: string) => {
  const facility = await prisma.facility.findUnique({
    where: { id: facilityId },
    include: { company: true },
  });

  if (!facility || facility.company.ownerId !== userId) {
    throw AppError.notFound("Facility not found");
  }

  return facility;
};

export const listFacilities = async (userId: string) => {
  const company = await requireMyCompany(userId);
  return prisma.facility.findMany({
    where: { companyId: company.id },
    include: { _count: { select: { activityData: true } } },
    orderBy: { createdAt: "desc" },
  });
};

export const createFacility = async (userId: string, input: FacilityInput) => {
  const company = await requireMyCompany(userId);
  await requireCapacityForNewFacility(company.id);

  return prisma.facility.create({
    data: {
      companyId: company.id,
      name: input.name,
      facilityType: input.facilityType,
      productionRoute: input.productionRoute,
      address: cleanOptional(input.address),
      state: cleanOptional(input.state),
      district: cleanOptional(input.district),
      pincode: cleanOptional(input.pincode),
      latitude: input.latitude,
      longitude: input.longitude,
      installedCapacityTpa: input.installedCapacityTpa,
      commissioningYear: input.commissioningYear,
      productsManufactured: input.productsManufactured,
      cnCodes: input.cnCodes,
    },
  });
};

export const getFacility = async (userId: string, facilityId: string) => {
  const facility = await requireOwnedFacility(userId, facilityId);
  return facility;
};

export const updateFacility = async (userId: string, facilityId: string, input: FacilityInput) => {
  await requireOwnedFacility(userId, facilityId);

  return prisma.facility.update({
    where: { id: facilityId },
    data: {
      name: input.name,
      facilityType: input.facilityType,
      productionRoute: input.productionRoute,
      address: cleanOptional(input.address),
      state: cleanOptional(input.state),
      district: cleanOptional(input.district),
      pincode: cleanOptional(input.pincode),
      latitude: input.latitude,
      longitude: input.longitude,
      installedCapacityTpa: input.installedCapacityTpa,
      commissioningYear: input.commissioningYear,
      productsManufactured: input.productsManufactured,
      cnCodes: input.cnCodes,
    },
  });
};

export const deleteFacility = async (userId: string, facilityId: string) => {
  await requireOwnedFacility(userId, facilityId);
  await prisma.facility.delete({ where: { id: facilityId } });
};

export { requireOwnedFacility };
