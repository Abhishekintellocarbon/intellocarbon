import { z } from "zod";
import { draftString, draftNumber } from "./draft";

// "FY2025-26" — matches resolveFyWindow's parsing in issbCalculation.service.ts
// (shared logic with brsrCalculation.service.ts).
const reportingPeriodRegex = /^FY\d{4}-\d{2}$/;

export const issbS1S2ReportSchema = z.object({
  reportingPeriod: z.string().regex(reportingPeriodRegex, 'Use the format "FY2025-26"'),

  // --- Pillar 1: Governance ---
  governanceBodyOversight: z.string().trim().max(4000).optional().or(z.literal("")),
  managementRole: z.string().trim().max(4000).optional().or(z.literal("")),

  // --- Pillar 2: Strategy ---
  climateRisksOpportunities: z.string().trim().max(4000).optional().or(z.literal("")),
  businessModelImpact: z.string().trim().max(4000).optional().or(z.literal("")),
  financialEffects: z.string().trim().max(4000).optional().or(z.literal("")),
  scenarioAnalysisResilience: z.string().trim().max(4000).optional().or(z.literal("")),

  // --- Pillar 3: Risk Management ---
  riskIdentificationProcess: z.string().trim().max(4000).optional().or(z.literal("")),
  riskManagementProcess: z.string().trim().max(4000).optional().or(z.literal("")),
  riskIntegrationOverall: z.string().trim().max(4000).optional().or(z.literal("")),

  // --- Pillar 4: Metrics & Targets ---
  scope3Tco2e: z.coerce.number().nonnegative().optional(),
  targetDescription: z.string().trim().max(4000).optional().or(z.literal("")),
  targetYear: z.coerce.number().int().min(2000).max(2100).optional(),
  baselineYear: z.coerce.number().int().min(2000).max(2100).optional(),
  baselineEmissionsTco2e: z.coerce.number().nonnegative().optional(),
  transitionPlan: z.string().trim().max(4000).optional().or(z.literal("")),
  internalCarbonPriceInr: z.coerce.number().nonnegative().optional(),
  climateCapexInr: z.coerce.number().nonnegative().optional(),

  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type IssbS1S2ReportInput = z.infer<typeof issbS1S2ReportSchema>;

// Permissive autosave counterpart — every field optional/nullable, save reportingPeriod
// which anchors the (facilityId, reportingPeriod) unique row and so must be picked
// before the first draft save (matching BRSR Core's UX).
export const issbS1S2ReportDraftSchema = z.object({
  reportingPeriod: z.string().regex(reportingPeriodRegex, 'Use the format "FY2025-26"'),

  governanceBodyOversight: draftString(4000),
  managementRole: draftString(4000),

  climateRisksOpportunities: draftString(4000),
  businessModelImpact: draftString(4000),
  financialEffects: draftString(4000),
  scenarioAnalysisResilience: draftString(4000),

  riskIdentificationProcess: draftString(4000),
  riskManagementProcess: draftString(4000),
  riskIntegrationOverall: draftString(4000),

  scope3Tco2e: draftNumber(),
  targetDescription: draftString(4000),
  targetYear: draftNumber(),
  baselineYear: draftNumber(),
  baselineEmissionsTco2e: draftNumber(),
  transitionPlan: draftString(4000),
  internalCarbonPriceInr: draftNumber(),
  climateCapexInr: draftNumber(),

  notes: draftString(2000),
});

export type IssbS1S2ReportDraftInput = z.infer<typeof issbS1S2ReportDraftSchema>;
