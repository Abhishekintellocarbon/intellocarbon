import { z } from "zod";
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

export const steelActivityDataSchema = z
  .object({
    periodStart: z.coerce.date(),
    periodEnd: z.coerce.date(),
    productCategory: z.string().trim().min(2, "Enter a product category").max(150),
    productionQuantityT: z.coerce.number().positive("Production quantity must be greater than zero"),

    gridElectricityMwh: z.coerce.number().nonnegative().default(0),
    renewableElectricityMwh: z.coerce.number().nonnegative().default(0),
    gridEmissionFactorOverride: z.coerce.number().nonnegative().optional(),

    steamImportedGj: z.coerce.number().nonnegative().default(0),
    steamEmissionFactorOverride: z.coerce.number().nonnegative().optional(),

    notes: z.string().trim().max(1000).optional().or(z.literal("")),

    fuelEntries: z.array(fuelEntrySchema).default([]),
    processMaterialEntries: z.array(processMaterialEntrySchema).default([]),
    precursorEntries: z.array(precursorEntrySchema).default([]),
  })
  .refine((data) => data.periodEnd >= data.periodStart, {
    message: "Period end must be on or after period start",
    path: ["periodEnd"],
  });

export type SteelActivityDataInput = z.infer<typeof steelActivityDataSchema>;
