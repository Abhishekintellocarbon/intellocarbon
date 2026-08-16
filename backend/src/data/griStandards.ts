/**
 * GRI Standards 2021 registry — the single source of truth for which GRI
 * standards and disclosures this platform reports, what each one is called,
 * and which stored field backs it.
 *
 * Everything downstream reads this file rather than hardcoding topic codes:
 * materiality gating (which Topic Standard sections are active), the GRI
 * content index (a mandatory "in accordance" deliverable — see
 * griContentIndex.service.ts), report completeness, and the frontend's
 * disclosure form grouping.
 *
 * ---------------------------------------------------------------------------
 * VERSION NOTES — which edition of each standard this implements, and why.
 * These are not stylistic choices; citing a withdrawn standard in a content
 * index is a false compliance claim.
 *
 *  - GRI 2: General Disclosures 2021 — disclosures 2-1 through 2-30. Always
 *    reported; never materiality-gated.
 *  - GRI 3: Material Topics 2021 — 3-1 (process), 3-2 (list of material
 *    topics), 3-3 (management of each material topic). 3-3 is required
 *    separately FOR EACH material topic, which is why its fields live on
 *    GriMaterialTopic rather than in one place.
 *  - GRI 307: Environmental Compliance 2016 and GRI 419: Socioeconomic
 *    Compliance 2016 were WITHDRAWN with the 2021 Universal Standards. Their
 *    content moved into Disclosure 2-27 (Compliance with laws and
 *    regulations). There is deliberately no GRI 307 topic here — fines and
 *    sanctions are captured on GriUniversalDisclosures under 2-27.
 *  - GRI 101: Biodiversity 2024 REPLACES GRI 304: Biodiversity 2016, and is
 *    required for all biodiversity reporting published on or after
 *    1 January 2026. Since that date has passed, this module implements
 *    GRI 101 and does not implement GRI 304 at all.
 *  - GRI 302: Energy 2016 and GRI 305: Emissions 2016 remain in force and are
 *    what is implemented here. GRI 103: Energy 2025 and GRI 102: Climate
 *    Change 2025 replace them for reporting periods beginning on or after
 *    1 January 2027 (i.e. FY2027-28 onward under an Apr-Mar financial year).
 *    MIGRATION POINT: when the first FY2027-28 report is due, 302/305 must be
 *    superseded here rather than extended.
 * ---------------------------------------------------------------------------
 */

/** GRI's own grouping — drives section ordering in both the form and the PDF. */
export type GriSeries = "UNIVERSAL" | "ENVIRONMENTAL" | "SOCIAL";

export interface GriDisclosure {
  /** Official GRI disclosure number, e.g. "305-1". Printed verbatim in the content index. */
  number: string;
  title: string;
  /**
   * Field names on the backing model that satisfy this disclosure. A
   * disclosure counts as reported when at least one is non-null — GRI allows
   * partial reporting with a stated omission, which is what the content index
   * records. Empty means narrative-only with no dedicated column.
   */
  fields: string[];
  /**
   * True when this disclosure's value is derived from existing platform data
   * (the emissions engine, water entries, activity data) rather than typed in.
   * The content index flags these so an assurance provider can see which
   * figures were calculated and which were asserted.
   */
  derived?: boolean;
}

export interface GriTopicStandard {
  /** Stable internal key, also the value stored in GriMaterialTopic.topicCode. */
  code: string;
  /** e.g. "GRI 305" — as cited in the content index. */
  label: string;
  title: string;
  /** Edition year cited in the content index, e.g. "GRI 305: Emissions 2016". */
  edition: string;
  series: GriSeries;
  /** Prisma relation name on GriReport holding this topic's disclosure row. */
  relation: string;
  disclosures: GriDisclosure[];
}

// ---------------------------------------------------------------------------
// GRI 2: General Disclosures 2021 — all 30 disclosures, always reported.
// ---------------------------------------------------------------------------

export const GRI_UNIVERSAL_DISCLOSURES: GriDisclosure[] = [
  { number: "2-1", title: "Organizational details", fields: ["legalName", "ownershipLegalForm", "headquartersLocation", "countriesOfOperation"], derived: true },
  { number: "2-2", title: "Entities included in the organization's sustainability reporting", fields: ["entitiesIncluded"] },
  { number: "2-3", title: "Reporting period, frequency and contact point", fields: ["reportingFrequency", "contactPoint", "publicationDate"] },
  { number: "2-4", title: "Restatements of information", fields: ["restatements"] },
  { number: "2-5", title: "External assurance", fields: ["externalAssurancePolicy", "assuranceProvider", "assuranceLevel"] },
  { number: "2-6", title: "Activities, value chain and other business relationships", fields: ["sectorsServed", "valueChainDescription", "significantChangesToValueChain"] },
  { number: "2-7", title: "Employees", fields: ["employeesTotal", "employeesFemale", "employeesMale", "employeesPermanent", "employeesTemporary", "employeesFullTime", "employeesPartTime", "employeeDataMethodology"] },
  { number: "2-8", title: "Workers who are not employees", fields: ["nonEmployeeWorkersTotal", "nonEmployeeWorkersDescription"] },
  { number: "2-9", title: "Governance structure and composition", fields: ["governanceStructure", "governanceCommittees"] },
  { number: "2-10", title: "Nomination and selection of the highest governance body", fields: ["governanceNominationProcess"] },
  { number: "2-11", title: "Chair of the highest governance body", fields: ["chairIsSeniorExecutive", "chairRoleDescription"] },
  { number: "2-12", title: "Role of the highest governance body in overseeing the management of impacts", fields: ["governanceImpactOversight"] },
  { number: "2-13", title: "Delegation of responsibility for managing impacts", fields: ["impactResponsibilityDelegation"] },
  { number: "2-14", title: "Role of the highest governance body in sustainability reporting", fields: ["governanceReportingRole"] },
  { number: "2-15", title: "Conflicts of interest", fields: ["conflictsOfInterestProcess"] },
  { number: "2-16", title: "Communication of critical concerns", fields: ["criticalConcernsProcess", "criticalConcernsCount"] },
  { number: "2-17", title: "Collective knowledge of the highest governance body", fields: ["governanceCollectiveKnowledge"] },
  { number: "2-18", title: "Evaluation of the performance of the highest governance body", fields: ["governancePerformanceEvaluation"] },
  { number: "2-19", title: "Remuneration policies", fields: ["remunerationPolicies"] },
  { number: "2-20", title: "Process to determine remuneration", fields: ["remunerationProcess"] },
  { number: "2-21", title: "Annual total compensation ratio", fields: ["compensationRatio", "compensationRatioIncreasePct"] },
  { number: "2-22", title: "Statement on sustainable development strategy", fields: ["sustainableDevelopmentStatement"] },
  { number: "2-23", title: "Policy commitments", fields: ["policyCommitments", "humanRightsPolicyCommitment"] },
  { number: "2-24", title: "Embedding policy commitments", fields: ["policyEmbedding"] },
  { number: "2-25", title: "Processes to remediate negative impacts", fields: ["remediationProcesses"] },
  { number: "2-26", title: "Mechanisms for seeking advice and raising concerns", fields: ["adviceAndConcernsMechanisms"] },
  // Replaces the withdrawn GRI 307 and GRI 419 — see the version note above.
  { number: "2-27", title: "Compliance with laws and regulations", fields: ["significantFinesCount", "significantFinesValueInr", "nonMonetarySanctionsCount", "complianceIncidentsDescription"] },
  { number: "2-28", title: "Membership associations", fields: ["membershipAssociations"] },
  { number: "2-29", title: "Approach to stakeholder engagement", fields: ["stakeholderEngagementApproach"] },
  { number: "2-30", title: "Collective bargaining agreements", fields: ["collectiveBargainingCoveragePct", "collectiveBargainingDescription"] },
];

// ---------------------------------------------------------------------------
// GRI 3: Material Topics 2021.
//
// 3-1 and 3-2 are satisfied by the materiality assessment itself. 3-3 is
// required once per material topic and is stored on GriMaterialTopic, so it
// is listed here for content-index purposes but resolved per-topic.
// ---------------------------------------------------------------------------

export const GRI_MATERIAL_TOPICS_DISCLOSURES: GriDisclosure[] = [
  { number: "3-1", title: "Process to determine material topics", fields: ["impactIdentificationProcess", "prioritisationProcess", "stakeholderGroups"] },
  { number: "3-2", title: "List of material topics", fields: ["materialTopics"], derived: true },
  { number: "3-3", title: "Management of material topics", fields: ["managementApproachPerTopic"], derived: true },
];

/** The six sub-requirements of Disclosure 3-3, reported once per material topic. */
export const GRI_3_3_REQUIREMENTS: { field: string; label: string }[] = [
  { field: "impactsDescription", label: "Actual and potential impacts" },
  { field: "involvementDescription", label: "Involvement with the impacts" },
  { field: "policiesCommitments", label: "Policies and commitments" },
  { field: "actionsTaken", label: "Actions taken to manage the topic" },
  { field: "effectivenessTracking", label: "Tracking effectiveness of actions" },
  { field: "stakeholderEngagement", label: "Stakeholder engagement on the topic" },
];

// ---------------------------------------------------------------------------
// Topic Standards. Order here is the order they appear in the form and PDF.
// ---------------------------------------------------------------------------

export const GRI_TOPIC_STANDARDS: GriTopicStandard[] = [
  {
    code: "GRI_301",
    label: "GRI 301",
    title: "Materials",
    edition: "GRI 301: Materials 2016",
    series: "ENVIRONMENTAL",
    relation: "materialsDisclosure",
    disclosures: [
      { number: "301-1", title: "Materials used by weight or volume", fields: ["renewableMaterialsTonnes", "nonRenewableMaterialsTonnes"] },
      { number: "301-2", title: "Recycled input materials used", fields: ["recycledInputPct"] },
      { number: "301-3", title: "Reclaimed products and their packaging materials", fields: ["reclaimedProductsPct", "reclaimedByCategory"] },
    ],
  },
  {
    code: "GRI_302",
    label: "GRI 302",
    title: "Energy",
    edition: "GRI 302: Energy 2016",
    series: "ENVIRONMENTAL",
    relation: "energyDisclosure",
    disclosures: [
      { number: "302-1", title: "Energy consumption within the organization", fields: ["nonRenewableFuelGj", "renewableFuelGj", "electricityConsumedGj", "heatingConsumedGj", "coolingConsumedGj", "steamConsumedGj", "electricitySoldGj"], derived: true },
      { number: "302-2", title: "Energy consumption outside of the organization", fields: ["energyOutsideOrgGj"] },
      { number: "302-3", title: "Energy intensity", fields: ["intensityDenominatorDescription", "intensityIncludesOutsideOrg"], derived: true },
      { number: "302-4", title: "Reduction of energy consumption", fields: ["energyReductionGj", "energyReductionBaseYear", "energyReductionBasis"] },
      { number: "302-5", title: "Reductions in energy requirements of products and services", fields: ["productEnergyReductionGj", "productEnergyReductionBasis"] },
    ],
  },
  {
    code: "GRI_303",
    label: "GRI 303",
    title: "Water and Effluents",
    edition: "GRI 303: Water and Effluents 2018",
    series: "ENVIRONMENTAL",
    relation: "waterDisclosure",
    disclosures: [
      { number: "303-1", title: "Interactions with water as a shared resource", fields: ["interactionsNarrative", "waterStressAssessmentTool"] },
      { number: "303-2", title: "Management of water discharge-related impacts", fields: ["dischargeImpactManagement", "minimumEffluentStandards"] },
      { number: "303-3", title: "Water withdrawal", fields: ["withdrawalTotalMl", "withdrawalWaterStressedMl", "withdrawalFreshwaterMl"], derived: true },
      { number: "303-4", title: "Water discharge", fields: ["dischargeTotalMl", "dischargeWaterStressedMl", "dischargeFreshwaterMl", "prioritySubstancesOfConcern"], derived: true },
      { number: "303-5", title: "Water consumption", fields: ["consumptionTotalMl", "consumptionWaterStressedMl", "storageChangeMl"], derived: true },
    ],
  },
  {
    // GRI 101 replaced GRI 304: Biodiversity 2016 effective 1 Jan 2026.
    code: "GRI_101",
    label: "GRI 101",
    title: "Biodiversity",
    edition: "GRI 101: Biodiversity 2024",
    series: "ENVIRONMENTAL",
    relation: "biodiversityDisclosure",
    disclosures: [
      { number: "101-1", title: "Policies to halt and reverse biodiversity loss", fields: ["policiesNarrative"] },
      { number: "101-2", title: "Management of biodiversity impacts", fields: ["mitigationHierarchy", "landRestoredHa"] },
      { number: "101-3", title: "Access and benefit-sharing", fields: ["accessBenefitSharing"] },
      { number: "101-4", title: "Identification of biodiversity impacts", fields: ["impactIdentificationProcess"] },
      { number: "101-5", title: "Locations with biodiversity impacts", fields: ["sitesTotalCount", "sitesInProtectedAreasCount", "sitesNearProtectedAreasCount", "siteLocationsDescription"] },
      { number: "101-6", title: "Direct drivers of biodiversity loss", fields: ["driverLandUseChange", "driverResourceExploitation", "driverClimateChange", "driverPollution", "driverInvasiveSpecies", "landUseChangeHa"] },
      { number: "101-7", title: "Changes to the state of biodiversity", fields: ["stateOfBiodiversityChanges"] },
      { number: "101-8", title: "Ecosystem services", fields: ["ecosystemServicesAffected"] },
    ],
  },
  {
    code: "GRI_305",
    label: "GRI 305",
    title: "Emissions",
    edition: "GRI 305: Emissions 2016",
    series: "ENVIRONMENTAL",
    relation: "emissionsDisclosure",
    disclosures: [
      { number: "305-1", title: "Direct (Scope 1) GHG emissions", fields: ["biogenicCo2Tonnes", "baseYear", "gasesIncluded", "consolidationApproach"], derived: true },
      { number: "305-2", title: "Energy indirect (Scope 2) GHG emissions", fields: ["scope2MarketBasedTco2e"], derived: true },
      { number: "305-3", title: "Other indirect (Scope 3) GHG emissions", fields: ["scope3CategoriesIncluded"], derived: true },
      { number: "305-4", title: "GHG emissions intensity", fields: ["intensityDenominatorDescription", "intensityGasesIncluded"], derived: true },
      { number: "305-5", title: "Reduction of GHG emissions", fields: ["reductionTco2e", "reductionBaseYear", "reductionScopesIncluded"] },
      { number: "305-6", title: "Emissions of ozone-depleting substances (ODS)", fields: ["odsCfc11EquivalentTonnes", "odsSubstancesIncluded"] },
      { number: "305-7", title: "Nitrogen oxides (NOx), sulfur oxides (SOx), and other significant air emissions", fields: ["noxTonnes", "soxTonnes", "vocTonnes", "particulateMatterTonnes", "persistentOrganicPollutantsTonnes", "hazardousAirPollutantsTonnes"] },
    ],
  },
  {
    code: "GRI_306",
    label: "GRI 306",
    title: "Waste",
    edition: "GRI 306: Waste 2020",
    series: "ENVIRONMENTAL",
    relation: "wasteDisclosure",
    disclosures: [
      { number: "306-1", title: "Waste generation and significant waste-related impacts", fields: ["wasteImpactsNarrative"] },
      { number: "306-2", title: "Management of significant waste-related impacts", fields: ["wasteManagementNarrative", "thirdPartyWasteManagement"] },
      { number: "306-3", title: "Waste generated", fields: ["wasteCompositionDescription"], derived: true },
      {
        number: "306-4",
        title: "Waste diverted from disposal",
        fields: [
          "hazardousDivertedReuseT", "hazardousDivertedRecyclingT", "hazardousDivertedOtherRecoveryT",
          "nonHazardousDivertedReuseT", "nonHazardousDivertedRecyclingT", "nonHazardousDivertedOtherRecoveryT",
        ],
      },
      {
        number: "306-5",
        title: "Waste directed to disposal",
        fields: [
          "hazardousDisposalIncinerationWithRecoveryT", "hazardousDisposalIncinerationNoRecoveryT", "hazardousDisposalLandfillT", "hazardousDisposalOtherT",
          "nonHazardousDisposalIncinerationWithRecoveryT", "nonHazardousDisposalIncinerationNoRecoveryT", "nonHazardousDisposalLandfillT", "nonHazardousDisposalOtherT",
        ],
      },
    ],
  },
  {
    code: "GRI_308",
    label: "GRI 308",
    title: "Supplier Environmental Assessment",
    edition: "GRI 308: Supplier Environmental Assessment 2016",
    series: "ENVIRONMENTAL",
    relation: "supplierEnvDisclosure",
    disclosures: [
      { number: "308-1", title: "New suppliers that were screened using environmental criteria", fields: ["newSuppliersScreenedPct", "newSuppliersTotalCount"] },
      { number: "308-2", title: "Negative environmental impacts in the supply chain and actions taken", fields: ["suppliersAssessedCount", "suppliersWithNegativeImpactsCount", "suppliersWithImprovementsAgreedCount", "suppliersTerminatedCount", "negativeImpactsDescription"] },
    ],
  },
  {
    code: "GRI_401",
    label: "GRI 401",
    title: "Employment",
    edition: "GRI 401: Employment 2016",
    series: "SOCIAL",
    relation: "employmentDisclosure",
    disclosures: [
      { number: "401-1", title: "New employee hires and employee turnover", fields: ["newHiresTotal", "newHiresFemale", "newHiresUnder30", "newHires30To50", "newHiresOver50", "turnoverTotal", "turnoverFemale", "turnoverUnder30", "turnover30To50", "turnoverOver50"] },
      { number: "401-2", title: "Benefits provided to full-time employees that are not provided to temporary or part-time employees", fields: ["benefitsDescription"] },
      { number: "401-3", title: "Parental leave", fields: ["parentalLeaveEntitledMale", "parentalLeaveEntitledFemale", "parentalLeaveTookMale", "parentalLeaveTookFemale", "parentalLeaveReturnedMale", "parentalLeaveReturnedFemale", "parentalLeaveRetainedMale", "parentalLeaveRetainedFemale"] },
    ],
  },
  {
    code: "GRI_403",
    label: "GRI 403",
    title: "Occupational Health and Safety",
    edition: "GRI 403: Occupational Health and Safety 2018",
    series: "SOCIAL",
    relation: "ohsDisclosure",
    disclosures: [
      { number: "403-1", title: "Occupational health and safety management system", fields: ["managementSystemDescription", "managementSystemIsIso45001"] },
      { number: "403-2", title: "Hazard identification, risk assessment, and incident investigation", fields: ["hazardIdentificationProcess"] },
      { number: "403-3", title: "Occupational health services", fields: ["occupationalHealthServices"] },
      { number: "403-4", title: "Worker participation, consultation, and communication on occupational health and safety", fields: ["workerParticipation"] },
      { number: "403-5", title: "Worker training on occupational health and safety", fields: ["workerOhsTraining"] },
      { number: "403-6", title: "Promotion of worker health", fields: ["workerHealthPromotion"] },
      { number: "403-7", title: "Prevention and mitigation of occupational health and safety impacts directly linked by business relationships", fields: ["businessRelationshipOhsImpacts"] },
      { number: "403-8", title: "Workers covered by an occupational health and safety management system", fields: ["workersCoveredCount", "workersCoveredPct"] },
      { number: "403-9", title: "Work-related injuries", fields: ["hoursWorked", "fatalitiesEmployees", "fatalitiesNonEmployees", "highConsequenceInjuriesEmployees", "highConsequenceInjuriesNonEmployees", "recordableInjuriesEmployees", "recordableInjuriesNonEmployees", "mainInjuryTypes", "rateBasisHours"] },
      { number: "403-10", title: "Work-related ill health", fields: ["illHealthFatalitiesEmployees", "illHealthCasesEmployees", "illHealthFatalitiesNonEmployees", "illHealthCasesNonEmployees", "illHealthHazards"] },
    ],
  },
  {
    code: "GRI_404",
    label: "GRI 404",
    title: "Training and Education",
    edition: "GRI 404: Training and Education 2016",
    series: "SOCIAL",
    relation: "trainingDisclosure",
    disclosures: [
      { number: "404-1", title: "Average hours of training per year per employee", fields: ["avgTrainingHoursPerEmployee", "avgTrainingHoursMale", "avgTrainingHoursFemale", "avgTrainingHoursManagement", "avgTrainingHoursNonManagement"] },
      { number: "404-2", title: "Programs for upgrading employee skills and transition assistance programs", fields: ["skillsProgramsDescription", "transitionAssistanceDescription"] },
      { number: "404-3", title: "Percentage of employees receiving regular performance and career development reviews", fields: ["performanceReviewPct", "performanceReviewMalePct", "performanceReviewFemalePct"] },
    ],
  },
  {
    code: "GRI_405",
    label: "GRI 405",
    title: "Diversity and Equal Opportunity",
    edition: "GRI 405: Diversity and Equal Opportunity 2016",
    series: "SOCIAL",
    relation: "diversityDisclosure",
    disclosures: [
      { number: "405-1", title: "Diversity of governance bodies and employees", fields: ["governanceBodyTotal", "governanceBodyFemale", "governanceBodyUnder30", "governanceBody30To50", "governanceBodyOver50", "employeesFemalePct", "employeesUnder30Pct", "employees30To50Pct", "employeesOver50Pct", "otherDiversityIndicators"] },
      { number: "405-2", title: "Ratio of basic salary and remuneration of women to men", fields: ["salaryRatioOverall", "salaryRatioManagement", "salaryRatioNonManagement", "salaryRatioBasis"] },
    ],
  },
  {
    code: "GRI_406",
    label: "GRI 406",
    title: "Non-discrimination",
    edition: "GRI 406: Non-discrimination 2016",
    series: "SOCIAL",
    relation: "nonDiscriminationDisclosure",
    disclosures: [
      { number: "406-1", title: "Incidents of discrimination and corrective actions taken", fields: ["incidentsCount", "incidentsReviewedCount", "remediationPlansImplementedCount", "incidentsNoLongerSubjectToActionCount", "correctiveActionsDescription"] },
    ],
  },
  {
    code: "GRI_413",
    label: "GRI 413",
    title: "Local Communities",
    edition: "GRI 413: Local Communities 2016",
    series: "SOCIAL",
    relation: "localCommunitiesDisclosure",
    disclosures: [
      { number: "413-1", title: "Operations with local community engagement, impact assessments, and development programs", fields: ["operationsWithEngagementPct", "operationsWithImpactAssessmentPct", "operationsWithDevelopmentProgramsPct", "engagementDescription"] },
      { number: "413-2", title: "Operations with significant actual and potential negative impacts on local communities", fields: ["operationsWithNegativeImpactsCount", "negativeImpactsDescription"] },
    ],
  },
  {
    code: "GRI_414",
    label: "GRI 414",
    title: "Supplier Social Assessment",
    edition: "GRI 414: Supplier Social Assessment 2016",
    series: "SOCIAL",
    relation: "supplierSocialDisclosure",
    disclosures: [
      { number: "414-1", title: "New suppliers that were screened using social criteria", fields: ["newSuppliersScreenedPct", "newSuppliersTotalCount"] },
      { number: "414-2", title: "Negative social impacts in the supply chain and actions taken", fields: ["suppliersAssessedCount", "suppliersWithNegativeImpactsCount", "suppliersWithImprovementsAgreedCount", "suppliersTerminatedCount", "negativeImpactsDescription"] },
    ],
  },
  {
    code: "GRI_416",
    label: "GRI 416",
    title: "Customer Health and Safety",
    edition: "GRI 416: Customer Health and Safety 2016",
    series: "SOCIAL",
    relation: "customerHsDisclosure",
    disclosures: [
      { number: "416-1", title: "Assessment of the health and safety impacts of product and service categories", fields: ["productCategoriesAssessedPct", "assessmentDescription"] },
      { number: "416-2", title: "Incidents of non-compliance concerning the health and safety impacts of products and services", fields: ["nonComplianceFinesCount", "nonComplianceWarningsCount", "nonComplianceVoluntaryCodesCount", "nonComplianceDescription"] },
    ],
  },
  {
    code: "GRI_418",
    label: "GRI 418",
    title: "Customer Privacy",
    edition: "GRI 418: Customer Privacy 2016",
    series: "SOCIAL",
    relation: "customerPrivacyDisclosure",
    disclosures: [
      { number: "418-1", title: "Substantiated complaints concerning breaches of customer privacy and losses of customer data", fields: ["complaintsFromThirdPartiesCount", "complaintsFromRegulatorsCount", "dataBreachesCount", "customersAffectedCount", "breachDescription"] },
    ],
  },
];

export const GRI_TOPIC_CODES = GRI_TOPIC_STANDARDS.map((t) => t.code);

const TOPIC_BY_CODE = new Map(GRI_TOPIC_STANDARDS.map((t) => [t.code, t]));

export const getGriTopic = (code: string): GriTopicStandard | undefined => TOPIC_BY_CODE.get(code);

export const isGriTopicCode = (code: string): boolean => TOPIC_BY_CODE.has(code);

/**
 * Total count of Topic Standard disclosures across every topic — used to size
 * the content index and to sanity-check that a "complete" report actually
 * walked the full standard rather than a subset.
 */
export const GRI_TOTAL_TOPIC_DISCLOSURE_COUNT = GRI_TOPIC_STANDARDS.reduce(
  (sum, t) => sum + t.disclosures.length,
  0,
);

// ---------------------------------------------------------------------------
// Omission reasons — GRI 1 permits exactly four, and only these four. A
// content index carrying any other reason fails the "in accordance" test, so
// this list is closed by design.
// ---------------------------------------------------------------------------

export const GRI_OMISSION_REASONS = [
  "NOT_APPLICABLE",
  "CONFIDENTIALITY_CONSTRAINTS",
  "LEGAL_PROHIBITIONS",
  "INFORMATION_UNAVAILABLE_INCOMPLETE",
] as const;

export type GriOmissionReason = (typeof GRI_OMISSION_REASONS)[number];

export const GRI_OMISSION_REASON_LABELS: Record<GriOmissionReason, string> = {
  NOT_APPLICABLE: "Not applicable",
  CONFIDENTIALITY_CONSTRAINTS: "Confidentiality constraints",
  LEGAL_PROHIBITIONS: "Legal prohibitions",
  INFORMATION_UNAVAILABLE_INCOMPLETE: "Information unavailable/incomplete",
};

/**
 * GRI 1 offers two claims. "In accordance" requires all nine reporting
 * requirements to be met — including every GRI 2 disclosure and a 3-3 for
 * every material topic. "With reference" is the weaker claim available when
 * they are not.
 */
export type GriClaimLevel = "IN_ACCORDANCE" | "WITH_REFERENCE";

export const GRI_CLAIM_STATEMENTS: Record<GriClaimLevel, string> = {
  IN_ACCORDANCE:
    "This facility has reported in accordance with the GRI Standards for the reporting period stated in this report.",
  WITH_REFERENCE:
    "This facility has reported the information cited in this GRI content index with reference to the GRI Standards for the reporting period stated in this report.",
};
