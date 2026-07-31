import type { Scope3Category, Scope3CalculationMethod } from "@prisma/client";
import { AppError } from "../utils/AppError";
import {
  USD_TO_INR_RATE,
  EPA_SPEND_FACTOR_SOURCE,
  SPEND_BASED_FACTORS_KG_CO2E_PER_USD,
  CAT1_MATERIAL_FACTORS_KG_CO2E_PER_KG,
  CAT4_FREIGHT_FACTORS_KG_CO2E_PER_TONNE_KM,
  CAT6_TRAVEL_FACTORS_KG_CO2E_PER_PASSENGER_KM,
  CAT7_COMMUTE_FACTORS_KG_CO2E_PER_PASSENGER_KM,
  CAT11_GRID_FACTOR_KG_CO2E_PER_KWH,
  CAT11_FUEL_FACTORS_KG_CO2E_PER_LITRE,
  type Cat1MaterialType,
  type Cat4FreightMode,
  type Cat6TravelMode,
  type Cat7CommuteMode,
  type Cat11ProductType,
  type Cat11FuelType,
} from "../data/scope3EmissionFactors";

const round = (value: number, decimals = 4) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const kgToTonnes = (kg: number) => round(kg / 1000, 4);

export interface Scope3CalculationResult {
  calculatedEmissionsTco2e: number;
  emissionFactorSource: string;
}

// --- Per-category input contracts — the shape `inputData` must match for a
// given (category, calculationMethod) pair. Validated by
// validators/scope3.validators.ts before this service ever sees it.

export interface SpendBasedInput {
  spendInr: number;
}

export interface Cat1ActivityInput {
  materialType: Cat1MaterialType;
  quantityKg: number;
}

export interface Cat4ActivityInput {
  freightMode: Cat4FreightMode;
  tonnesShipped: number;
  distanceKm: number;
}

export interface Cat6ActivityInput {
  travelMode: Cat6TravelMode;
  distanceKm: number;
  numberOfTrips: number;
}

export interface Cat7ActivityInput {
  commuteMode: Cat7CommuteMode;
  employeeCount: number;
  oneWayDistanceKm: number;
  commutingDaysPerYear: number;
}

export interface Cat11ActivityInput {
  productType: Cat11ProductType;
  unitsSold: number;
  lifetimeEnergyConsumptionKwh?: number;
  lifetimeFuelConsumptionLitres?: number;
  fuelType?: Cat11FuelType;
}

const calcSpendBased = (category: Scope3Category, input: SpendBasedInput): Scope3CalculationResult => {
  const factorKey = category as keyof typeof SPEND_BASED_FACTORS_KG_CO2E_PER_USD;
  const factor = SPEND_BASED_FACTORS_KG_CO2E_PER_USD[factorKey];
  const spendUsd = input.spendInr / USD_TO_INR_RATE;
  return {
    calculatedEmissionsTco2e: kgToTonnes(spendUsd * factor),
    emissionFactorSource: EPA_SPEND_FACTOR_SOURCE,
  };
};

const calcCat1Activity = (input: Cat1ActivityInput): Scope3CalculationResult => {
  const { factor, source } = CAT1_MATERIAL_FACTORS_KG_CO2E_PER_KG[input.materialType];
  return { calculatedEmissionsTco2e: kgToTonnes(input.quantityKg * factor), emissionFactorSource: source };
};

const calcCat4Activity = (input: Cat4ActivityInput): Scope3CalculationResult => {
  const { factor, source } = CAT4_FREIGHT_FACTORS_KG_CO2E_PER_TONNE_KM[input.freightMode];
  return {
    calculatedEmissionsTco2e: kgToTonnes(input.tonnesShipped * input.distanceKm * factor),
    emissionFactorSource: source,
  };
};

const calcCat6Activity = (input: Cat6ActivityInput): Scope3CalculationResult => {
  const { factor, source } = CAT6_TRAVEL_FACTORS_KG_CO2E_PER_PASSENGER_KM[input.travelMode];
  return {
    calculatedEmissionsTco2e: kgToTonnes(input.distanceKm * input.numberOfTrips * factor),
    emissionFactorSource: source,
  };
};

const calcCat7Activity = (input: Cat7ActivityInput): Scope3CalculationResult => {
  const { factor, source } = CAT7_COMMUTE_FACTORS_KG_CO2E_PER_PASSENGER_KM[input.commuteMode];
  const roundTripKm = input.oneWayDistanceKm * 2;
  const totalPassengerKm = input.employeeCount * roundTripKm * input.commutingDaysPerYear;
  return { calculatedEmissionsTco2e: kgToTonnes(totalPassengerKm * factor), emissionFactorSource: source };
};

const calcCat11Activity = (input: Cat11ActivityInput): Scope3CalculationResult => {
  if (input.productType === "ELECTRICITY_CONSUMING") {
    if (input.lifetimeEnergyConsumptionKwh == null) {
      throw AppError.badRequest(
        "lifetimeEnergyConsumptionKwh is required for an electricity-consuming sold product",
        "VALIDATION_ERROR",
      );
    }
    const { factor, source } = CAT11_GRID_FACTOR_KG_CO2E_PER_KWH;
    return {
      calculatedEmissionsTco2e: kgToTonnes(input.unitsSold * input.lifetimeEnergyConsumptionKwh * factor),
      emissionFactorSource: source,
    };
  }

  if (input.lifetimeFuelConsumptionLitres == null || input.fuelType == null) {
    throw AppError.badRequest(
      "lifetimeFuelConsumptionLitres and fuelType are required for a fuel-consuming sold product",
      "VALIDATION_ERROR",
    );
  }
  const { factor, source } = CAT11_FUEL_FACTORS_KG_CO2E_PER_LITRE[input.fuelType];
  return {
    calculatedEmissionsTco2e: kgToTonnes(input.unitsSold * input.lifetimeFuelConsumptionLitres * factor),
    emissionFactorSource: source,
  };
};

/**
 * Single entry point the CRUD service calls after validation — dispatches on
 * (category, calculationMethod) to the right factor lookup and arithmetic.
 * `inputData` is trusted to already match the contract for that pair (see
 * validators/scope3.validators.ts); this function does not re-validate
 * shape beyond what TypeScript's structural typing catches at the call site.
 */
export const calculateScope3Emissions = (
  category: Scope3Category,
  calculationMethod: Scope3CalculationMethod,
  inputData: Record<string, unknown>,
): Scope3CalculationResult => {
  if (calculationMethod === "SPEND_BASED") {
    return calcSpendBased(category, inputData as unknown as SpendBasedInput);
  }

  switch (category) {
    case "CAT1_PURCHASED_GOODS_SERVICES":
      return calcCat1Activity(inputData as unknown as Cat1ActivityInput);
    case "CAT4_UPSTREAM_TRANSPORT_DISTRIBUTION":
      return calcCat4Activity(inputData as unknown as Cat4ActivityInput);
    case "CAT6_BUSINESS_TRAVEL":
      return calcCat6Activity(inputData as unknown as Cat6ActivityInput);
    case "CAT7_EMPLOYEE_COMMUTING":
      return calcCat7Activity(inputData as unknown as Cat7ActivityInput);
    case "CAT11_USE_OF_SOLD_PRODUCTS":
      return calcCat11Activity(inputData as unknown as Cat11ActivityInput);
    default: {
      const exhaustive: never = category;
      throw AppError.badRequest(`Unsupported Scope 3 category: ${exhaustive}`, "VALIDATION_ERROR");
    }
  }
};
