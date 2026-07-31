import { z } from "zod";
import { AppError } from "../utils/AppError";

// "FY2025-26" — same convention as BRSR Core / ISSB.
const reportingPeriodRegex = /^FY\d{4}-\d{2}$/;

const SCOPE3_CATEGORIES = [
  "CAT1_PURCHASED_GOODS_SERVICES",
  "CAT4_UPSTREAM_TRANSPORT_DISTRIBUTION",
  "CAT6_BUSINESS_TRAVEL",
  "CAT7_EMPLOYEE_COMMUTING",
  "CAT11_USE_OF_SOLD_PRODUCTS",
] as const;

const CALCULATION_METHODS = ["SPEND_BASED", "ACTIVITY_BASED"] as const;

// Unlike BRSR Core/ISSB's free-text disclosures, a Scope 3 entry only exists
// to produce a calculated number — there's no meaningful "partially filled"
// draft state, so one strict schema covers both draft and submit saves. The
// DRAFT/SUBMITTED distinction lives entirely in the `status` column (set by
// the service layer), not in how strictly the input is validated.
export const scope3EntryBaseSchema = z.object({
  reportingPeriod: z.string().regex(reportingPeriodRegex, 'Use the format "FY2025-26"'),
  category: z.enum(SCOPE3_CATEGORIES),
  calculationMethod: z.enum(CALCULATION_METHODS),
  inputData: z.record(z.unknown()),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type Scope3EntryBaseInput = z.infer<typeof scope3EntryBaseSchema>;

const spendBasedInputSchema = z.object({
  spendInr: z.coerce.number().positive("Enter a spend amount greater than 0"),
});

const cat1ActivityInputSchema = z.object({
  materialType: z.enum(["STEEL", "ALUMINIUM", "CEMENT", "PLASTICS", "PAPER_BOARD", "GENERIC_OTHER"]),
  quantityKg: z.coerce.number().positive("Enter a quantity greater than 0"),
});

const cat4ActivityInputSchema = z.object({
  freightMode: z.enum(["ROAD_HGV", "RAIL", "SEA", "AIR"]),
  tonnesShipped: z.coerce.number().positive("Enter tonnes shipped greater than 0"),
  distanceKm: z.coerce.number().positive("Enter a distance greater than 0"),
});

const cat6ActivityInputSchema = z.object({
  travelMode: z.enum(["CAR_AVERAGE", "RAIL_NATIONAL", "FLIGHT_SHORT_HAUL", "FLIGHT_LONG_HAUL_ECONOMY", "FLIGHT_LONG_HAUL_BUSINESS"]),
  distanceKm: z.coerce.number().positive("Enter a distance greater than 0"),
  numberOfTrips: z.coerce.number().int().positive("Enter at least 1 trip"),
});

const cat7ActivityInputSchema = z.object({
  commuteMode: z.enum(["CAR_AVERAGE", "BUS", "RAIL_NATIONAL", "MOTORBIKE_TWO_WHEELER", "WALK_CYCLE"]),
  employeeCount: z.coerce.number().int().positive("Enter at least 1 employee"),
  oneWayDistanceKm: z.coerce.number().positive("Enter a one-way distance greater than 0"),
  commutingDaysPerYear: z.coerce.number().int().positive().max(366, "That's more days than a year has"),
});

const cat11ActivityInputSchema = z
  .object({
    productType: z.enum(["ELECTRICITY_CONSUMING", "FUEL_CONSUMING"]),
    unitsSold: z.coerce.number().positive("Enter units sold greater than 0"),
    lifetimeEnergyConsumptionKwh: z.coerce.number().positive().optional(),
    lifetimeFuelConsumptionLitres: z.coerce.number().positive().optional(),
    fuelType: z.enum(["DIESEL", "PETROL", "LPG"]).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.productType === "ELECTRICITY_CONSUMING" && data.lifetimeEnergyConsumptionKwh == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter the lifetime energy consumption (kWh) for an electricity-consuming product",
        path: ["lifetimeEnergyConsumptionKwh"],
      });
    }
    if (data.productType === "FUEL_CONSUMING" && (data.lifetimeFuelConsumptionLitres == null || data.fuelType == null)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter the fuel type and lifetime fuel consumption (litres) for a fuel-consuming product",
        path: ["lifetimeFuelConsumptionLitres"],
      });
    }
  });

const ACTIVITY_SCHEMA_BY_CATEGORY: Record<(typeof SCOPE3_CATEGORIES)[number], z.ZodTypeAny> = {
  CAT1_PURCHASED_GOODS_SERVICES: cat1ActivityInputSchema,
  CAT4_UPSTREAM_TRANSPORT_DISTRIBUTION: cat4ActivityInputSchema,
  CAT6_BUSINESS_TRAVEL: cat6ActivityInputSchema,
  CAT7_EMPLOYEE_COMMUTING: cat7ActivityInputSchema,
  CAT11_USE_OF_SOLD_PRODUCTS: cat11ActivityInputSchema,
};

/**
 * Validates the whole request body, then re-validates `inputData` against
 * the schema matching (category, calculationMethod) — the two fields that
 * determine its shape. Throws AppError on the first failure (matching every
 * other controller's validation error convention); returns the fully
 * coerced/typed body on success, ready for scope3Calculation.service.ts.
 */
export const parseScope3Entry = (body: unknown): Scope3EntryBaseInput => {
  const base = scope3EntryBaseSchema.safeParse(body);
  if (!base.success) {
    throw AppError.badRequest(base.error.issues[0]?.message ?? "Invalid request body", "VALIDATION_ERROR");
  }

  const inputSchema = base.data.calculationMethod === "SPEND_BASED" ? spendBasedInputSchema : ACTIVITY_SCHEMA_BY_CATEGORY[base.data.category];
  const parsedInput = inputSchema.safeParse(base.data.inputData);
  if (!parsedInput.success) {
    throw AppError.badRequest(parsedInput.error.issues[0]?.message ?? "Invalid Scope 3 input data", "VALIDATION_ERROR");
  }

  return { ...base.data, inputData: parsedInput.data };
};
