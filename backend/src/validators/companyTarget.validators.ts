import { z } from "zod";

/**
 * A target must be interpretable to be worth storing. The refinements below
 * are the same shape as cdpTargetSchema's, so a target entered here and one
 * entered in a CDP response cannot disagree about what counts as valid.
 */
export const companyTargetSchema = z
  .object({
    kind: z.enum(["ABSOLUTE", "INTENSITY"]).default("ABSOLUTE"),
    scopesCovered: z.string().trim().min(1, "State which scopes the target covers").max(200),
    baselineYear: z.coerce.number().int().min(1990).max(2100),
    baselineEmissionsTco2e: z.coerce.number().nonnegative(),
    targetYear: z.coerce.number().int().min(1990).max(2100),
    reductionPct: z.coerce.number().min(0).max(100).optional(),
    intensityMetric: z.string().trim().max(200).optional().or(z.literal("")),
    baselineIntensity: z.coerce.number().nonnegative().optional(),
    targetIntensity: z.coerce.number().nonnegative().optional(),
    isNetZero: z.boolean().optional(),
    sbtiStatus: z.enum(["NOT_SUBMITTED", "COMMITTED", "SUBMITTED", "VALIDATED"]).optional(),
    description: z.string().trim().max(4000).optional().or(z.literal("")),
  })
  .refine((v) => v.targetYear > v.baselineYear, {
    message: "The target year must be after the baseline year",
    path: ["targetYear"],
  })
  .refine((v) => v.kind !== "INTENSITY" || Boolean(v.intensityMetric?.trim()), {
    message: "An intensity target needs the metric it is stated per — for example tCO2e per tonne of product",
    path: ["intensityMetric"],
  })
  // A net-zero target without a reduction percentage is untrackable, and
  // net zero means ~100% against the baseline. Stating something far lower
  // alongside the net-zero flag is a contradiction worth catching at entry.
  .refine((v) => !v.isNetZero || v.reductionPct == null || v.reductionPct >= 90, {
    message: "A net-zero target implies a reduction of at least 90% — uncheck net zero or raise the percentage",
    path: ["reductionPct"],
  });

export type CompanyTargetInputParsed = z.infer<typeof companyTargetSchema>;
