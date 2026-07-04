import type { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";
import {
  CEMENT_CALCINATION_EMISSION_FACTOR,
  DEFAULT_GRID_EMISSION_FACTOR,
  DEFAULT_STEAM_EMISSION_FACTOR,
  FUEL_LIBRARY,
  NATURAL_GAS_FEEDSTOCK_EMISSION_FACTOR,
  PRECURSOR_LIBRARY,
  PROCESS_MATERIAL_LIBRARY,
} from "../data/emissionFactors";
import { GWP_AR2_BUR3, GWP_AR5 } from "../data/gwpTables";

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
  const activityData = await prisma.activityData.findUnique({
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

  // Belt-and-braces: the only caller of this function (submitActivityData)
  // always sets status to SUBMITTED in the same request before invoking it,
  // which is also what guarantees productionQuantityT/periodStart/periodEnd
  // are non-null (submitActivityData validates the full strict schema
  // first). This guard exists so a future caller can never accidentally run
  // the calculation engine — and therefore reports and CCTS/CBAM numbers —
  // against an incomplete draft.
  if (activityData.status !== "SUBMITTED") {
    throw AppError.badRequest(
      "Cannot calculate emissions for a draft entry — submit it first",
      "ACTIVITY_DATA_NOT_SUBMITTED",
    );
  }

  // Electricity's CBAM SEE is per MWh exported to the EU, not per tonne of
  // product — every other sector divides by production quantity.
  const isElectricitySector = activityData.sector === "ELECTRICITY";
  const denominator = isElectricitySector
    ? activityData.electricityExportedEuMwh ?? 0
    : activityData.productionQuantityT ?? 0;

  if (denominator <= 0) {
    throw AppError.badRequest(
      isElectricitySector
        ? "Electricity exported to the EU must be greater than zero to calculate emissions"
        : "Production quantity must be greater than zero to calculate emissions",
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
      co2eAr4: co2Tonnes + (ch4Kg / 1000) * GWP_AR2_BUR3.ch4 + (n2oKg / 1000) * GWP_AR2_BUR3.n2o,
    };
  });

  const directCombustionCo2eAr5 = fuelLines.reduce((sum, l) => sum + l.co2eAr5, 0);
  const directCombustionCo2eAr4 = fuelLines.reduce((sum, l) => sum + l.co2eAr4, 0);

  // --- Process emissions (calcination, anode oxidation, etc.), CO2-only, same under both GWP tables ---
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

  const genericProcessCo2e = processLines.reduce((sum, l) => sum + l.co2Tonnes, 0);

  // --- Cement calcination (dedicated — the dominant emission source for cement, shown separately in reports) ---
  const clinkerConversionFraction = activityData.clinkerConversionFraction ?? 1;
  const calcinationCo2e = (activityData.limestoneInputTonnes ?? 0) * CEMENT_CALCINATION_EMISSION_FACTOR * clinkerConversionFraction;

  // --- Fertilizer natural gas feedstock carbon (dedicated — tracked separately from combustion fuel use) ---
  const feedstockCo2e = (activityData.naturalGasFeedstockNm3 ?? 0) * NATURAL_GAS_FEEDSTOCK_EMISSION_FACTOR;

  const directProcessCo2e = genericProcessCo2e + calcinationCo2e + feedstockCo2e;

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

  // --- Aluminium PFC emissions (anode effects) — dual GWP, shown separately in the breakdown ---
  const cf4Tonnes = activityData.cf4EmissionsTonnes ?? 0;
  const c2f6Tonnes = activityData.c2f6EmissionsTonnes ?? 0;
  const directPfcCo2eAr5 = cf4Tonnes * (GWP_AR5.cf4 ?? 0) + c2f6Tonnes * (GWP_AR5.c2f6 ?? 0);
  const directPfcCo2eAr4 = cf4Tonnes * (GWP_AR2_BUR3.cf4 ?? 0) + c2f6Tonnes * (GWP_AR2_BUR3.c2f6 ?? 0);

  // --- Fertilizer N2O process emissions (nitric acid, Ostwald process) — dual GWP, net of abatement ---
  const n2oAbatementFraction = (activityData.n2oAbatementFactorPct ?? 0) / 100;
  const netN2oTonnes = (activityData.n2oProcessEmissionsTonnes ?? 0) * (1 - n2oAbatementFraction);
  const directN2oProcessCo2eAr5 = netN2oTonnes * GWP_AR5.n2o;
  const directN2oProcessCo2eAr4 = netN2oTonnes * GWP_AR2_BUR3.n2o;

  // --- Indirect emissions (Scope 2): electricity + imported steam ---
  const gridEmissionFactorUsed = activityData.gridEmissionFactorOverride ?? DEFAULT_GRID_EMISSION_FACTOR;
  const indirectElectricityCo2e = activityData.gridElectricityMwh * gridEmissionFactorUsed;

  const steamEmissionFactorUsed = activityData.steamEmissionFactorOverride ?? DEFAULT_STEAM_EMISSION_FACTOR;
  const indirectSteamCo2e = activityData.steamImportedGj * steamEmissionFactorUsed;

  // --- Totals ---
  const totalDirectCo2eAr5 = directCombustionCo2eAr5 + directProcessCo2e + directPfcCo2eAr5 + directN2oProcessCo2eAr5;
  const totalDirectCo2eAr4 = directCombustionCo2eAr4 + directProcessCo2e + directPfcCo2eAr4 + directN2oProcessCo2eAr4;

  const totalEmissionsCbamAr5 =
    totalDirectCo2eAr5 + indirectElectricityCo2e + indirectSteamCo2e + directPrecursorCo2e;
  const totalEmissionsCctsAr4 =
    totalDirectCo2eAr4 + indirectElectricityCo2e + indirectSteamCo2e + directPrecursorCo2e;

  const specificEmbeddedEmissionsCbam = totalEmissionsCbamAr5 / denominator;
  const ghgIntensityCcts = totalEmissionsCctsAr4 / denominator;

  const breakdown = {
    sector: activityData.sector,
    seeUnit: isElectricitySector ? "tCO2e/MWh" : "tCO2e/t",
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
    calcination:
      activityData.limestoneInputTonnes != null
        ? {
            limestoneInputTonnes: activityData.limestoneInputTonnes,
            emissionFactorUsed: CEMENT_CALCINATION_EMISSION_FACTOR,
            clinkerConversionFraction,
            co2Tonnes: round(calcinationCo2e),
          }
        : undefined,
    fertilizerFeedstock:
      activityData.naturalGasFeedstockNm3 != null
        ? {
            naturalGasFeedstockNm3: activityData.naturalGasFeedstockNm3,
            emissionFactorUsed: NATURAL_GAS_FEEDSTOCK_EMISSION_FACTOR,
            co2Tonnes: round(feedstockCo2e),
          }
        : undefined,
    pfc:
      cf4Tonnes > 0 || c2f6Tonnes > 0
        ? {
            cf4Tonnes,
            c2f6Tonnes,
            anodeEffectMinutes: activityData.anodeEffectMinutes,
            co2eAr5: round(directPfcCo2eAr5),
            co2eAr4: round(directPfcCo2eAr4),
            gwpAr5: { cf4: GWP_AR5.cf4, c2f6: GWP_AR5.c2f6 },
            gwpAr4: { cf4: GWP_AR2_BUR3.cf4, c2f6: GWP_AR2_BUR3.c2f6 },
          }
        : undefined,
    n2oProcess:
      activityData.n2oProcessEmissionsTonnes != null
        ? {
            n2oTonnes: activityData.n2oProcessEmissionsTonnes,
            abatementFactorPct: activityData.n2oAbatementFactorPct ?? 0,
            netN2oTonnes: round(netN2oTonnes),
            co2eAr5: round(directN2oProcessCo2eAr5),
            co2eAr4: round(directN2oProcessCo2eAr4),
          }
        : undefined,
    hydrogen:
      activityData.hydrogenRoute != null
        ? {
            route: activityData.hydrogenRoute,
            ccsCaptureRatePct: activityData.ccsCaptureRatePct,
            hydrogenPurityPct: activityData.hydrogenPurityPct,
            byproductOxygenTonnes: activityData.byproductOxygenTonnes,
          }
        : undefined,
    electricitySector: isElectricitySector
      ? {
          electricityGeneratedMwh: activityData.electricityGeneratedMwh,
          electricityExportedEuMwh: activityData.electricityExportedEuMwh,
          ownUseElectricityMwh: activityData.ownUseElectricityMwh,
          lineLossMwh: activityData.lineLossMwh,
        }
      : undefined,
    gwpTables: { ar4: GWP_AR2_BUR3, ar5: GWP_AR5 },
  };

  const data = {
    directCombustionCo2eAr5: round(directCombustionCo2eAr5),
    directCombustionCo2eAr4: round(directCombustionCo2eAr4),
    directProcessCo2e: round(directProcessCo2e),
    directPrecursorCo2e: round(directPrecursorCo2e),
    directPfcCo2eAr5: round(directPfcCo2eAr5),
    directPfcCo2eAr4: round(directPfcCo2eAr4),
    directN2oProcessCo2eAr5: round(directN2oProcessCo2eAr5),
    directN2oProcessCo2eAr4: round(directN2oProcessCo2eAr4),
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
  };

  const result = await prisma.emissionCalculationResult.upsert({
    where: { activityDataId },
    create: { activityDataId, ...data },
    update: { ...data, calculatedAt: new Date() },
  });

  return result;
};

export const getCalculationResult = async (activityDataId: string) =>
  prisma.emissionCalculationResult.findUnique({ where: { activityDataId } });
