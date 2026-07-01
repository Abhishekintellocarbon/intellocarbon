import { z } from "zod";

const numericString = (message = "Enter a valid number") =>
  z
    .string()
    .trim()
    .min(1, message)
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0, message);

const optionalNumericString = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))
  .refine((v) => !v || !Number.isNaN(Number(v)), "Enter a valid number");

export const fuelRowSchema = z.object({
  fuelType: z.string().min(1, "Select a fuel"),
  quantity: numericString("Enter a quantity"),
});

export const processMaterialRowSchema = z.object({
  materialType: z.string().min(1, "Select a material"),
  quantityTonnes: numericString("Enter a quantity"),
});

export const precursorRowSchema = z.object({
  materialType: z.string().min(1, "Select a material"),
  quantityTonnes: numericString("Enter a quantity"),
  sourceLabel: z.string().trim().max(150).optional().or(z.literal("")),
});

export const activityDataSchema = z
  .object({
    periodStart: z.string().min(1, "Select a start date"),
    periodEnd: z.string().min(1, "Select an end date"),
    productCategory: z.string().trim().min(2, "Enter a product category").max(150),
    productionQuantityT: numericString("Enter production quantity"),

    gridElectricityMwh: optionalNumericString,
    renewableElectricityMwh: optionalNumericString,
    gridEmissionFactorOverride: optionalNumericString,

    steamImportedGj: optionalNumericString,
    steamEmissionFactorOverride: optionalNumericString,

    notes: z.string().trim().max(1000).optional().or(z.literal("")),

    fuelEntries: z.array(fuelRowSchema),
    processMaterialEntries: z.array(processMaterialRowSchema),
    precursorEntries: z.array(precursorRowSchema),
  })
  .refine((data) => data.periodEnd >= data.periodStart, {
    message: "Period end must be on or after period start",
    path: ["periodEnd"],
  });

export type ActivityDataFormValues = z.infer<typeof activityDataSchema>;
