import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";
import { requireMyCompany } from "./company.service";
import { requireCapacityForNewFacility } from "./billing.service";
import { SECTOR_FACILITY_TYPES, SECTOR_PRODUCTION_ROUTES } from "../data/cbamReferenceData";
import type { Sector } from "@prisma/client";
import type { FacilityInput, FacilityDraftInput } from "../validators/facility.validators";

const cleanOptional = (value?: string) => (value ? value : undefined);

const validateFacilityTypeAndRoute = (sector: Sector, input: FacilityInput) => {
  const allowedTypes = SECTOR_FACILITY_TYPES[sector];
  if (!allowedTypes.includes(input.facilityType)) {
    throw AppError.badRequest(
      `Facility type "${input.facilityType}" is not valid for the ${sector} sector`,
      "INVALID_FACILITY_TYPE",
    );
  }
  const allowedRoutes = SECTOR_PRODUCTION_ROUTES[sector].map((r) => r.value);
  if (!allowedRoutes.includes(input.productionRoute)) {
    throw AppError.badRequest(
      `Production route "${input.productionRoute}" is not valid for the ${sector} sector`,
      "INVALID_PRODUCTION_ROUTE",
    );
  }
};

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

// Like requireOwnedFacility, but also admits a DATA_ENTRY_INTERNAL operator
// with a FacilityAssignment for this facility — used only by the activity
// data / evidence document flows the internal portal reuses. Everything
// else (facility settings, dashboard, reports, queries) stays owner-only
// via requireOwnedFacility above, which is the intended boundary: internal
// operators get data entry, not the rest of the owner's tools.
const requireAccessibleFacility = async (userId: string, facilityId: string) => {
  const facility = await prisma.facility.findUnique({
    where: { id: facilityId },
    include: { company: true },
  });

  if (!facility) {
    throw AppError.notFound("Facility not found");
  }

  if (facility.company.ownerId === userId) {
    return facility;
  }

  const assignment = await prisma.facilityAssignment.findUnique({
    where: { userId_facilityId: { userId, facilityId } },
  });
  if (!assignment) {
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
  validateFacilityTypeAndRoute(company.sector, input);

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
  const facility = await requireOwnedFacility(userId, facilityId);
  validateFacilityTypeAndRoute(facility.company.sector, input);

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

// Autosave — permissive, never touches isDraft. `facilityId` is undefined
// on the very first blur of a brand-new form, which creates the draft row;
// every blur after that PATCHes it. Never validates facilityType/
// productionRoute against the sector's allowed list, since either may
// still be empty mid-draft — that check only runs at completeFacility.
export const autosaveFacility = async (
  userId: string,
  facilityId: string | undefined,
  input: FacilityDraftInput,
) => {
  const company = await requireMyCompany(userId);

  const data = {
    facilityType: input.facilityType ?? null,
    productionRoute: input.productionRoute ?? null,
    address: input.address ?? null,
    state: input.state ?? null,
    district: input.district ?? null,
    pincode: input.pincode ?? null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    installedCapacityTpa: input.installedCapacityTpa ?? null,
    commissioningYear: input.commissioningYear ?? null,
    productsManufactured: input.productsManufactured ?? [],
    cnCodes: input.cnCodes ?? [],
  };

  if (!facilityId) {
    await requireCapacityForNewFacility(company.id);
    return prisma.facility.create({
      data: {
        companyId: company.id,
        name: input.name?.trim() || "Untitled facility",
        isDraft: true,
        ...data,
      },
    });
  }

  const facility = await requireOwnedFacility(userId, facilityId);
  if (!facility.isDraft) {
    throw AppError.badRequest(
      "This facility is already complete — edit it from the facility page instead",
      "FACILITY_NOT_DRAFT",
    );
  }

  return prisma.facility.update({
    where: { id: facilityId },
    data: { name: input.name?.trim() || facility.name, ...data },
  });
};

// The explicit "Mark as complete" action — validates the full strict
// schema (so facilityType/productionRoute are guaranteed non-null and
// valid for the sector) and flips isDraft to false. This is the only path
// that does so; autosave above never touches it.
export const completeFacility = async (userId: string, facilityId: string, input: FacilityInput) => {
  const facility = await requireOwnedFacility(userId, facilityId);
  validateFacilityTypeAndRoute(facility.company.sector, input);

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
      isDraft: false,
    },
  });
};

export { requireOwnedFacility, requireAccessibleFacility };
