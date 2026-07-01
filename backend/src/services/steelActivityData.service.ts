import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";
import { requireOwnedFacility } from "./facility.service";
import { calculateEmissionsForActivityData } from "./emissionCalculation.service";
import type { SteelActivityDataInput } from "../validators/steelActivityData.validators";

const cleanOptional = (value?: string) => (value ? value : undefined);

const requireOwnedActivityData = async (userId: string, facilityId: string, activityDataId: string) => {
  await requireOwnedFacility(userId, facilityId);

  const activityData = await prisma.steelActivityData.findUnique({
    where: { id: activityDataId },
  });

  if (!activityData || activityData.facilityId !== facilityId) {
    throw AppError.notFound("Activity data entry not found");
  }

  return activityData;
};

export const listActivityData = async (userId: string, facilityId: string) => {
  await requireOwnedFacility(userId, facilityId);

  return prisma.steelActivityData.findMany({
    where: { facilityId },
    include: { calculationResult: true },
    orderBy: { periodStart: "desc" },
  });
};

export const createActivityData = async (
  userId: string,
  facilityId: string,
  input: SteelActivityDataInput,
) => {
  await requireOwnedFacility(userId, facilityId);

  const created = await prisma.steelActivityData.create({
    data: {
      facilityId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      productCategory: input.productCategory,
      productionQuantityT: input.productionQuantityT,
      gridElectricityMwh: input.gridElectricityMwh,
      renewableElectricityMwh: input.renewableElectricityMwh,
      gridEmissionFactorOverride: input.gridEmissionFactorOverride,
      steamImportedGj: input.steamImportedGj,
      steamEmissionFactorOverride: input.steamEmissionFactorOverride,
      notes: cleanOptional(input.notes),
      status: "SUBMITTED",
      fuelEntries: {
        create: input.fuelEntries.map((entry) => ({
          fuelType: entry.fuelType,
          quantity: entry.quantity,
          unit: entry.unit,
          emissionFactorOverrideCo2: entry.emissionFactorOverrideCo2,
        })),
      },
      processMaterialEntries: {
        create: input.processMaterialEntries.map((entry) => ({
          materialType: entry.materialType,
          quantityTonnes: entry.quantityTonnes,
          emissionFactorOverride: entry.emissionFactorOverride,
        })),
      },
      precursorEntries: {
        create: input.precursorEntries.map((entry) => ({
          materialType: entry.materialType,
          quantityTonnes: entry.quantityTonnes,
          embeddedEmissionFactorOverride: entry.embeddedEmissionFactorOverride,
          sourceLabel: cleanOptional(entry.sourceLabel),
        })),
      },
    },
  });

  await calculateEmissionsForActivityData(created.id);

  return prisma.steelActivityData.findUniqueOrThrow({
    where: { id: created.id },
    include: {
      fuelEntries: true,
      processMaterialEntries: true,
      precursorEntries: true,
      calculationResult: true,
    },
  });
};

export const getActivityData = async (userId: string, facilityId: string, activityDataId: string) => {
  await requireOwnedActivityData(userId, facilityId, activityDataId);

  return prisma.steelActivityData.findUniqueOrThrow({
    where: { id: activityDataId },
    include: {
      fuelEntries: true,
      processMaterialEntries: true,
      precursorEntries: true,
      calculationResult: true,
      facility: true,
      verificationRequest: { include: { verifier: { select: { id: true, name: true } } } },
    },
  });
};

export const deleteActivityData = async (userId: string, facilityId: string, activityDataId: string) => {
  await requireOwnedActivityData(userId, facilityId, activityDataId);
  await prisma.steelActivityData.delete({ where: { id: activityDataId } });
};

export { requireOwnedActivityData };
