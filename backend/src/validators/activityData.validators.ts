import { z } from "zod";
import { HydrogenRoute } from "@prisma/client";
import { FUEL_LIBRARY, PRECURSOR_LIBRARY, PROCESS_MATERIAL_LIBRARY } from "../data/emissionFactors";

const fuelEntrySchema = z.object({
  fuelType: z.string().refine((v) => v in FUEL_LIBRARY, "Select a valid fuel type"),
  quantity: z.coerce.number().nonnegative(),
  unit: z.string().min(1),
  emissionFactorOverrideCo2: z.coerce.number().nonnegative().optional(),
});

const processMaterialEntrySchema = z.object({
  materialType: z.string().refine((v) => v in PROCESS_MATERIAL_LIBRARY, "Select a valid process material"),
  quantityTonnes: z.coerce.number().nonnegative(),
  emissionFactorOverride: z.coerce.number().nonnegative().optional(),
});

const precursorEntrySchema = z.object({
  materialType: z.string().refine((v) => v in PRECURSOR_LIBRARY, "Select a valid precursor material"),
  quantityTonnes: z.coerce.number().nonnegative(),
  embeddedEmissionFactorOverride: z.coerce.number().nonnegative().optional(),
  sourceLabel: z.string().trim().max(150).optional().or(z.literal("")),
});

export const activityDataSchema = z
  .object({
    periodStart: z.coerce.date(),
    periodEnd: z.coerce.date(),
    productCategory: z.string().trim().min(2, "Enter a product category").max(150),
    // Normally required to be > 0 — but the electricity sector's SEE is
    // denominated in MWh exported to the EU, not tonnes, so 0 is allowed
    // there as long as electricityExportedEuMwh is positive (checked below).
    productionQuantityT: z.coerce.number().nonnegative(),

    gridElectricityMwh: z.coerce.number().nonnegative().default(0),
    renewableElectricityMwh: z.coerce.number().nonnegative().default(0),
    gridEmissionFactorOverride: z.coerce.number().nonnegative().optional(),

    steamImportedGj: z.coerce.number().nonnegative().default(0),
    steamEmissionFactorOverride: z.coerce.number().nonnegative().optional(),

    carbonPricePaidEurPerTonne: z.coerce.number().nonnegative().optional(),
    cctsTargetIntensity: z.coerce.number().nonnegative().optional(),

    // --- Cement ---
    limestoneInputTonnes: z.coerce.number().nonnegative().optional(),
    clinkerProducedTonnes: z.coerce.number().nonnegative().optional(),
    clinkerConversionFraction: z.coerce.number().min(0).max(1).optional(),

    // --- Aluminium (PFC) ---
    cf4EmissionsTonnes: z.coerce.number().nonnegative().optional(),
    c2f6EmissionsTonnes: z.coerce.number().nonnegative().optional(),
    anodeEffectMinutes: z.coerce.number().nonnegative().optional(),

    // --- Fertilizer ---
    n2oProcessEmissionsTonnes: z.coerce.number().nonnegative().optional(),
    n2oAbatementFactorPct: z.coerce.number().min(0).max(100).optional(),
    naturalGasFeedstockNm3: z.coerce.number().nonnegative().optional(),

    // --- Hydrogen ---
    hydrogenRoute: z.nativeEnum(HydrogenRoute).optional(),
    ccsCaptureRatePct: z.coerce.number().min(0).max(100).optional(),
    hydrogenPurityPct: z.coerce.number().min(0).max(100).optional(),
    byproductOxygenTonnes: z.coerce.number().nonnegative().optional(),

    // --- Electricity ---
    electricityGeneratedMwh: z.coerce.number().nonnegative().optional(),
    electricityExportedEuMwh: z.coerce.number().nonnegative().optional(),
    ownUseElectricityMwh: z.coerce.number().nonnegative().optional(),
    lineLossMwh: z.coerce.number().nonnegative().optional(),

    notes: z.string().trim().max(1000).optional().or(z.literal("")),

    fuelEntries: z.array(fuelEntrySchema).default([]),
    processMaterialEntries: z.array(processMaterialEntrySchema).default([]),
    precursorEntries: z.array(precursorEntrySchema).default([]),
  })
  .refine((data) => data.periodEnd >= data.periodStart, {
    message: "Period end must be on or after period start",
    path: ["periodEnd"],
  })
  .refine((data) => data.productionQuantityT > 0 || (data.electricityExportedEuMwh ?? 0) > 0, {
    message: "Enter production quantity greater than zero",
    path: ["productionQuantityT"],
  });

export type ActivityDataInput = z.infer<typeof activityDataSchema>;
