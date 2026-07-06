import { z } from "zod";
import { draftString, draftNumber } from "./draft";

// "FY2025-26" — matches resolveFyWindow's parsing in brsrCalculation.service.ts.
const reportingPeriodRegex = /^FY\d{4}-\d{2}$/;

export const brsrCoreReportSchema = z.object({
  reportingPeriod: z.string().regex(reportingPeriodRegex, 'Use the format "FY2025-26"'),
  turnoverInr: z.coerce.number().nonnegative().optional(),

  waterWithdrawnKl: z.coerce.number().nonnegative().optional(),
  waterDischargedKl: z.coerce.number().nonnegative().optional(),

  wasteGeneratedTonnes: z.coerce.number().nonnegative().optional(),
  wasteRecoveredTonnes: z.coerce.number().nonnegative().optional(),

  renewableEnergyConsumptionGj: z.coerce.number().nonnegative().optional(),
  nonRenewableEnergyConsumptionGj: z.coerce.number().nonnegative().optional(),

  employeeCountTotal: z.coerce.number().int().nonnegative().optional(),
  employeeCountFemale: z.coerce.number().int().nonnegative().optional(),
  wagesPaidMaleInr: z.coerce.number().nonnegative().optional(),
  wagesPaidFemaleInr: z.coerce.number().nonnegative().optional(),
  safetyIncidentsCount: z.coerce.number().int().nonnegative().optional(),

  womenInWorkforcePct: z.coerce.number().min(0).max(100).optional(),
  womenInManagementPct: z.coerce.number().min(0).max(100).optional(),

  procurementFromMsmePct: z.coerce.number().min(0).max(100).optional(),

  purchasesFromTop10SuppliersPct: z.coerce.number().min(0).max(100).optional(),
  salesToTop10CustomersPct: z.coerce.number().min(0).max(100).optional(),

  consumerComplaintsCount: z.coerce.number().int().nonnegative().optional(),
  consumerComplaintsResolvedPct: z.coerce.number().min(0).max(100).optional(),

  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type BrsrCoreReportInput = z.infer<typeof brsrCoreReportSchema>;

// Permissive autosave counterpart — every field optional/nullable, save reportingPeriod
// which anchors the (facilityId, reportingPeriod) unique row and so must be picked
// before the first draft save (matching the "reportingPeriod chosen up front" UX).
export const brsrCoreReportDraftSchema = z.object({
  reportingPeriod: z.string().regex(reportingPeriodRegex, 'Use the format "FY2025-26"'),
  turnoverInr: draftNumber(),
  waterWithdrawnKl: draftNumber(),
  waterDischargedKl: draftNumber(),
  wasteGeneratedTonnes: draftNumber(),
  wasteRecoveredTonnes: draftNumber(),
  renewableEnergyConsumptionGj: draftNumber(),
  nonRenewableEnergyConsumptionGj: draftNumber(),
  employeeCountTotal: draftNumber(),
  employeeCountFemale: draftNumber(),
  wagesPaidMaleInr: draftNumber(),
  wagesPaidFemaleInr: draftNumber(),
  safetyIncidentsCount: draftNumber(),
  womenInWorkforcePct: draftNumber(),
  womenInManagementPct: draftNumber(),
  procurementFromMsmePct: draftNumber(),
  purchasesFromTop10SuppliersPct: draftNumber(),
  salesToTop10CustomersPct: draftNumber(),
  consumerComplaintsCount: draftNumber(),
  consumerComplaintsResolvedPct: draftNumber(),
  notes: draftString(2000),
});

export type BrsrCoreReportDraftInput = z.infer<typeof brsrCoreReportDraftSchema>;
