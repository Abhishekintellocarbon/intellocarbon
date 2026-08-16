import { z } from "zod";
import { GRI_TOPICS, isNegativeImpact, isPotentialImpact } from "@/lib/gri-standards";

const optionalNumericString = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))
  .refine((v) => !v || !Number.isNaN(Number(v)), "Enter a valid number");

const optionalText = z.string().trim().max(4000).optional().or(z.literal(""));

// "FY2025-26" — must match the backend's resolveFyWindow parsing exactly.
export const griReportingPeriodSchema = z
  .string()
  .trim()
  .regex(/^FY\d{4}-\d{2}$/, 'Use the format "FY2025-26"');

// ---------------------------------------------------------------------------
// Materiality assessment
// ---------------------------------------------------------------------------

const rating = z.coerce.number().int().min(1, "Rate from 1 to 5").max(5, "Rate from 1 to 5");

/**
 * One impact row. Mirrors the backend's griImpactSchema including its two
 * cross-field rules, so an impossible combination is caught before the request
 * rather than coming back as a server error the user can't attribute to a row.
 */
export const griImpactSchema = z
  .object({
    topicCode: z.string().min(1, "Pick a GRI topic"),
    description: z.string().trim().min(1, "Describe the impact").max(2000),
    impactType: z.enum(["NEGATIVE_ACTUAL", "NEGATIVE_POTENTIAL", "POSITIVE_ACTUAL", "POSITIVE_POTENTIAL"]),
    valueChainLocation: z.enum(["OWN_OPERATIONS", "UPSTREAM", "DOWNSTREAM"]),
    scale: rating,
    scope: rating,
    irremediability: rating.optional(),
    likelihood: rating.optional(),
  })
  // Irremediability is part of severity, which GRI 3 applies to negative
  // impacts only.
  .refine((v) => !(v.irremediability != null && !isNegativeImpact(v.impactType)), {
    message: "Irremediability applies to negative impacts only",
    path: ["irremediability"],
  })
  // Likelihood distinguishes potential impacts from ones already occurring.
  .refine((v) => !(v.likelihood != null && !isPotentialImpact(v.impactType)), {
    message: "Likelihood applies to potential impacts only",
    path: ["likelihood"],
  });

export type GriImpactFormValues = z.infer<typeof griImpactSchema>;

export const griMaterialitySchema = z.object({
  reportingPeriod: griReportingPeriodSchema,
  stakeholderGroups: z.array(z.string().trim().min(1).max(200)).max(50),
  stakeholderEngagementApproach: optionalText,
  impactIdentificationProcess: optionalText,
  prioritisationProcess: optionalText,
  materialityThreshold: z.coerce.number().min(1).max(5),
  impacts: z.array(griImpactSchema).max(200),
});

export type GriMaterialityFormValues = z.infer<typeof griMaterialitySchema>;

/**
 * The stricter check that must hold before the assessment can be marked
 * complete. Completing it is what activates topic gating and unlocks
 * disclosure entry, so the narrative that justifies the result (GRI 3-1) has
 * to exist — an assessment with scores but no stated process is not a GRI 3-1
 * disclosure, it is a spreadsheet.
 */
export const griMaterialityCompleteSchema = griMaterialitySchema.extend({
  impactIdentificationProcess: z.string().trim().min(1, "Describe how impacts were identified").max(4000),
  prioritisationProcess: z.string().trim().min(1, "Describe how impacts were prioritised").max(4000),
  impacts: z.array(griImpactSchema).min(1, "Add at least one impact before completing the assessment").max(200),
});

// ---------------------------------------------------------------------------
// Disclosure data
// ---------------------------------------------------------------------------

/**
 * The disclosure form keeps every value as a string (matching BRSR/ISSB) and
 * lets the backend coerce. Building the schema from the registry rather than
 * writing ~150 fields by hand is what keeps the two from drifting: a field
 * added to the registry is validated automatically.
 */
const fieldSchema = (type: string) => {
  switch (type) {
    case "text":
      return optionalText;
    case "bool":
      // Rendered as a tri-state Select — "" means "not disclosed", which is
      // distinct from an explicit "No".
      return z.enum(["", "true", "false"]).optional();
    case "pct":
      return optionalNumericString.refine(
        (v) => !v || (Number(v) >= 0 && Number(v) <= 100),
        "Enter a percentage between 0 and 100",
      );
    case "ratio":
      return optionalNumericString.refine(
        (v) => !v || (Number(v) >= 0 && Number(v) <= 10),
        "Enter a ratio (1.00 is parity), not a percentage",
      );
    default:
      return optionalNumericString;
  }
};

export const griTopicSchemas: Record<string, z.ZodTypeAny> = Object.fromEntries(
  GRI_TOPICS.map((topic) => [
    topic.code,
    z.object(Object.fromEntries(topic.fields.map((field) => [field.name, fieldSchema(field.type)]))),
  ]),
);

export const griManagementApproachSchema = z.object({
  impactsDescription: optionalText,
  involvementDescription: optionalText,
  policiesCommitments: optionalText,
  actionsTaken: optionalText,
  effectivenessTracking: optionalText,
  stakeholderEngagement: optionalText,
});

export const griUniversalSchema = z.object({
  legalName: z.string().trim().max(300).optional().or(z.literal("")),
  ownershipLegalForm: z.string().trim().max(300).optional().or(z.literal("")),
  headquartersLocation: z.string().trim().max(300).optional().or(z.literal("")),
  countriesOfOperation: z.string().trim().max(1000).optional().or(z.literal("")),
  entitiesIncluded: optionalText,
  reportingFrequency: z.string().trim().max(200).optional().or(z.literal("")),
  contactPoint: z.string().trim().max(300).optional().or(z.literal("")),
  restatements: optionalText,
  externalAssurancePolicy: optionalText,
  assuranceProvider: z.string().trim().max(300).optional().or(z.literal("")),
  assuranceLevel: z.string().trim().max(200).optional().or(z.literal("")),
  sectorsServed: optionalText,
  valueChainDescription: optionalText,
  significantChangesToValueChain: optionalText,
  employeesTotal: optionalNumericString,
  employeesFemale: optionalNumericString,
  employeesMale: optionalNumericString,
  employeesPermanent: optionalNumericString,
  employeesTemporary: optionalNumericString,
  employeesFullTime: optionalNumericString,
  employeesPartTime: optionalNumericString,
  employeeDataMethodology: optionalText,
  nonEmployeeWorkersTotal: optionalNumericString,
  nonEmployeeWorkersDescription: optionalText,
  governanceStructure: optionalText,
  governanceCommittees: optionalText,
  governanceNominationProcess: optionalText,
  chairIsSeniorExecutive: z.enum(["", "true", "false"]).optional(),
  chairRoleDescription: optionalText,
  governanceImpactOversight: optionalText,
  impactResponsibilityDelegation: optionalText,
  governanceReportingRole: optionalText,
  conflictsOfInterestProcess: optionalText,
  criticalConcernsProcess: optionalText,
  criticalConcernsCount: optionalNumericString,
  governanceCollectiveKnowledge: optionalText,
  governancePerformanceEvaluation: optionalText,
  remunerationPolicies: optionalText,
  remunerationProcess: optionalText,
  compensationRatio: optionalNumericString,
  compensationRatioIncreasePct: optionalNumericString,
  sustainableDevelopmentStatement: optionalText,
  policyCommitments: optionalText,
  humanRightsPolicyCommitment: optionalText,
  policyEmbedding: optionalText,
  remediationProcesses: optionalText,
  adviceAndConcernsMechanisms: optionalText,
  significantFinesCount: optionalNumericString,
  significantFinesValueInr: optionalNumericString,
  nonMonetarySanctionsCount: optionalNumericString,
  complianceIncidentsDescription: optionalText,
  membershipAssociations: optionalText,
  stakeholderEngagementApproach: optionalText,
  collectiveBargainingCoveragePct: optionalNumericString.refine(
    (v) => !v || (Number(v) >= 0 && Number(v) <= 100),
    "Enter a percentage between 0 and 100",
  ),
  collectiveBargainingDescription: optionalText,
});

export const griDisclosureSchema = z.object({
  reportingPeriod: griReportingPeriodSchema,
  turnoverInr: optionalNumericString,
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  universal: griUniversalSchema,
  managementApproach: z.record(z.string(), griManagementApproachSchema),
  topics: z.record(z.string(), z.record(z.string(), z.string().optional())),
});

export type GriDisclosureFormValues = z.infer<typeof griDisclosureSchema>;
