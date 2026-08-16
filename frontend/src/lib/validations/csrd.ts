import { z } from "zod";
import { ESRS_2_DATAPOINTS, ESRS_STANDARDS, isNegativeImpact, isPotentialImpact, type EsrsDatapoint } from "@/lib/esrs-standards";

const optionalNumericString = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))
  .refine((v) => !v || !Number.isNaN(Number(v)), "Enter a valid number");

const optionalText = z.string().trim().max(4000).optional().or(z.literal(""));

export const csrdReportingPeriodSchema = z
  .string()
  .trim()
  .regex(/^FY\d{4}-\d{2}$/, 'Use the format "FY2025-26"');

const rating = z.coerce.number().int().min(1, "Rate from 1 to 5").max(5, "Rate from 1 to 5");

/**
 * One impact, risk or opportunity. Mirrors the backend's csrdIroSchema
 * including its cross-field rules, so an impossible combination is caught in
 * the form rather than coming back as a server error the preparer cannot
 * attribute to a row.
 */
export const csrdIroSchema = z
  .object({
    standardCode: z.string().min(1, "Pick an ESRS standard"),
    description: z.string().trim().min(1, "Describe the matter").max(2000),
    kind: z.enum(["IMPACT", "FINANCIAL", "BOTH"]),
    valueChainLocation: z.enum(["OWN_OPERATIONS", "UPSTREAM", "DOWNSTREAM"]),
    impactType: z
      .enum(["NEGATIVE_ACTUAL", "NEGATIVE_POTENTIAL", "POSITIVE_ACTUAL", "POSITIVE_POTENTIAL"])
      .optional(),
    scale: rating.optional(),
    scope: rating.optional(),
    irremediability: rating.optional(),
    impactLikelihood: rating.optional(),
    financialEffectType: z.enum(["RISK", "OPPORTUNITY"]).optional(),
    magnitude: rating.optional(),
    financialLikelihood: rating.optional(),
  })
  .refine((v) => v.kind === "FINANCIAL" || (v.impactType != null && v.scale != null && v.scope != null), {
    message: "Impact-assessed matters need a type, scale and scope",
    path: ["scale"],
  })
  .refine((v) => v.kind === "IMPACT" || (v.financialEffectType != null && v.magnitude != null), {
    message: "Financially-assessed matters need an effect type and magnitude",
    path: ["magnitude"],
  })
  .refine((v) => !(v.irremediability != null && v.impactType != null && !isNegativeImpact(v.impactType)), {
    message: "Irremediability applies to negative impacts only",
    path: ["irremediability"],
  })
  .refine((v) => !(v.impactLikelihood != null && v.impactType != null && !isPotentialImpact(v.impactType)), {
    message: "Likelihood applies to potential impacts only",
    path: ["impactLikelihood"],
  });

export type CsrdIroFormValues = z.infer<typeof csrdIroSchema>;

export const csrdMaterialitySchema = z.object({
  reportingPeriod: csrdReportingPeriodSchema,
  stakeholderGroups: z.array(z.string().trim().min(1).max(200)).max(50),
  engagementApproach: optionalText,
  iroIdentificationProcess: optionalText,
  prioritisationProcess: optionalText,
  impactThreshold: z.coerce.number().min(1).max(5),
  financialThreshold: z.coerce.number().min(1).max(5),
  iros: z.array(csrdIroSchema).max(300),
});

/** ESRS 2 IRO-1 must exist before the assessment can activate standard gating. */
export const csrdMaterialityCompleteSchema = csrdMaterialitySchema.extend({
  iroIdentificationProcess: z.string().trim().min(1, "Describe how matters were identified").max(4000),
  prioritisationProcess: z.string().trim().min(1, "Describe how matters were prioritised").max(4000),
  iros: z.array(csrdIroSchema).min(1, "Add at least one impact, risk or opportunity").max(300),
});

/**
 * Datapoint schemas are built from the registry rather than written out. The
 * form keeps every value as a string and lets the backend coerce, matching the
 * pattern the other frameworks use.
 */
const fieldSchema = (d: EsrsDatapoint) => {
  switch (d.type) {
    case "narrative":
      return optionalText;
    case "bool":
      return z.enum(["", "true", "false"]).optional();
    case "pct":
      return optionalNumericString.refine(
        (v) => !v || (Number(v) >= 0 && Number(v) <= 100),
        "Enter a percentage between 0 and 100",
      );
    default:
      return optionalNumericString;
  }
};

const shapeFor = (dps: EsrsDatapoint[]) =>
  Object.fromEntries(dps.filter((d) => !d.derived).map((d) => [d.field, fieldSchema(d)]));

export const csrdGeneralSchema = z.object(shapeFor(ESRS_2_DATAPOINTS));

export const csrdStandardSchemas: Record<string, z.ZodTypeAny> = Object.fromEntries(
  ESRS_STANDARDS.map((s) => [s.code, z.object(shapeFor(s.datapoints))]),
);

export const csrdMdrSchema = z.object({
  policies: optionalText,
  actions: optionalText,
  targets: optionalText,
  metrics: optionalText,
});
