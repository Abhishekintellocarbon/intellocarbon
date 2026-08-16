import { z } from "zod";
import { draftString, draftNumber } from "./draft";
import { GRI_TOPIC_CODES, GRI_OMISSION_REASONS } from "../data/griStandards";

// "FY2025-26" — matches resolveFyWindow's parsing in griCalculation.service.ts
// (shared with brsr/issb).
const reportingPeriodRegex = /^FY\d{4}-\d{2}$/;

export const griReportingPeriodSchema = z
  .string()
  .regex(reportingPeriodRegex, 'Use the format "FY2025-26"');

const text = (max = 4000) => z.string().trim().max(max).optional().or(z.literal(""));
const num = () => z.coerce.number().optional();
const nonNegative = () => z.coerce.number().nonnegative().optional();
const count = () => z.coerce.number().int().nonnegative().optional();
const pct = () => z.coerce.number().min(0).max(100).optional();
const year = () => z.coerce.number().int().min(1900).max(2100).optional();
const bool = () => z.coerce.boolean().optional();

const draftBool = () => z.preprocess((v) => (v === "" || v === undefined ? null : v), z.coerce.boolean().nullable());

// Topic codes are validated against the registry rather than a Prisma enum —
// same rationale as Facility.productionRoute, so adding a Topic Standard is a
// code-only change.
const topicCodeSchema = z
  .string()
  .refine((v) => GRI_TOPIC_CODES.includes(v), { message: "Unknown GRI topic code" });

// ---------------------------------------------------------------------------
// Materiality assessment (GRI 3-1)
// ---------------------------------------------------------------------------

// GRI 3 scores each attribute on a 1-5 scale; the calculation service relies on
// that range to keep significance comparable to materialityThreshold.
const ratingScale = z.coerce.number().int().min(1, "Rate from 1 to 5").max(5, "Rate from 1 to 5");

export const griImpactSchema = z
  .object({
    topicCode: topicCodeSchema,
    description: z.string().trim().min(1, "Describe the impact").max(2000),
    impactType: z.enum(["NEGATIVE_ACTUAL", "NEGATIVE_POTENTIAL", "POSITIVE_ACTUAL", "POSITIVE_POTENTIAL"]),
    valueChainLocation: z.enum(["OWN_OPERATIONS", "UPSTREAM", "DOWNSTREAM"]).default("OWN_OPERATIONS"),
    scale: ratingScale,
    scope: ratingScale,
    irremediability: ratingScale.optional(),
    likelihood: ratingScale.optional(),
  })
  // Irremediability is part of severity, which GRI 3 applies to negative
  // impacts only — accepting it on a positive impact would imply it affects
  // the score, and it does not (see computeImpactSignificance).
  .refine((v) => !(v.irremediability != null && v.impactType.startsWith("POSITIVE")), {
    message: "Irremediability applies to negative impacts only",
    path: ["irremediability"],
  })
  // Likelihood distinguishes potential impacts from ones that have already
  // occurred; on an actual impact it is meaningless.
  .refine((v) => !(v.likelihood != null && v.impactType.endsWith("_ACTUAL")), {
    message: "Likelihood applies to potential impacts only",
    path: ["likelihood"],
  });

export type GriImpactInput = z.infer<typeof griImpactSchema>;

export const griMaterialityAssessmentSchema = z.object({
  reportingPeriod: griReportingPeriodSchema,
  stakeholderGroups: z.array(z.string().trim().min(1).max(200)).max(50).optional(),
  stakeholderEngagementApproach: text(),
  impactIdentificationProcess: text(),
  prioritisationProcess: text(),
  materialityThreshold: z.coerce.number().min(1).max(5).optional(),
  impacts: z.array(griImpactSchema).max(200).optional(),
  /** Flips completedAt, which is what actually activates topic gating. */
  complete: z.boolean().optional(),
});

export type GriMaterialityAssessmentInput = z.infer<typeof griMaterialityAssessmentSchema>;

// Permissive counterpart for autosave. Impacts stay strictly validated even in
// a draft: they are structured rows the scoring function must be able to read,
// unlike free-text fields where a partial value is harmless.
export const griMaterialityAssessmentDraftSchema = z.object({
  reportingPeriod: griReportingPeriodSchema,
  stakeholderGroups: z.array(z.string().trim().min(1).max(200)).max(50).optional(),
  stakeholderEngagementApproach: draftString(4000),
  impactIdentificationProcess: draftString(4000),
  prioritisationProcess: draftString(4000),
  materialityThreshold: draftNumber(),
  impacts: z.array(griImpactSchema).max(200).optional(),
  complete: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Material topic decisions (GRI 3-2 / 3-3)
// ---------------------------------------------------------------------------

export const griMaterialTopicSchema = z
  .object({
    topicCode: topicCodeSchema,
    isMaterial: z.boolean(),
    notMaterialRationale: text(2000),
    // GRI 3-3's six sub-requirements.
    impactsDescription: text(),
    involvementDescription: text(),
    policiesCommitments: text(),
    actionsTaken: text(),
    effectivenessTracking: text(),
    stakeholderEngagement: text(),
  })
  // An unexplained exclusion is precisely what a GRI content index must not
  // contain, so it is rejected at the edge rather than surfaced later as an
  // "in accordance" blocker.
  .refine((v) => v.isMaterial || Boolean(v.notMaterialRationale?.trim()), {
    message: "Explain why this topic is not material",
    path: ["notMaterialRationale"],
  });

export type GriMaterialTopicInput = z.infer<typeof griMaterialTopicSchema>;

export const griMaterialTopicDraftSchema = z.object({
  topicCode: topicCodeSchema,
  isMaterial: z.boolean(),
  notMaterialRationale: draftString(2000),
  impactsDescription: draftString(4000),
  involvementDescription: draftString(4000),
  policiesCommitments: draftString(4000),
  actionsTaken: draftString(4000),
  effectivenessTracking: draftString(4000),
  stakeholderEngagement: draftString(4000),
});

// ---------------------------------------------------------------------------
// GRI 2: General Disclosures
// ---------------------------------------------------------------------------

const universalShape = {
  legalName: text(300),
  ownershipLegalForm: text(300),
  headquartersLocation: text(300),
  countriesOfOperation: text(1000),
  entitiesIncluded: text(),
  reportingFrequency: text(200),
  contactPoint: text(300),
  publicationDate: z.coerce.date().optional(),
  restatements: text(),
  externalAssurancePolicy: text(),
  assuranceProvider: text(300),
  assuranceLevel: text(200),
  sectorsServed: text(),
  valueChainDescription: text(),
  significantChangesToValueChain: text(),
  employeesTotal: count(),
  employeesFemale: count(),
  employeesMale: count(),
  employeesPermanent: count(),
  employeesTemporary: count(),
  employeesFullTime: count(),
  employeesPartTime: count(),
  employeeDataMethodology: text(),
  nonEmployeeWorkersTotal: count(),
  nonEmployeeWorkersDescription: text(),
  governanceStructure: text(),
  governanceCommittees: text(),
  governanceNominationProcess: text(),
  chairIsSeniorExecutive: bool(),
  chairRoleDescription: text(),
  governanceImpactOversight: text(),
  impactResponsibilityDelegation: text(),
  governanceReportingRole: text(),
  conflictsOfInterestProcess: text(),
  criticalConcernsProcess: text(),
  criticalConcernsCount: count(),
  governanceCollectiveKnowledge: text(),
  governancePerformanceEvaluation: text(),
  remunerationPolicies: text(),
  remunerationProcess: text(),
  compensationRatio: nonNegative(),
  compensationRatioIncreasePct: num(),
  sustainableDevelopmentStatement: text(),
  policyCommitments: text(),
  humanRightsPolicyCommitment: text(),
  policyEmbedding: text(),
  remediationProcesses: text(),
  adviceAndConcernsMechanisms: text(),
  significantFinesCount: count(),
  significantFinesValueInr: nonNegative(),
  nonMonetarySanctionsCount: count(),
  complianceIncidentsDescription: text(),
  membershipAssociations: text(),
  stakeholderEngagementApproach: text(),
  collectiveBargainingCoveragePct: pct(),
  collectiveBargainingDescription: text(),
};

const universalDraftShape = {
  legalName: draftString(300),
  ownershipLegalForm: draftString(300),
  headquartersLocation: draftString(300),
  countriesOfOperation: draftString(1000),
  entitiesIncluded: draftString(4000),
  reportingFrequency: draftString(200),
  contactPoint: draftString(300),
  publicationDate: z.preprocess((v) => (v === "" || v === undefined ? null : v), z.coerce.date().nullable()),
  restatements: draftString(4000),
  externalAssurancePolicy: draftString(4000),
  assuranceProvider: draftString(300),
  assuranceLevel: draftString(200),
  sectorsServed: draftString(4000),
  valueChainDescription: draftString(4000),
  significantChangesToValueChain: draftString(4000),
  employeesTotal: draftNumber(),
  employeesFemale: draftNumber(),
  employeesMale: draftNumber(),
  employeesPermanent: draftNumber(),
  employeesTemporary: draftNumber(),
  employeesFullTime: draftNumber(),
  employeesPartTime: draftNumber(),
  employeeDataMethodology: draftString(4000),
  nonEmployeeWorkersTotal: draftNumber(),
  nonEmployeeWorkersDescription: draftString(4000),
  governanceStructure: draftString(4000),
  governanceCommittees: draftString(4000),
  governanceNominationProcess: draftString(4000),
  chairIsSeniorExecutive: draftBool(),
  chairRoleDescription: draftString(4000),
  governanceImpactOversight: draftString(4000),
  impactResponsibilityDelegation: draftString(4000),
  governanceReportingRole: draftString(4000),
  conflictsOfInterestProcess: draftString(4000),
  criticalConcernsProcess: draftString(4000),
  criticalConcernsCount: draftNumber(),
  governanceCollectiveKnowledge: draftString(4000),
  governancePerformanceEvaluation: draftString(4000),
  remunerationPolicies: draftString(4000),
  remunerationProcess: draftString(4000),
  compensationRatio: draftNumber(),
  compensationRatioIncreasePct: draftNumber(),
  sustainableDevelopmentStatement: draftString(4000),
  policyCommitments: draftString(4000),
  humanRightsPolicyCommitment: draftString(4000),
  policyEmbedding: draftString(4000),
  remediationProcesses: draftString(4000),
  adviceAndConcernsMechanisms: draftString(4000),
  significantFinesCount: draftNumber(),
  significantFinesValueInr: draftNumber(),
  nonMonetarySanctionsCount: draftNumber(),
  complianceIncidentsDescription: draftString(4000),
  membershipAssociations: draftString(4000),
  stakeholderEngagementApproach: draftString(4000),
  collectiveBargainingCoveragePct: draftNumber(),
  collectiveBargainingDescription: draftString(4000),
};

// ---------------------------------------------------------------------------
// Topic Standards
// ---------------------------------------------------------------------------

const topicShapes = {
  GRI_301: {
    renewableMaterialsTonnes: nonNegative(),
    nonRenewableMaterialsTonnes: nonNegative(),
    materialsMethodology: text(),
    recycledInputPct: pct(),
    reclaimedProductsPct: pct(),
    reclaimedByCategory: text(),
  },
  GRI_302: {
    nonRenewableFuelGj: nonNegative(),
    renewableFuelGj: nonNegative(),
    electricityConsumedGj: nonNegative(),
    heatingConsumedGj: nonNegative(),
    coolingConsumedGj: nonNegative(),
    steamConsumedGj: nonNegative(),
    electricitySoldGj: nonNegative(),
    energyStandardsUsed: text(),
    energyOutsideOrgGj: nonNegative(),
    intensityDenominatorDescription: text(),
    intensityIncludesOutsideOrg: bool(),
    energyReductionGj: nonNegative(),
    energyReductionBaseYear: year(),
    energyReductionBasis: text(),
    productEnergyReductionGj: nonNegative(),
    productEnergyReductionBasis: text(),
  },
  GRI_303: {
    interactionsNarrative: text(),
    waterStressAssessmentTool: text(300),
    dischargeImpactManagement: text(),
    minimumEffluentStandards: text(),
    withdrawalTotalMl: nonNegative(),
    withdrawalWaterStressedMl: nonNegative(),
    withdrawalFreshwaterMl: nonNegative(),
    dischargeTotalMl: nonNegative(),
    dischargeWaterStressedMl: nonNegative(),
    dischargeFreshwaterMl: nonNegative(),
    prioritySubstancesOfConcern: text(),
    consumptionTotalMl: nonNegative(),
    consumptionWaterStressedMl: nonNegative(),
    // Storage can fall as well as rise, so this one is deliberately signed.
    storageChangeMl: num(),
  },
  GRI_101: {
    policiesNarrative: text(),
    mitigationHierarchy: text(),
    landRestoredHa: nonNegative(),
    accessBenefitSharing: text(),
    impactIdentificationProcess: text(),
    sitesTotalCount: count(),
    sitesInProtectedAreasCount: count(),
    sitesNearProtectedAreasCount: count(),
    siteLocationsDescription: text(),
    driverLandUseChange: text(),
    driverResourceExploitation: text(),
    driverClimateChange: text(),
    driverPollution: text(),
    driverInvasiveSpecies: text(),
    landUseChangeHa: nonNegative(),
    stateOfBiodiversityChanges: text(),
    ecosystemServicesAffected: text(),
  },
  GRI_305: {
    biogenicCo2Tonnes: nonNegative(),
    baseYear: year(),
    baseYearEmissionsTco2e: nonNegative(),
    gasesIncluded: text(500),
    consolidationApproach: text(300),
    emissionsStandardsUsed: text(),
    scope2MarketBasedTco2e: nonNegative(),
    scope3CategoriesIncluded: text(),
    intensityDenominatorDescription: text(),
    intensityGasesIncluded: text(500),
    reductionTco2e: nonNegative(),
    reductionBaseYear: year(),
    reductionScopesIncluded: text(300),
    odsCfc11EquivalentTonnes: nonNegative(),
    odsSubstancesIncluded: text(),
    noxTonnes: nonNegative(),
    soxTonnes: nonNegative(),
    vocTonnes: nonNegative(),
    particulateMatterTonnes: nonNegative(),
    persistentOrganicPollutantsTonnes: nonNegative(),
    hazardousAirPollutantsTonnes: nonNegative(),
  },
  GRI_306: {
    wasteImpactsNarrative: text(),
    wasteManagementNarrative: text(),
    thirdPartyWasteManagement: text(),
    wasteCompositionDescription: text(),
    hazardousDivertedReuseT: nonNegative(),
    hazardousDivertedRecyclingT: nonNegative(),
    hazardousDivertedOtherRecoveryT: nonNegative(),
    nonHazardousDivertedReuseT: nonNegative(),
    nonHazardousDivertedRecyclingT: nonNegative(),
    nonHazardousDivertedOtherRecoveryT: nonNegative(),
    hazardousDisposalIncinerationWithRecoveryT: nonNegative(),
    hazardousDisposalIncinerationNoRecoveryT: nonNegative(),
    hazardousDisposalLandfillT: nonNegative(),
    hazardousDisposalOtherT: nonNegative(),
    nonHazardousDisposalIncinerationWithRecoveryT: nonNegative(),
    nonHazardousDisposalIncinerationNoRecoveryT: nonNegative(),
    nonHazardousDisposalLandfillT: nonNegative(),
    nonHazardousDisposalOtherT: nonNegative(),
    onsiteOffsiteBreakdown: text(),
  },
  GRI_308: {
    newSuppliersScreenedPct: pct(),
    newSuppliersTotalCount: count(),
    screeningCriteria: text(),
    suppliersAssessedCount: count(),
    suppliersWithNegativeImpactsCount: count(),
    suppliersWithImprovementsAgreedCount: count(),
    suppliersTerminatedCount: count(),
    negativeImpactsDescription: text(),
  },
  GRI_401: {
    newHiresTotal: count(),
    newHiresFemale: count(),
    newHiresUnder30: count(),
    newHires30To50: count(),
    newHiresOver50: count(),
    turnoverTotal: count(),
    turnoverFemale: count(),
    turnoverUnder30: count(),
    turnover30To50: count(),
    turnoverOver50: count(),
    hiresTurnoverRegionalBreakdown: text(),
    benefitsDescription: text(),
    parentalLeaveEntitledMale: count(),
    parentalLeaveEntitledFemale: count(),
    parentalLeaveTookMale: count(),
    parentalLeaveTookFemale: count(),
    parentalLeaveReturnedMale: count(),
    parentalLeaveReturnedFemale: count(),
    parentalLeaveRetainedMale: count(),
    parentalLeaveRetainedFemale: count(),
  },
  GRI_403: {
    managementSystemDescription: text(),
    managementSystemIsIso45001: bool(),
    hazardIdentificationProcess: text(),
    occupationalHealthServices: text(),
    workerParticipation: text(),
    workerOhsTraining: text(),
    workerHealthPromotion: text(),
    businessRelationshipOhsImpacts: text(),
    workersCoveredCount: count(),
    workersCoveredPct: pct(),
    hoursWorked: nonNegative(),
    fatalitiesEmployees: count(),
    fatalitiesNonEmployees: count(),
    highConsequenceInjuriesEmployees: count(),
    highConsequenceInjuriesNonEmployees: count(),
    recordableInjuriesEmployees: count(),
    recordableInjuriesNonEmployees: count(),
    mainInjuryTypes: text(),
    // GRI 403-9 permits exactly these two rate bases.
    rateBasisHours: z.coerce.number().int().refine((v) => v === 200_000 || v === 1_000_000, {
      message: "Rate basis must be 200,000 or 1,000,000 hours",
    }).optional(),
    illHealthFatalitiesEmployees: count(),
    illHealthCasesEmployees: count(),
    illHealthFatalitiesNonEmployees: count(),
    illHealthCasesNonEmployees: count(),
    illHealthHazards: text(),
  },
  GRI_404: {
    avgTrainingHoursPerEmployee: nonNegative(),
    avgTrainingHoursMale: nonNegative(),
    avgTrainingHoursFemale: nonNegative(),
    avgTrainingHoursManagement: nonNegative(),
    avgTrainingHoursNonManagement: nonNegative(),
    skillsProgramsDescription: text(),
    transitionAssistanceDescription: text(),
    performanceReviewPct: pct(),
    performanceReviewMalePct: pct(),
    performanceReviewFemalePct: pct(),
  },
  GRI_405: {
    governanceBodyTotal: count(),
    governanceBodyFemale: count(),
    governanceBodyUnder30: count(),
    governanceBody30To50: count(),
    governanceBodyOver50: count(),
    employeesFemalePct: pct(),
    employeesUnder30Pct: pct(),
    employees30To50Pct: pct(),
    employeesOver50Pct: pct(),
    otherDiversityIndicators: text(),
    // A ratio, not a percentage — 1.0 is parity. Capped at 10 to catch a
    // percentage typed into a ratio field.
    salaryRatioOverall: z.coerce.number().min(0).max(10).optional(),
    salaryRatioManagement: z.coerce.number().min(0).max(10).optional(),
    salaryRatioNonManagement: z.coerce.number().min(0).max(10).optional(),
    salaryRatioBasis: text(),
  },
  GRI_406: {
    incidentsCount: count(),
    incidentsReviewedCount: count(),
    remediationPlansImplementedCount: count(),
    incidentsNoLongerSubjectToActionCount: count(),
    correctiveActionsDescription: text(),
  },
  GRI_413: {
    operationsWithEngagementPct: pct(),
    operationsWithImpactAssessmentPct: pct(),
    operationsWithDevelopmentProgramsPct: pct(),
    engagementDescription: text(),
    operationsWithNegativeImpactsCount: count(),
    negativeImpactsDescription: text(),
  },
  GRI_414: {
    newSuppliersScreenedPct: pct(),
    newSuppliersTotalCount: count(),
    screeningCriteria: text(),
    suppliersAssessedCount: count(),
    suppliersWithNegativeImpactsCount: count(),
    suppliersWithImprovementsAgreedCount: count(),
    suppliersTerminatedCount: count(),
    negativeImpactsDescription: text(),
  },
  GRI_416: {
    productCategoriesAssessedPct: pct(),
    assessmentDescription: text(),
    nonComplianceFinesCount: count(),
    nonComplianceWarningsCount: count(),
    nonComplianceVoluntaryCodesCount: count(),
    nonComplianceDescription: text(),
  },
  GRI_418: {
    complaintsFromThirdPartiesCount: count(),
    complaintsFromRegulatorsCount: count(),
    dataBreachesCount: count(),
    customersAffectedCount: count(),
    breachDescription: text(),
  },
} as const;

/**
 * Derives the permissive autosave counterpart of a strict topic shape by
 * swapping every field for its draft equivalent. Generated rather than
 * hand-written: with 16 topics and ~150 fields, two hand-maintained copies
 * would drift, and a field present in only one of them silently stops
 * autosaving or stops validating.
 */
const toDraftShape = (shape: Record<string, z.ZodTypeAny>): Record<string, z.ZodTypeAny> => {
  const draft: Record<string, z.ZodTypeAny> = {};
  for (const [key, schema] of Object.entries(shape)) {
    // Unwrap ZodOptional/ZodDefault to inspect the underlying type.
    let inner: z.ZodTypeAny = schema;
    while (inner instanceof z.ZodOptional || inner instanceof z.ZodDefault) {
      inner = inner._def.innerType;
    }
    if (inner instanceof z.ZodString) {
      const maxCheck = inner._def.checks.find((c) => c.kind === "max");
      draft[key] = draftString(maxCheck && "value" in maxCheck ? (maxCheck.value as number) : 4000);
    } else if (inner instanceof z.ZodBoolean) {
      draft[key] = draftBool();
    } else {
      draft[key] = draftNumber();
    }
  }
  return draft;
};

export type GriTopicCode = keyof typeof topicShapes;

// Indexed by plain string rather than GriTopicCode: the lookup key arrives off
// the wire, so parseTopicPayload must be able to miss and report an unknown
// topic instead of the type system pretending every key resolves.
export const griTopicSchemas: Record<string, z.ZodTypeAny> = Object.fromEntries(
  Object.entries(topicShapes).map(([code, shape]) => [code, z.object(shape)]),
);

export const griTopicDraftSchemas: Record<string, z.ZodTypeAny> = Object.fromEntries(
  Object.entries(topicShapes).map(([code, shape]) => [code, z.object(toDraftShape(shape))]),
);

// ---------------------------------------------------------------------------
// The disclosure-data endpoint payload
// ---------------------------------------------------------------------------

/**
 * One save endpoint covers the whole disclosure module — universal plus any
 * subset of topics — mirroring BRSR/ISSB's single upsert. `topics` is keyed by
 * topic code so the frontend can autosave just the section the user is in
 * without resending the entire report.
 */
export const griDataSchema = z.object({
  reportingPeriod: griReportingPeriodSchema,
  turnoverInr: nonNegative(),
  notes: text(2000),
  universal: z.object(universalShape).optional(),
  materialTopics: z.array(griMaterialTopicSchema).max(50).optional(),
  topics: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
});

export const griDataDraftSchema = z.object({
  reportingPeriod: griReportingPeriodSchema,
  turnoverInr: draftNumber(),
  notes: draftString(2000),
  universal: z.object(universalDraftShape).optional(),
  materialTopics: z.array(griMaterialTopicDraftSchema).max(50).optional(),
  topics: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
});

export type GriDataInput = z.infer<typeof griDataSchema>;

/**
 * Validates one topic's payload against its own schema. Kept separate from
 * griDataSchema because the topic map is heterogeneous — each code has a
 * different shape, and z.record can't express that.
 */
export const parseTopicPayload = (
  topicCode: string,
  payload: unknown,
  submit: boolean,
): { success: true; data: Record<string, unknown> } | { success: false; message: string } => {
  const schemas = submit ? griTopicSchemas : griTopicDraftSchemas;
  const schema = schemas[topicCode];
  if (!schema) return { success: false, message: `Unknown GRI topic "${topicCode}"` };

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      success: false,
      message: `${topicCode}${issue?.path.length ? ` (${issue.path.join(".")})` : ""}: ${issue?.message ?? "Invalid value"}`,
    };
  }
  return { success: true, data: parsed.data as Record<string, unknown> };
};

export const griOmissionReasonSchema = z.enum(GRI_OMISSION_REASONS);
