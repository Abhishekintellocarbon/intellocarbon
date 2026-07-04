import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";
import { requireOwnedFacility } from "./facility.service";
import { calculateEmissionsForActivityData } from "./emissionCalculation.service";
import type { ActivityDataInput, ActivityDataDraftInput } from "../validators/activityData.validators";

const cleanOptional = (value?: string) => (value ? value : undefined);

// Draft entry rows are only persisted once they're complete enough to
// satisfy the (non-nullable) FuelEntry/ProcessMaterialEntry/PrecursorEntry
// columns — a row with a type picked but no quantity yet, or vice versa,
// is silently dropped until both are filled. This is a deliberate
// simplification: fully preserving half-filled rows would mean loosening
// those three tables' NOT NULL constraints too.
const draftFuelEntries = (input: ActivityDataDraftInput) =>
  (input.fuelEntries ?? [])
    .filter((e) => e.fuelType && e.quantity != null)
    .map((e) => ({
      fuelType: e.fuelType as string,
      quantity: e.quantity as number,
      unit: e.unit ?? "TONNE",
      emissionFactorOverrideCo2: e.emissionFactorOverrideCo2 ?? undefined,
    }));

const draftProcessMaterialEntries = (input: ActivityDataDraftInput) =>
  (input.processMaterialEntries ?? [])
    .filter((e) => e.materialType && e.quantityTonnes != null)
    .map((e) => ({
      materialType: e.materialType as string,
      quantityTonnes: e.quantityTonnes as number,
      emissionFactorOverride: e.emissionFactorOverride ?? undefined,
    }));

const draftPrecursorEntries = (input: ActivityDataDraftInput) =>
  (input.precursorEntries ?? [])
    .filter((e) => e.materialType && e.quantityTonnes != null)
    .map((e) => ({
      materialType: e.materialType as string,
      quantityTonnes: e.quantityTonnes as number,
      embeddedEmissionFactorOverride: e.embeddedEmissionFactorOverride ?? undefined,
      sourceLabel: e.sourceLabel ?? undefined,
    }));

const requireOwnedActivityData = async (userId: string, facilityId: string, activityDataId: string) => {
  await requireOwnedFacility(userId, facilityId);

  const activityData = await prisma.activityData.findUnique({
    where: { id: activityDataId },
  });

  if (!activityData || activityData.facilityId !== facilityId) {
    throw AppError.notFound("Activity data entry not found");
  }

  return activityData;
};

export const listActivityData = async (userId: string, facilityId: string) => {
  await requireOwnedFacility(userId, facilityId);

  return prisma.activityData.findMany({
    where: { facilityId },
    include: { calculationResult: true },
    orderBy: { periodStart: "desc" },
  });
};

export const createActivityData = async (
  userId: string,
  facilityId: string,
  input: ActivityDataInput,
) => {
  const facility = await requireOwnedFacility(userId, facilityId);

  const created = await prisma.activityData.create({
    data: {
      facilityId,
      sector: facility.company.sector,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      productCategory: input.productCategory,
      productionQuantityT: input.productionQuantityT,
      gridElectricityMwh: input.gridElectricityMwh,
      renewableElectricityMwh: input.renewableElectricityMwh,
      gridEmissionFactorOverride: input.gridEmissionFactorOverride,
      steamImportedGj: input.steamImportedGj,
      steamEmissionFactorOverride: input.steamEmissionFactorOverride,
      carbonPricePaidEurPerTonne: input.carbonPricePaidEurPerTonne,
      cctsTargetIntensity: input.cctsTargetIntensity,
      limestoneInputTonnes: input.limestoneInputTonnes,
      clinkerProducedTonnes: input.clinkerProducedTonnes,
      clinkerConversionFraction: input.clinkerConversionFraction,
      cf4EmissionsTonnes: input.cf4EmissionsTonnes,
      c2f6EmissionsTonnes: input.c2f6EmissionsTonnes,
      anodeEffectMinutes: input.anodeEffectMinutes,
      n2oProcessEmissionsTonnes: input.n2oProcessEmissionsTonnes,
      n2oAbatementFactorPct: input.n2oAbatementFactorPct,
      naturalGasFeedstockNm3: input.naturalGasFeedstockNm3,
      hydrogenRoute: input.hydrogenRoute,
      ccsCaptureRatePct: input.ccsCaptureRatePct,
      hydrogenPurityPct: input.hydrogenPurityPct,
      byproductOxygenTonnes: input.byproductOxygenTonnes,
      electricityGeneratedMwh: input.electricityGeneratedMwh,
      electricityExportedEuMwh: input.electricityExportedEuMwh,
      ownUseElectricityMwh: input.ownUseElectricityMwh,
      lineLossMwh: input.lineLossMwh,
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

  return prisma.activityData.findUniqueOrThrow({
    where: { id: created.id },
    include: {
      fuelEntries: true,
      processMaterialEntries: true,
      precursorEntries: true,
      calculationResult: true,
    },
  });
};

// Autosave — permissive, always leaves status at DRAFT and never
// calculates. `activityDataId` is undefined on the first blur of a new
// entry, which creates the draft row; every blur after that PATCHes it.
export const autosaveActivityData = async (
  userId: string,
  facilityId: string,
  activityDataId: string | undefined,
  input: ActivityDataDraftInput,
) => {
  const facility = await requireOwnedFacility(userId, facilityId);

  const scalarData = {
    periodStart: input.periodStart ?? null,
    periodEnd: input.periodEnd ?? null,
    productCategory: input.productCategory ?? null,
    productionQuantityT: input.productionQuantityT ?? null,
    gridElectricityMwh: input.gridElectricityMwh ?? 0,
    renewableElectricityMwh: input.renewableElectricityMwh ?? 0,
    gridEmissionFactorOverride: input.gridEmissionFactorOverride ?? null,
    steamImportedGj: input.steamImportedGj ?? 0,
    steamEmissionFactorOverride: input.steamEmissionFactorOverride ?? null,
    carbonPricePaidEurPerTonne: input.carbonPricePaidEurPerTonne ?? null,
    cctsTargetIntensity: input.cctsTargetIntensity ?? null,
    limestoneInputTonnes: input.limestoneInputTonnes ?? null,
    clinkerProducedTonnes: input.clinkerProducedTonnes ?? null,
    clinkerConversionFraction: input.clinkerConversionFraction ?? null,
    cf4EmissionsTonnes: input.cf4EmissionsTonnes ?? null,
    c2f6EmissionsTonnes: input.c2f6EmissionsTonnes ?? null,
    anodeEffectMinutes: input.anodeEffectMinutes ?? null,
    n2oProcessEmissionsTonnes: input.n2oProcessEmissionsTonnes ?? null,
    n2oAbatementFactorPct: input.n2oAbatementFactorPct ?? null,
    naturalGasFeedstockNm3: input.naturalGasFeedstockNm3 ?? null,
    hydrogenRoute: input.hydrogenRoute ?? null,
    ccsCaptureRatePct: input.ccsCaptureRatePct ?? null,
    hydrogenPurityPct: input.hydrogenPurityPct ?? null,
    byproductOxygenTonnes: input.byproductOxygenTonnes ?? null,
    electricityGeneratedMwh: input.electricityGeneratedMwh ?? null,
    electricityExportedEuMwh: input.electricityExportedEuMwh ?? null,
    ownUseElectricityMwh: input.ownUseElectricityMwh ?? null,
    lineLossMwh: input.lineLossMwh ?? null,
    notes: input.notes ?? null,
  };

  if (!activityDataId) {
    return prisma.activityData.create({
      data: {
        facilityId,
        sector: facility.company.sector,
        status: "DRAFT",
        ...scalarData,
        fuelEntries: { create: draftFuelEntries(input) },
        processMaterialEntries: { create: draftProcessMaterialEntries(input) },
        precursorEntries: { create: draftPrecursorEntries(input) },
      },
      include: { fuelEntries: true, processMaterialEntries: true, precursorEntries: true },
    });
  }

  const activityData = await requireOwnedActivityData(userId, facilityId, activityDataId);
  if (activityData.status !== "DRAFT") {
    throw AppError.badRequest(
      "This entry has already been submitted — it can no longer be autosaved",
      "ACTIVITY_DATA_NOT_DRAFT",
    );
  }

  return prisma.activityData.update({
    where: { id: activityDataId },
    data: {
      ...scalarData,
      fuelEntries: { deleteMany: {}, create: draftFuelEntries(input) },
      processMaterialEntries: { deleteMany: {}, create: draftProcessMaterialEntries(input) },
      precursorEntries: { deleteMany: {}, create: draftPrecursorEntries(input) },
    },
    include: { fuelEntries: true, processMaterialEntries: true, precursorEntries: true },
  });
};

// The explicit "Submit" / "Mark as complete" action — validates the full
// strict schema (dates, product category, quantities all required and
// non-null) and only then flips status to SUBMITTED and runs the
// calculation engine. This is the only path that does either.
export const submitActivityData = async (
  userId: string,
  facilityId: string,
  activityDataId: string,
  input: ActivityDataInput,
) => {
  await requireOwnedActivityData(userId, facilityId, activityDataId);

  await prisma.activityData.update({
    where: { id: activityDataId },
    data: {
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      productCategory: input.productCategory,
      productionQuantityT: input.productionQuantityT,
      gridElectricityMwh: input.gridElectricityMwh,
      renewableElectricityMwh: input.renewableElectricityMwh,
      gridEmissionFactorOverride: input.gridEmissionFactorOverride,
      steamImportedGj: input.steamImportedGj,
      steamEmissionFactorOverride: input.steamEmissionFactorOverride,
      carbonPricePaidEurPerTonne: input.carbonPricePaidEurPerTonne,
      cctsTargetIntensity: input.cctsTargetIntensity,
      limestoneInputTonnes: input.limestoneInputTonnes,
      clinkerProducedTonnes: input.clinkerProducedTonnes,
      clinkerConversionFraction: input.clinkerConversionFraction,
      cf4EmissionsTonnes: input.cf4EmissionsTonnes,
      c2f6EmissionsTonnes: input.c2f6EmissionsTonnes,
      anodeEffectMinutes: input.anodeEffectMinutes,
      n2oProcessEmissionsTonnes: input.n2oProcessEmissionsTonnes,
      n2oAbatementFactorPct: input.n2oAbatementFactorPct,
      naturalGasFeedstockNm3: input.naturalGasFeedstockNm3,
      hydrogenRoute: input.hydrogenRoute,
      ccsCaptureRatePct: input.ccsCaptureRatePct,
      hydrogenPurityPct: input.hydrogenPurityPct,
      byproductOxygenTonnes: input.byproductOxygenTonnes,
      electricityGeneratedMwh: input.electricityGeneratedMwh,
      electricityExportedEuMwh: input.electricityExportedEuMwh,
      ownUseElectricityMwh: input.ownUseElectricityMwh,
      lineLossMwh: input.lineLossMwh,
      notes: cleanOptional(input.notes),
      status: "SUBMITTED",
      fuelEntries: {
        deleteMany: {},
        create: input.fuelEntries.map((entry) => ({
          fuelType: entry.fuelType,
          quantity: entry.quantity,
          unit: entry.unit,
          emissionFactorOverrideCo2: entry.emissionFactorOverrideCo2,
        })),
      },
      processMaterialEntries: {
        deleteMany: {},
        create: input.processMaterialEntries.map((entry) => ({
          materialType: entry.materialType,
          quantityTonnes: entry.quantityTonnes,
          emissionFactorOverride: entry.emissionFactorOverride,
        })),
      },
      precursorEntries: {
        deleteMany: {},
        create: input.precursorEntries.map((entry) => ({
          materialType: entry.materialType,
          quantityTonnes: entry.quantityTonnes,
          embeddedEmissionFactorOverride: entry.embeddedEmissionFactorOverride,
          sourceLabel: cleanOptional(entry.sourceLabel),
        })),
      },
    },
  });

  await calculateEmissionsForActivityData(activityDataId);

  return prisma.activityData.findUniqueOrThrow({
    where: { id: activityDataId },
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

  return prisma.activityData.findUniqueOrThrow({
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
  await prisma.activityData.delete({ where: { id: activityDataId } });
};

export { requireOwnedActivityData };
