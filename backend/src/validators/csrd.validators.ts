import { z } from "zod";
import { draftString, draftNumber } from "./draft";
import { ESRS_STANDARD_CODES, ESRS_2_DATAPOINTS, ESRS_STANDARDS, type EsrsDatapoint } from "../data/esrsStandards";

const reportingPeriodRegex = /^FY\d{4}-\d{2}$/;

export const csrdReportingPeriodSchema = z
  .string()
  .regex(reportingPeriodRegex, 'Use the format "FY2025-26"');

const rating = z.coerce.number().int().min(1, "Rate from 1 to 5").max(5, "Rate from 1 to 5");

// Standard codes are validated against the registry rather than a Prisma enum,
// so adding a standard stays a code-only change.
const standardCodeSchema = z
  .string()
  .refine((v) => ESRS_STANDARD_CODES.includes(v), { message: "Unknown ESRS standard code" });

// ---------------------------------------------------------------------------
// Double materiality
// ---------------------------------------------------------------------------

/**
 * One impact, risk or opportunity.
 *
 * `kind` decides which score blocks must be present. An IRO scored on neither
 * axis is meaningless, and one whose `kind` says IMPACT but which carries only
 * financial attributes is a data-entry error the assessment would otherwise
 * silently score as zero — so both are rejected here rather than downstream.
 */
export const csrdIroSchema = z
  .object({
    standardCode: standardCodeSchema,
    description: z.string().trim().min(1, "Describe the impact, risk or opportunity").max(2000),
    kind: z.enum(["IMPACT", "FINANCIAL", "BOTH"]),
    valueChainLocation: z.enum(["OWN_OPERATIONS", "UPSTREAM", "DOWNSTREAM"]).default("OWN_OPERATIONS"),

    // Impact axis
    impactType: z
      .enum(["NEGATIVE_ACTUAL", "NEGATIVE_POTENTIAL", "POSITIVE_ACTUAL", "POSITIVE_POTENTIAL"])
      .optional(),
    scale: rating.optional(),
    scope: rating.optional(),
    irremediability: rating.optional(),
    impactLikelihood: rating.optional(),

    // Financial axis
    financialEffectType: z.enum(["RISK", "OPPORTUNITY"]).optional(),
    magnitude: rating.optional(),
    financialLikelihood: rating.optional(),
  })
  .refine(
    (v) => v.kind === "FINANCIAL" || (v.impactType != null && v.scale != null && v.scope != null),
    { message: "Impact-assessed entries need an impact type, scale and scope", path: ["scale"] },
  )
  .refine((v) => v.kind === "IMPACT" || (v.financialEffectType != null && v.magnitude != null), {
    message: "Financially-assessed entries need an effect type and magnitude",
    path: ["magnitude"],
  })
  // Irremediability is part of impact severity and applies to negative impacts
  // only — the same rule GRI enforces, since ESRS aligned to it.
  .refine((v) => !(v.irremediability != null && v.impactType?.startsWith("POSITIVE")), {
    message: "Irremediability applies to negative impacts only",
    path: ["irremediability"],
  })
  .refine((v) => !(v.impactLikelihood != null && v.impactType?.endsWith("_ACTUAL")), {
    message: "Likelihood applies to potential impacts only",
    path: ["impactLikelihood"],
  });

export type CsrdIroInput = z.infer<typeof csrdIroSchema>;

export const csrdMaterialitySchema = z.object({
  reportingPeriod: csrdReportingPeriodSchema,
  stakeholderGroups: z.array(z.string().trim().min(1).max(200)).max(50).optional(),
  engagementApproach: z.string().trim().max(4000).optional().or(z.literal("")),
  iroIdentificationProcess: z.string().trim().max(4000).optional().or(z.literal("")),
  prioritisationProcess: z.string().trim().max(4000).optional().or(z.literal("")),
  impactThreshold: z.coerce.number().min(1).max(5).optional(),
  financialThreshold: z.coerce.number().min(1).max(5).optional(),
  iros: z.array(csrdIroSchema).max(300).optional(),
  /** Flips completedAt, which is what activates standard gating. */
  complete: z.boolean().optional(),
});

export type CsrdMaterialityInput = z.infer<typeof csrdMaterialitySchema>;

export const csrdMaterialityDraftSchema = csrdMaterialitySchema.extend({
  engagementApproach: draftString(4000),
  iroIdentificationProcess: draftString(4000),
  prioritisationProcess: draftString(4000),
  impactThreshold: draftNumber(),
  financialThreshold: draftNumber(),
});

/**
 * The stricter check before the assessment can be marked complete. Completing
 * it activates gating and unlocks datapoint entry, so ESRS 2 IRO-1 — the
 * account of how impacts, risks and opportunities were identified — has to
 * exist. An assessment with scores but no stated process is not a disclosure.
 */
export const csrdMaterialityCompleteSchema = csrdMaterialitySchema.extend({
  iroIdentificationProcess: z.string().trim().min(1, "Describe how IROs were identified").max(4000),
  prioritisationProcess: z.string().trim().min(1, "Describe how IROs were prioritised").max(4000),
  iros: z.array(csrdIroSchema).min(1, "Add at least one impact, risk or opportunity").max(300),
});

// ---------------------------------------------------------------------------
// Material standard decisions (ESRS 2 minimum disclosure requirements)
// ---------------------------------------------------------------------------

export const csrdMaterialTopicSchema = z
  .object({
    standardCode: standardCodeSchema,
    isMaterial: z.boolean(),
    notMaterialRationale: z.string().trim().max(2000).optional().or(z.literal("")),
    policies: z.string().trim().max(4000).optional().or(z.literal("")),
    actions: z.string().trim().max(4000).optional().or(z.literal("")),
    targets: z.string().trim().max(4000).optional().or(z.literal("")),
    metrics: z.string().trim().max(4000).optional().or(z.literal("")),
  })
  .refine((v) => v.isMaterial || Boolean(v.notMaterialRationale?.trim()), {
    message: "Explain why this standard is not material",
    path: ["notMaterialRationale"],
  });

export const csrdMaterialTopicDraftSchema = z.object({
  standardCode: standardCodeSchema,
  isMaterial: z.boolean(),
  notMaterialRationale: draftString(2000),
  policies: draftString(4000),
  actions: draftString(4000),
  targets: draftString(4000),
  metrics: draftString(4000),
});

// ---------------------------------------------------------------------------
// Datapoint payloads, generated from the registry
// ---------------------------------------------------------------------------

const strictFor = (d: EsrsDatapoint): z.ZodTypeAny => {
  switch (d.type) {
    case "narrative":
      return z.string().trim().max(4000).optional().or(z.literal(""));
    case "int":
      return z.coerce.number().int().nonnegative().optional();
    case "year":
      return z.coerce.number().int().min(1900).max(2100).optional();
    case "pct":
      return z.coerce.number().min(0).max(100).optional();
    case "bool":
      return z.coerce.boolean().optional();
    default:
      return z.coerce.number().nonnegative().optional();
  }
};

const draftFor = (d: EsrsDatapoint): z.ZodTypeAny => {
  switch (d.type) {
    case "narrative":
      return draftString(4000);
    case "bool":
      return z.preprocess((v) => (v === "" || v === undefined ? null : v), z.coerce.boolean().nullable());
    default:
      return draftNumber();
  }
};

/**
 * Schemas are built from the registry rather than hand-written. With eleven
 * standards and ~180 datapoints, two hand-maintained copies would drift, and a
 * datapoint present in only one of them silently stops validating or stops
 * saving. It also means populating the registry from the delegated act annex
 * updates validation automatically.
 */
const buildShape = (dps: EsrsDatapoint[], strict: boolean): Record<string, z.ZodTypeAny> =>
  Object.fromEntries(dps.filter((d) => !d.derived).map((d) => [d.field, strict ? strictFor(d) : draftFor(d)]));

export const csrdGeneralSchema = z.object(buildShape(ESRS_2_DATAPOINTS, true));
export const csrdGeneralDraftSchema = z.object(buildShape(ESRS_2_DATAPOINTS, false));

export const csrdStandardSchemas: Record<string, z.ZodTypeAny> = Object.fromEntries(
  ESRS_STANDARDS.map((s) => [s.code, z.object(buildShape(s.datapoints, true))]),
);

export const csrdStandardDraftSchemas: Record<string, z.ZodTypeAny> = Object.fromEntries(
  ESRS_STANDARDS.map((s) => [s.code, z.object(buildShape(s.datapoints, false))]),
);

export const csrdDataSchema = z.object({
  reportingPeriod: csrdReportingPeriodSchema,
  netRevenueEur: z.coerce.number().nonnegative().optional(),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  general: z.record(z.string(), z.unknown()).optional(),
  materialTopics: z.array(csrdMaterialTopicSchema).max(20).optional(),
  standards: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
});

export const csrdDataDraftSchema = z.object({
  reportingPeriod: csrdReportingPeriodSchema,
  netRevenueEur: draftNumber(),
  notes: draftString(2000),
  general: z.record(z.string(), z.unknown()).optional(),
  materialTopics: z.array(csrdMaterialTopicDraftSchema).max(20).optional(),
  standards: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
});

export type CsrdDataInput = z.infer<typeof csrdDataSchema>;

const parseWith = (
  schema: z.ZodTypeAny | undefined,
  payload: unknown,
  what: string,
): { success: true; data: Record<string, unknown> } | { success: false; message: string } => {
  if (!schema) return { success: false, message: `Unknown ESRS standard "${what}"` };
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

export const parseGeneralPayload = (payload: unknown, submit: boolean) =>
  parseWith(submit ? csrdGeneralSchema : csrdGeneralDraftSchema, payload, "ESRS 2");

export const parseStandardPayload = (standardCode: string, payload: unknown, submit: boolean) =>
  parseWith(
    (submit ? csrdStandardSchemas : csrdStandardDraftSchemas)[standardCode],
    payload,
    standardCode,
  );
