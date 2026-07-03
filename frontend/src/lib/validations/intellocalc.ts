import { z } from "zod";

export const leadContactSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(150),
  email: z.string().trim().email("Enter a valid email address"),
  company: z.string().trim().min(2, "Enter your company name").max(200),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
});

export type LeadContactValues = z.infer<typeof leadContactSchema>;

const requiredNumericString = (message: string) =>
  z
    .string()
    .trim()
    .min(1, message)
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0, message);

const optionalNumericString = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))
  .refine((v) => !v || !Number.isNaN(Number(v)), "Enter a valid number");

export const borderFormSchema = z
  .object({
    sector: z.enum(["IRON_STEEL", "CEMENT", "ALUMINIUM", "FERTILIZERS", "HYDROGEN", "ELECTRICITY"], {
      error: "Select a sector",
    }),
    productionRoute: z.enum(["EAF", "BF_BOF"]).optional().or(z.literal("")),
    annualProductionTonnes: requiredNumericString("Enter annual production"),
    euExportQuantityTonnes: requiredNumericString("Enter EU export quantity"),
    carbonPricePaidInrPerTonne: optionalNumericString,
  })
  .refine((v) => v.sector !== "IRON_STEEL" || Boolean(v.productionRoute), {
    message: "Select a production route",
    path: ["productionRoute"],
  });

export type BorderFormValues = z.infer<typeof borderFormSchema>;

export const indiaFormSchema = z.object({
  sector: z.enum(
    [
      "ALUMINIUM",
      "CEMENT",
      "IRON_STEEL",
      "CHLOR_ALKALI",
      "FERTILIZER",
      "PAPER_PULP",
      "PETROCHEMICAL",
      "PETROLEUM_REFINERY",
      "TEXTILE",
    ],
    { error: "Select a sector" },
  ),
  annualProductionTonnes: requiredNumericString("Enter annual production output"),
  totalFuelConsumptionGj: requiredNumericString("Enter fuel consumption"),
  totalElectricityMwh: requiredNumericString("Enter electricity consumed"),
  fuelTypeMix: z.enum(["COAL", "NATURAL_GAS", "MIXED", "OTHER"], { error: "Select a fuel type mix" }),
  baselineIntensity: optionalNumericString,
});

export type IndiaFormValues = z.infer<typeof indiaFormSchema>;
