import { z } from "zod";

const positiveNumericString = z
  .string()
  .trim()
  .min(1, "Required")
  .refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0, "Enter a number greater than 0");

export const spendBasedSchema = z.object({
  spendInr: positiveNumericString,
});

export const cat1ActivitySchema = z.object({
  materialType: z.enum(["STEEL", "ALUMINIUM", "CEMENT", "PLASTICS", "PAPER_BOARD", "GENERIC_OTHER"]),
  quantityKg: positiveNumericString,
});

export const cat4ActivitySchema = z.object({
  freightMode: z.enum(["ROAD_HGV", "RAIL", "SEA", "AIR"]),
  tonnesShipped: positiveNumericString,
  distanceKm: positiveNumericString,
});

export const cat6ActivitySchema = z.object({
  travelMode: z.enum(["CAR_AVERAGE", "RAIL_NATIONAL", "FLIGHT_SHORT_HAUL", "FLIGHT_LONG_HAUL_ECONOMY", "FLIGHT_LONG_HAUL_BUSINESS"]),
  distanceKm: positiveNumericString,
  numberOfTrips: positiveNumericString,
});

export const cat7ActivitySchema = z.object({
  commuteMode: z.enum(["CAR_AVERAGE", "BUS", "RAIL_NATIONAL", "MOTORBIKE_TWO_WHEELER", "WALK_CYCLE"]),
  employeeCount: positiveNumericString,
  oneWayDistanceKm: positiveNumericString,
  commutingDaysPerYear: positiveNumericString,
});

export const cat11ActivitySchema = z
  .object({
    productType: z.enum(["ELECTRICITY_CONSUMING", "FUEL_CONSUMING"]),
    unitsSold: positiveNumericString,
    lifetimeEnergyConsumptionKwh: z.string().trim().optional().or(z.literal("")),
    lifetimeFuelConsumptionLitres: z.string().trim().optional().or(z.literal("")),
    fuelType: z.enum(["DIESEL", "PETROL", "LPG"]).optional().or(z.literal("")),
  })
  .refine((d) => d.productType !== "ELECTRICITY_CONSUMING" || Number(d.lifetimeEnergyConsumptionKwh) > 0, {
    message: "Enter the lifetime energy consumption (kWh)",
    path: ["lifetimeEnergyConsumptionKwh"],
  })
  .refine((d) => d.productType !== "FUEL_CONSUMING" || Number(d.lifetimeFuelConsumptionLitres) > 0, {
    message: "Enter the lifetime fuel consumption (litres)",
    path: ["lifetimeFuelConsumptionLitres"],
  })
  .refine((d) => d.productType !== "FUEL_CONSUMING" || !!d.fuelType, {
    message: "Select a fuel type",
    path: ["fuelType"],
  });

export type SpendBasedFormValues = z.infer<typeof spendBasedSchema>;
export type Cat1ActivityFormValues = z.infer<typeof cat1ActivitySchema>;
export type Cat4ActivityFormValues = z.infer<typeof cat4ActivitySchema>;
export type Cat6ActivityFormValues = z.infer<typeof cat6ActivitySchema>;
export type Cat7ActivityFormValues = z.infer<typeof cat7ActivitySchema>;
export type Cat11ActivityFormValues = z.infer<typeof cat11ActivitySchema>;
