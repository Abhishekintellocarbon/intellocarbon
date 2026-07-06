import { z } from "zod";

const contactFields = {
  name: z.string().trim().min(2, "Enter your name").max(150),
  email: z.string().trim().email("Enter a valid email address").max(200),
  company: z.string().trim().min(2, "Enter your company name").max(200),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
};

const borderInputsSchema = z
  .object({
    sector: z.enum(["IRON_STEEL", "CEMENT", "ALUMINIUM", "FERTILIZERS", "HYDROGEN", "ELECTRICITY"]),
    productionRoute: z.enum(["EAF", "BF_BOF"]).optional(),
    annualProductionTonnes: z.coerce.number().positive("Enter annual production"),
    euExportQuantityTonnes: z.coerce.number().positive("Enter EU export quantity"),
    carbonPricePaidInrPerTonne: z.coerce.number().nonnegative().optional(),
  })
  .refine((v) => v.sector !== "IRON_STEEL" || Boolean(v.productionRoute), {
    message: "Select a production route for Iron and Steel",
    path: ["productionRoute"],
  });

const indiaInputsSchema = z.object({
  sector: z.enum([
    "ALUMINIUM",
    "CEMENT",
    "IRON_STEEL",
    "CHLOR_ALKALI",
    "FERTILIZER",
    "PAPER_PULP",
    "PETROCHEMICAL",
    "PETROLEUM_REFINERY",
    "TEXTILE",
  ]),
  annualProductionTonnes: z.coerce.number().positive("Enter annual production output"),
  totalFuelConsumptionGj: z.coerce.number().nonnegative("Enter fuel consumption"),
  totalElectricityMwh: z.coerce.number().nonnegative("Enter electricity consumed"),
  fuelTypeMix: z.enum(["COAL", "NATURAL_GAS", "MIXED", "OTHER"]),
  baselineIntensity: z.coerce.number().nonnegative().optional(),
});

const complyInputsSchema = z.object({
  manufacturesGoods: z.boolean(),
  exportsToEu: z.enum(["YES", "NO", "PLANNING"]),
  euGoods: z
    .array(z.enum(["IRON_STEEL", "CEMENT", "ALUMINIUM", "FERTILIZERS", "HYDROGEN", "ELECTRICITY", "NONE"]))
    .default([]),
  euExportVolume: z.enum(["BELOW_50", "RANGE_50_500", "RANGE_500_5000", "ABOVE_5000"]).optional(),
  cctsStatus: z.enum(["NOTIFIED", "MAYBE", "NOT_COVERED", "NOT_SURE"]),
  eprProducts: z
    .array(z.enum(["BATTERIES", "PLASTIC", "EEE", "TYRES", "LUBRICATING_OILS", "NONE"]))
    .default([]),
});

export const leadCaptureSchema = z.discriminatedUnion("tool", [
  z.object({ tool: z.literal("BORDER"), ...contactFields, inputs: borderInputsSchema }),
  z.object({ tool: z.literal("INDIA"), ...contactFields, inputs: indiaInputsSchema }),
  z.object({ tool: z.literal("COMPLY"), ...contactFields, inputs: complyInputsSchema }),
]);

export type LeadCaptureInput = z.infer<typeof leadCaptureSchema>;
export type BorderInputs = z.infer<typeof borderInputsSchema>;
export type IndiaInputs = z.infer<typeof indiaInputsSchema>;
export type ComplyInputs = z.infer<typeof complyInputsSchema>;

// Lightweight "Notify me" waitlist capture for not-yet-built /esg frameworks —
// email only, tagged by framework via `tool`, kept separate from the
// discriminated union above since its shape doesn't fit the calculator
// tools' required name/company/inputs/results contract.
export const esgWaitlistSchema = z.object({
  tool: z.enum(["ESG_GRI", "ESG_ISSB", "ESG_CSRD", "ESG_CDP"]),
  email: z.string().trim().email("Enter a valid email address").max(200),
});

export type EsgWaitlistInput = z.infer<typeof esgWaitlistSchema>;

export const listLeadsQuerySchema = z.object({
  tool: z.enum(["BORDER", "INDIA", "COMPLY", "ESG_GRI", "ESG_ISSB", "ESG_CSRD", "ESG_CDP"]).optional(),
  sector: z.string().trim().optional(),
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
});

export type ListLeadsQuery = z.infer<typeof listLeadsQuerySchema>;
