import type { CalculableScope3Category, Scope3CalculationMethod } from "@/lib/types";
import {
  spendBasedSchema,
  cat1ActivitySchema,
  cat4ActivitySchema,
  cat6ActivitySchema,
  cat7ActivitySchema,
  cat11ActivitySchema,
} from "@/lib/validations/scope3";
import type { ZodTypeAny } from "zod";

export const METHOD_LABELS: Record<Scope3CalculationMethod, string> = {
  SPEND_BASED: "Spend-based (₹ spend × emission factor)",
  ACTIVITY_BASED: "Activity-based (physical quantity × emission factor)",
};

export const MATERIAL_LABELS: Record<string, string> = {
  STEEL: "Steel",
  ALUMINIUM: "Aluminium",
  CEMENT: "Cement",
  PLASTICS: "Plastics",
  PAPER_BOARD: "Paper & board",
  GENERIC_OTHER: "Generic / other",
};

export const FREIGHT_LABELS: Record<string, string> = {
  ROAD_HGV: "Road (HGV truck)",
  RAIL: "Rail",
  SEA: "Sea",
  AIR: "Air",
};

export const TRAVEL_LABELS: Record<string, string> = {
  CAR_AVERAGE: "Car (average)",
  RAIL_NATIONAL: "Rail (national)",
  FLIGHT_SHORT_HAUL: "Flight — short-haul",
  FLIGHT_LONG_HAUL_ECONOMY: "Flight — long-haul, economy",
  FLIGHT_LONG_HAUL_BUSINESS: "Flight — long-haul, business",
};

export const COMMUTE_LABELS: Record<string, string> = {
  CAR_AVERAGE: "Car (average)",
  BUS: "Bus",
  RAIL_NATIONAL: "Rail (national)",
  MOTORBIKE_TWO_WHEELER: "Motorbike / two-wheeler",
  WALK_CYCLE: "Walk / cycle",
};

export const PRODUCT_TYPE_LABELS: Record<string, string> = {
  ELECTRICITY_CONSUMING: "Electricity-consuming product",
  FUEL_CONSUMING: "Fuel-consuming product",
};

export const FUEL_LABELS: Record<string, string> = {
  DIESEL: "Diesel",
  PETROL: "Petrol",
  LPG: "LPG",
};

export type FieldsState = Record<string, string>;

export const emptyFieldsFor = (method: Scope3CalculationMethod, category: CalculableScope3Category): FieldsState => {
  if (method === "SPEND_BASED") return { spendInr: "" };
  switch (category) {
    case "CAT1_PURCHASED_GOODS_SERVICES":
      return { materialType: "STEEL", quantityKg: "" };
    case "CAT4_UPSTREAM_TRANSPORT_DISTRIBUTION":
      return { freightMode: "ROAD_HGV", tonnesShipped: "", distanceKm: "" };
    case "CAT6_BUSINESS_TRAVEL":
      return { travelMode: "CAR_AVERAGE", distanceKm: "", numberOfTrips: "" };
    case "CAT7_EMPLOYEE_COMMUTING":
      return { commuteMode: "CAR_AVERAGE", employeeCount: "", oneWayDistanceKm: "", commutingDaysPerYear: "" };
    case "CAT11_USE_OF_SOLD_PRODUCTS":
      return {
        productType: "ELECTRICITY_CONSUMING",
        unitsSold: "",
        lifetimeEnergyConsumptionKwh: "",
        lifetimeFuelConsumptionLitres: "",
        fuelType: "",
      };
  }
};

export const schemaFor = (method: Scope3CalculationMethod, category: CalculableScope3Category): ZodTypeAny => {
  if (method === "SPEND_BASED") return spendBasedSchema;
  switch (category) {
    case "CAT1_PURCHASED_GOODS_SERVICES":
      return cat1ActivitySchema;
    case "CAT4_UPSTREAM_TRANSPORT_DISTRIBUTION":
      return cat4ActivitySchema;
    case "CAT6_BUSINESS_TRAVEL":
      return cat6ActivitySchema;
    case "CAT7_EMPLOYEE_COMMUTING":
      return cat7ActivitySchema;
    case "CAT11_USE_OF_SOLD_PRODUCTS":
      return cat11ActivitySchema;
  }
};

const toStr = (v: unknown): string => (v == null ? "" : String(v));

/** Converts a saved entry's typed inputData (numbers) back into the form's string field state. */
export const fieldsFromInputData = (
  method: Scope3CalculationMethod,
  category: CalculableScope3Category,
  inputData: Record<string, unknown>,
): FieldsState => {
  const empty = emptyFieldsFor(method, category);
  const result: FieldsState = {};
  for (const key of Object.keys(empty)) {
    result[key] = toStr(inputData[key]);
  }
  return result;
};
