import { z } from "zod";
import { draftString, draftNumber } from "./draft";
import { CDP_MODULES, CDP_MODULE_CODES, type CdpQuestion } from "../data/cdpQuestionnaire";

const reportingPeriodRegex = /^FY\d{4}-\d{2}$/;

export const cdpReportingPeriodSchema = z.string().regex(reportingPeriodRegex, 'Use the format "FY2025-26"');

// Module codes are validated against the registry rather than a Prisma enum,
// so adding a module stays a code-only change.
const moduleCodeSchema = z
  .string()
  .refine((v) => CDP_MODULE_CODES.includes(v), { message: "Unknown CDP module code" });

// ---------------------------------------------------------------------------
// Question payloads, generated from the registry
// ---------------------------------------------------------------------------

const strictFor = (question: CdpQuestion): z.ZodTypeAny => {
  switch (question.type) {
    case "narrative":
      return z.string().trim().max(6000).optional().or(z.literal(""));
    case "int":
      return z.coerce.number().int().nonnegative().optional();
    case "year":
      return z.coerce.number().int().min(1900).max(2100).optional();
    case "pct":
      return z.coerce.number().min(0).max(100).optional();
    case "bool":
      return z.coerce.boolean().optional();
    case "select":
      // Option values come from the registry, so a select can never accept a
      // value the form does not offer — which is what keeps the PDF's option
      // labels resolvable.
      return z
        .enum((question.options ?? []).map((o) => o.value) as [string, ...string[]])
        .optional()
        .or(z.literal(""));
    default:
      return z.coerce.number().nonnegative().optional();
  }
};

const draftFor = (question: CdpQuestion): z.ZodTypeAny => {
  switch (question.type) {
    case "narrative":
    case "select":
      return draftString(6000);
    case "bool":
      return z.preprocess((v) => (v === "" || v === undefined ? null : v), z.coerce.boolean().nullable());
    default:
      return draftNumber();
  }
};

/**
 * Schemas are built from the registry rather than hand-written, for the same
 * reason CSRD's are: with fourteen modules and well over a hundred questions,
 * two hand-maintained copies drift, and a question present in only one of them
 * silently stops validating or stops saving.
 */
const buildShape = (questions: CdpQuestion[], strict: boolean): Record<string, z.ZodTypeAny> =>
  Object.fromEntries(
    questions.filter((question) => !question.derived).map((question) => [question.field, strict ? strictFor(question) : draftFor(question)]),
  );

export const cdpModuleSchemas: Record<string, z.ZodTypeAny> = Object.fromEntries(
  CDP_MODULES.map((m) => [m.code, z.object(buildShape(m.questions, true))]),
);

export const cdpModuleDraftSchemas: Record<string, z.ZodTypeAny> = Object.fromEntries(
  CDP_MODULES.map((m) => [m.code, z.object(buildShape(m.questions, false))]),
);

// ---------------------------------------------------------------------------
// Repeating blocks
// ---------------------------------------------------------------------------

/**
 * One climate risk or opportunity — C2.3 / C2.4.
 *
 * The financial impact range is validated as a range: CDP accepts either bound
 * alone, but a minimum above its maximum is a data-entry error that would
 * print as a nonsensical range in the response and is caught here.
 */
export const cdpRiskSchema = z
  .object({
    kind: z.enum(["RISK", "OPPORTUNITY"]),
    riskType: z.string().trim().min(1, "State the risk or opportunity type").max(200),
    description: z.string().trim().min(1, "Describe the risk or opportunity").max(4000),
    valueChainStage: z.string().trim().max(200).optional().or(z.literal("")),
    timeHorizon: z.enum(["SHORT_TERM", "MEDIUM_TERM", "LONG_TERM"]).optional().or(z.literal("")),
    likelihood: z.string().trim().max(100).optional().or(z.literal("")),
    magnitude: z.string().trim().max(100).optional().or(z.literal("")),
    financialImpactMin: z.coerce.number().nonnegative().optional(),
    financialImpactMax: z.coerce.number().nonnegative().optional(),
    impactDescription: z.string().trim().max(4000).optional().or(z.literal("")),
    responseStrategy: z.string().trim().max(4000).optional().or(z.literal("")),
    responseCost: z.coerce.number().nonnegative().optional(),
  })
  .refine((v) => v.financialImpactMin == null || v.financialImpactMax == null || v.financialImpactMin <= v.financialImpactMax, {
    message: "The minimum financial impact cannot exceed the maximum",
    path: ["financialImpactMax"],
  });

/**
 * One emissions reduction target — C4.1a / C4.1b.
 *
 * The target year must be after the base year, and an intensity target must
 * name the denominator it is stated per. An intensity target without a metric
 * is uninterpretable — "a 30% reduction" per what? — and CDP would reject it,
 * so it is rejected here rather than carried into the response.
 */
export const cdpTargetSchema = z
  .object({
    kind: z.enum(["ABSOLUTE", "INTENSITY"]),
    scopesCovered: z.string().trim().min(1, "State which scopes the target covers").max(200),
    baseYear: z.coerce.number().int().min(1900).max(2100),
    baseYearEmissionsTco2e: z.coerce.number().nonnegative().optional(),
    targetYear: z.coerce.number().int().min(1900).max(2100),
    reductionPct: z.coerce.number().min(0).max(100).optional(),
    intensityMetric: z.string().trim().max(200).optional().or(z.literal("")),
    baseYearIntensity: z.coerce.number().nonnegative().optional(),
    targetIntensity: z.coerce.number().nonnegative().optional(),
    percentAchieved: z.coerce.number().min(0).max(100).optional(),
    isScienceBased: z.boolean().optional(),
    description: z.string().trim().max(4000).optional().or(z.literal("")),
  })
  .refine((v) => v.targetYear > v.baseYear, {
    message: "The target year must be after the base year",
    path: ["targetYear"],
  })
  .refine((v) => v.kind !== "INTENSITY" || Boolean(v.intensityMetric?.trim()), {
    message: "An intensity target needs the metric it is stated per — for example tCO2e per tonne of product",
    path: ["intensityMetric"],
  });

/** One row of a C7 emissions breakdown. */
export const cdpBreakdownSchema = z.object({
  dimension: z.enum(["GAS", "COUNTRY", "BUSINESS_DIVISION", "ACTIVITY"]),
  scope: z.enum(["SCOPE_1", "SCOPE_2"]).optional(),
  label: z.string().trim().min(1, "Name the gas, country, division or activity").max(200),
  emissionsTco2e: z.coerce.number().nonnegative(),
});

// ---------------------------------------------------------------------------
// Whole-report payloads
// ---------------------------------------------------------------------------

const MAX_RISKS = 200;
const MAX_TARGETS = 50;
const MAX_BREAKDOWN_ROWS = 300;

export const cdpDataSchema = z.object({
  reportingPeriod: cdpReportingPeriodSchema,
  revenue: z.coerce.number().nonnegative().optional(),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  modules: z.record(moduleCodeSchema, z.record(z.string(), z.unknown())).optional(),
  risks: z.array(cdpRiskSchema).max(MAX_RISKS).optional(),
  targets: z.array(cdpTargetSchema).max(MAX_TARGETS).optional(),
  breakdownRows: z.array(cdpBreakdownSchema).max(MAX_BREAKDOWN_ROWS).optional(),
});

export const cdpDataDraftSchema = z.object({
  reportingPeriod: cdpReportingPeriodSchema,
  revenue: draftNumber(),
  notes: draftString(2000),
  modules: z.record(moduleCodeSchema, z.record(z.string(), z.unknown())).optional(),
  // Repeating blocks stay strictly validated even on a draft save. Unlike a
  // scalar field, a half-built row has no meaningful "empty" state to store —
  // a target with no base year could not be rendered or submitted later — so
  // the frontend holds incomplete rows client-side rather than autosaving
  // them, and this schema is what enforces that.
  risks: z.array(cdpRiskSchema).max(MAX_RISKS).optional(),
  targets: z.array(cdpTargetSchema).max(MAX_TARGETS).optional(),
  breakdownRows: z.array(cdpBreakdownSchema).max(MAX_BREAKDOWN_ROWS).optional(),
});

export type CdpDataInput = z.infer<typeof cdpDataSchema>;

const parseWith = (
  schema: z.ZodTypeAny | undefined,
  payload: unknown,
  what: string,
): { success: true; data: Record<string, unknown> } | { success: false; message: string } => {
  if (!schema) return { success: false, message: `Unknown CDP module "${what}"` };
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      success: false,
      message: `${what}${issue?.path.length ? ` (${issue.path.join(".")})` : ""}: ${issue?.message ?? "Invalid value"}`,
    };
  }
  return { success: true, data: parsed.data as Record<string, unknown> };
};

export const parseModulePayload = (moduleCode: string, payload: unknown, submit: boolean) =>
  parseWith((submit ? cdpModuleSchemas : cdpModuleDraftSchemas)[moduleCode], payload, moduleCode);
