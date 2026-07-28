import { z } from "zod";

const optionalNumericString = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))
  .refine((v) => !v || !Number.isNaN(Number(v)), "Enter a valid number");

const optionalText = z.string().trim().max(4000).optional().or(z.literal(""));

// "FY2025-26" — must match backend's resolveFyWindow parsing exactly.
export const reportingPeriodSchema = z
  .string()
  .trim()
  .regex(/^FY\d{4}-\d{2}$/, 'Use the format "FY2025-26"');

export const issbS1S2Schema = z.object({
  reportingPeriod: reportingPeriodSchema,

  // Pillar 1: Governance
  governanceBodyOversight: optionalText,
  managementRole: optionalText,

  // Pillar 2: Strategy
  climateRisksOpportunities: optionalText,
  businessModelImpact: optionalText,
  financialEffects: optionalText,
  scenarioAnalysisResilience: optionalText,

  // Pillar 3: Risk Management
  riskIdentificationProcess: optionalText,
  riskManagementProcess: optionalText,
  riskIntegrationOverall: optionalText,

  // Pillar 4: Metrics & Targets
  scope3Tco2e: optionalNumericString,
  targetDescription: optionalText,
  targetYear: optionalNumericString,
  baselineYear: optionalNumericString,
  baselineEmissionsTco2e: optionalNumericString,
  transitionPlan: optionalText,
  internalCarbonPriceInr: optionalNumericString,
  climateCapexInr: optionalNumericString,

  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type IssbS1S2FormValues = z.infer<typeof issbS1S2Schema>;
