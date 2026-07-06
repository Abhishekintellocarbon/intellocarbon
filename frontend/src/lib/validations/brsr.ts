import { z } from "zod";

const optionalNumericString = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))
  .refine((v) => !v || !Number.isNaN(Number(v)), "Enter a valid number");

const percentString = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))
  .refine(
    (v) => !v || (!Number.isNaN(Number(v)) && Number(v) >= 0 && Number(v) <= 100),
    "Enter a value between 0 and 100",
  );

// "FY2025-26" — must match backend's resolveFyWindow parsing exactly.
export const reportingPeriodSchema = z
  .string()
  .trim()
  .regex(/^FY\d{4}-\d{2}$/, 'Use the format "FY2025-26"');

export const brsrCoreSchema = z.object({
  reportingPeriod: reportingPeriodSchema,
  turnoverInr: optionalNumericString,

  waterWithdrawnKl: optionalNumericString,
  waterDischargedKl: optionalNumericString,

  wasteGeneratedTonnes: optionalNumericString,
  wasteRecoveredTonnes: optionalNumericString,

  renewableEnergyConsumptionGj: optionalNumericString,
  nonRenewableEnergyConsumptionGj: optionalNumericString,

  employeeCountTotal: optionalNumericString,
  employeeCountFemale: optionalNumericString,
  wagesPaidMaleInr: optionalNumericString,
  wagesPaidFemaleInr: optionalNumericString,
  safetyIncidentsCount: optionalNumericString,

  womenInWorkforcePct: percentString,
  womenInManagementPct: percentString,

  procurementFromMsmePct: percentString,

  purchasesFromTop10SuppliersPct: percentString,
  salesToTop10CustomersPct: percentString,

  consumerComplaintsCount: optionalNumericString,
  consumerComplaintsResolvedPct: percentString,

  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type BrsrCoreFormValues = z.infer<typeof brsrCoreSchema>;
