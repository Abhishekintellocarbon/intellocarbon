import type { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";
import {
  DEFAULT_GRID_EMISSION_FACTOR,
  DEFAULT_STEAM_EMISSION_FACTOR,
  FUEL_LIBRARY,
  PRECURSOR_LIBRARY,
  PROCESS_MATERIAL_LIBRARY,
} from "../data/emissionFactors";
import { GWP_AR4, GWP_AR5 } from "../data/gwpTables";

const round = (value: number, decimals = 4) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

interface FuelLineResult {
  fuelType: string;
  label: string;
  quantity: number;
  unit: string;
  co2Tonnes: number;
  ch4Kg: number;
  n2oKg: number;
  co2eAr5: number;
  co2eAr4: number;
}

interface ProcessMaterialLineResult {
  materialType: string;
  label: string;
  quantityTonnes: number;
  emissionFactorUsed: number;
  isOverride: boolean;
  co2Tonnes: number;
}

interface PrecursorLineResult {
  materialType: string;
  label: string;
  quantityTonnes: number;
  emissionFactorUsed: number;
  isOverride: boolean;
  co2eTonnes: number;
}

export const calculateEmissionsForActivityData = async (activityDataId: string) => {
  const activityData = await prisma.steelActivityData.findUnique({
    where: { id: activityDataId },
    include: {
      fuelEntries: true,
      processMaterialEntries: true,
      precursorEntries: true,
    },
  });

  if (!activityData) {
    throw AppError.notFound("Activity data entry not found");
  }

  if (activityData.productionQuantityT <= 0) {
    throw AppError.badRequest(
      "Production quantity must be greater than zero to calculate emissions",
      "INVALID_PRODUCTION_QUANTITY",
    );
  }

  // --- Fuel combustion (direct, Scope 1) ---
  const fuelLines: FuelLineResult[] = activityData.fuelEntries.map((entry) => {
    const def = FUEL_LIBRARY[entry.fuelType];
    if (!def) {
      throw AppError.badRequest(`Unknown fuel type: ${entry.fuelType}`, "UNKNOWN_FUEL_TYPE");
    }
    const efCo2 = entry.emissionFactorOverrideCo2 ?? def.efCo2PerUnit;
    const co2Tonnes = entry.quantity * efCo2;
    const ch4Kg = entry.quantity * def.efCh4PerUnit;
    const n2oKg = entry.quantity * def.efN2oPerUnit;

    return {
      fuelType: entry.fuelType,
      label: def.label,
      quantity: entry.quantity,
      unit: entry.unit,
      co2Tonnes,
      ch4Kg,
      n2oKg,
      co2eAr5: co2Tonnes + (ch4Kg / 1000) * GWP_AR5.ch4 + (n2oKg / 1000) * GWP_AR5.n2o,
      co2eAr4: co2Tonnes + (ch4Kg / 1000) * GWP_AR4.ch4 + (n2oKg / 1000) * GWP_AR4.n2o,
    };
  });

  const directCombustionCo2eAr5 = fuelLines.reduce((sum, l) => sum + l.co2eAr5, 0);
  const directCombustionCo2eAr4 = fuelLines.reduce((sum, l) => sum + l.co2eAr4, 0);

  // --- Process emissions (calcination etc.), CO2-only, same under both GWP tables ---
  const processLines: ProcessMaterialLineResult[] = activityData.processMaterialEntries.map((entry) => {
    const def = PROCESS_MATERIAL_LIBRARY[entry.materialType];
    if (!def) {
      throw AppError.badRequest(
        `Unknown process material type: ${entry.materialType}`,
        "UNKNOWN_PROCESS_MATERIAL",
      );
    }
    const efUsed = entry.emissionFactorOverride ?? def.efCo2PerTonne;
    return {
      materialType: entry.materialType,
      label: def.label,
      quantityTonnes: entry.quantityTonnes,
      emissionFactorUsed: efUsed,
      isOverride: entry.emissionFactorOverride != null,
      co2Tonnes: entry.quantityTonnes * efUsed,
    };
  });

  const directProcessCo2e = processLines.reduce((sum, l) => sum + l.co2Tonnes, 0);

  // --- Precursor materials (embedded emissions, already CO2e — identical under both tables) ---
  const precursorLines: PrecursorLineResult[] = activityData.precursorEntries.map((entry) => {
    const def = PRECURSOR_LIBRARY[entry.materialType];
    if (!def) {
      throw AppError.badRequest(
        `Unknown precursor material type: ${entry.materialType}`,
        "UNKNOWN_PRECURSOR_MATERIAL",
      );
    }
    const efUsed = entry.embeddedEmissionFactorOverride ?? def.defaultEmbeddedFactor;
    return {
      materialType: entry.materialType,
      label: def.label,
      quantityTonnes: entry.quantityTonnes,
      emissionFactorUsed: efUsed,
      isOverride: entry.embeddedEmissionFactorOverride != null,
      co2eTonnes: entry.quantityTonnes * efUsed,
    };
  });

  const directPrecursorCo2e = precursorLines.reduce((sum, l) => sum + l.co2eTonnes, 0);

  // --- Indirect emissions (Scope 2): electricity + imported steam ---
  const gridEmissionFactorUsed = activityData.gridEmissionFactorOverride ?? DEFAULT_GRID_EMISSION_FACTOR;
  const indirectElectricityCo2e = activityData.gridElectricityMwh * gridEmissionFactorUsed;

  const steamEmissionFactorUsed = activityData.steamEmissionFactorOverride ?? DEFAULT_STEAM_EMISSION_FACTOR;
  const indirectSteamCo2e = activityData.steamImportedGj * steamEmissionFactorUsed;

  // --- Totals ---
  const totalDirectCo2eAr5 = directCombustionCo2eAr5 + directProcessCo2e;
  const totalDirectCo2eAr4 = directCombustionCo2eAr4 + directProcessCo2e;

  const totalEmissionsCbamAr5 =
    totalDirectCo2eAr5 + indirectElectricityCo2e + indirectSteamCo2e + directPrecursorCo2e;
  const totalEmissionsCctsAr4 =
    totalDirectCo2eAr4 + indirectElectricityCo2e + indirectSteamCo2e + directPrecursorCo2e;

  const specificEmbeddedEmissionsCbam = totalEmissionsCbamAr5 / activityData.productionQuantityT;
  const ghgIntensityCcts = totalEmissionsCctsAr4 / activityData.productionQuantityT;

  const breakdown = {
    fuels: fuelLines.map((l) => ({ ...l, co2Tonnes: round(l.co2Tonnes), co2eAr5: round(l.co2eAr5), co2eAr4: round(l.co2eAr4) })),
    processMaterials: processLines.map((l) => ({ ...l, co2Tonnes: round(l.co2Tonnes) })),
    precursors: precursorLines.map((l) => ({ ...l, co2eTonnes: round(l.co2eTonnes) })),
    electricity: {
      gridMwh: activityData.gridElectricityMwh,
      renewableMwh: activityData.renewableElectricityMwh,
      emissionFactorUsed: gridEmissionFactorUsed,
      isOverride: activityData.gridEmissionFactorOverride != null,
      co2eTonnes: round(indirectElectricityCo2e),
    },
    steam: {
      gj: activityData.steamImportedGj,
      emissionFactorUsed: steamEmissionFactorUsed,
      isOverride: activityData.steamEmissionFactorOverride != null,
      co2eTonnes: round(indirectSteamCo2e),
    },
    gwpTables: { ar4: GWP_AR4, ar5: GWP_AR5 },
  };

  const result = await prisma.emissionCalculationResult.upsert({
    where: { activityDataId },
    create: {
      activityDataId,
      directCombustionCo2eAr5: round(directCombustionCo2eAr5),
      directCombustionCo2eAr4: round(directCombustionCo2eAr4),
      directProcessCo2e: round(directProcessCo2e),
      directPrecursorCo2e: round(directPrecursorCo2e),
      indirectElectricityCo2e: round(indirectElectricityCo2e),
      indirectSteamCo2e: round(indirectSteamCo2e),
      totalDirectCo2eAr5: round(totalDirectCo2eAr5),
      totalDirectCo2eAr4: round(totalDirectCo2eAr4),
      totalEmissionsCbamAr5: round(totalEmissionsCbamAr5),
      totalEmissionsCctsAr4: round(totalEmissionsCctsAr4),
      specificEmbeddedEmissionsCbam: round(specificEmbeddedEmissionsCbam),
      ghgIntensityCcts: round(ghgIntensityCcts),
      gridEmissionFactorUsed,
      breakdown: breakdown as unknown as Prisma.InputJsonValue,
    },
    update: {
      directCombustionCo2eAr5: round(directCombustionCo2eAr5),
      directCombustionCo2eAr4: round(directCombustionCo2eAr4),
      directProcessCo2e: round(directProcessCo2e),
      directPrecursorCo2e: round(directPrecursorCo2e),
      indirectElectricityCo2e: round(indirectElectricityCo2e),
      indirectSteamCo2e: round(indirectSteamCo2e),
      totalDirectCo2eAr5: round(totalDirectCo2eAr5),
      totalDirectCo2eAr4: round(totalDirectCo2eAr4),
      totalEmissionsCbamAr5: round(totalEmissionsCbamAr5),
      totalEmissionsCctsAr4: round(totalEmissionsCctsAr4),
      specificEmbeddedEmissionsCbam: round(specificEmbeddedEmissionsCbam),
      ghgIntensityCcts: round(ghgIntensityCcts),
      gridEmissionFactorUsed,
      breakdown: breakdown as unknown as Prisma.InputJsonValue,
      calculatedAt: new Date(),
    },
  });

  return result;
};

export const getCalculationResult = async (activityDataId: string) =>
  prisma.emissionCalculationResult.findUnique({ where: { activityDataId } });
