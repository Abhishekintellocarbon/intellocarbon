/**
 * ESRS registry — the single source of truth for which European Sustainability
 * Reporting Standards this platform reports, and which datapoints sit under
 * each. Everything downstream reads this file rather than hardcoding standard
 * codes: double-materiality gating, the ESRS disclosure index, completeness
 * scoring, and the frontend's form grouping. Same role griStandards.ts plays
 * for GRI.
 *
 * ===========================================================================
 * VERSION AND PROVENANCE — read before adding or trusting a datapoint.
 *
 * The European Commission adopted the delegated act for the REVISED standards
 * ("ESRS (2026)") on 3 July 2026. It removes roughly 70% of the datapoints in
 * the original 2023 set — a 61% cut in mandatory datapoints, with every
 * voluntary datapoint dropped — and applies to financial years beginning on or
 * after 1 January 2027. Since CSRD's mandatory scope under Omnibus I starts at
 * FY2027, ESRS (2026) is the ONLY version any report produced here will ever
 * be filed under. The 2023 set is of historical interest only.
 *
 * The 12-standard structure survives the revision: ESRS 1 (general
 * requirements), ESRS 2 (general disclosures), E1-E5, S1-S4, G1. Double
 * materiality survives and remains the gate on all ten topical standards.
 * Those facts are verified and are what this registry is built on.
 *
 * What is NOT yet verified is the datapoint content. At the time of writing,
 * EFRAG had not published either the updated datapoint list or the XBRL
 * taxonomy for the revised standards. Every datapoint below therefore carries
 * an explicit `status`:
 *
 *   CONFIRMED      - reconciled against the adopted ESRS (2026) delegated act.
 *   PENDING_SOURCE - disclosure-requirement shape carried forward from the
 *                    2023 standards, NOT yet reconciled with ESRS (2026).
 *
 * Nothing here is CONFIRMED yet. The module treats that as a first-class
 * state rather than a caveat in a comment: a report containing any
 * PENDING_SOURCE datapoint cannot claim ESRS conformity, the disclosure index
 * prints the reconciliation status, and the UI says so. See
 * csrdDisclosureIndex.service.ts.
 *
 * TO POPULATE: work through the delegated act annex one standard at a time,
 * replacing each datapoint's `status` with CONFIRMED and correcting code,
 * label and unit against the official text. Do not flip a status without
 * having read the source — the whole point of the flag is that it is only
 * ever set by someone who checked.
 * ===========================================================================
 */

export type EsrsPillar = "CROSS_CUTTING" | "ENVIRONMENT" | "SOCIAL" | "GOVERNANCE";

/**
 * Whether a datapoint's definition has been reconciled with the adopted
 * ESRS (2026) delegated act, or is still carried from the 2023 set.
 */
export type EsrsDatapointStatus = "CONFIRMED" | "PENDING_SOURCE";

/** How a datapoint's value is captured, which also decides how the form renders it. */
export type EsrsDatapointType = "narrative" | "number" | "int" | "pct" | "year" | "bool" | "currency";

export interface EsrsDatapoint {
  /** Official ESRS datapoint / disclosure-requirement reference, e.g. "E1-6". */
  code: string;
  label: string;
  type: EsrsDatapointType;
  /** Stored column on the standard's disclosure table. */
  field: string;
  status: EsrsDatapointStatus;
  /** Unit as ESRS states it, where the standard fixes one. */
  unit?: string;
  hint?: string;
  /**
   * True where the value is derived from data already on the platform (the
   * emissions engine, the ISO 14046 water inventory, activity data) rather
   * than typed in. The disclosure index flags these so an assurance provider
   * can see which figures were calculated and which were asserted.
   */
  derived?: boolean;
  /**
   * ESRS carries transitional reliefs letting some undertakings omit certain
   * datapoints for the first year or two. Where one applies, it is named here
   * and printed in the disclosure index — an omission a reader can check
   * against the standard is very different from a blank.
   */
  phaseIn?: string;
}

export interface EsrsStandard {
  /** Stable internal key, also the value stored in CsrdMaterialTopic.standardCode. */
  code: string;
  /** e.g. "ESRS E1" — as cited in the disclosure index. */
  label: string;
  title: string;
  pillar: EsrsPillar;
  /**
   * ESRS 2 is reported by every undertaking regardless of materiality; the ten
   * topical standards are reported only where the double materiality
   * assessment says so. This flag is what the gating reads.
   */
  alwaysRequired: boolean;
  /** Prisma relation on CsrdReport holding this standard's disclosure row. */
  relation: string;
  /** One line the materiality tool shows so a user can judge relevance. */
  blurb: string;
  datapoints: EsrsDatapoint[];
}

/** Shorthand — every datapoint seeded in this pass is PENDING_SOURCE by construction. */
const dp = (
  code: string,
  label: string,
  type: EsrsDatapointType,
  field: string,
  extra: Partial<Omit<EsrsDatapoint, "code" | "label" | "type" | "field" | "status">> = {},
): EsrsDatapoint => ({ code, label, type, field, status: "PENDING_SOURCE", ...extra });

// ---------------------------------------------------------------------------
// ESRS 2 — General disclosures. Reported by every undertaking, never gated.
//
// Structure below follows the 2023 standard's disclosure requirements (BP, GOV,
// SBM, IRO and the minimum disclosure requirements on policies, actions,
// targets and metrics). ESRS (2026) simplifies these; the shape is a starting
// point for reconciliation, not a claim about the revised text.
// ---------------------------------------------------------------------------

export const ESRS_2_DATAPOINTS: EsrsDatapoint[] = [
  dp("BP-1", "General basis for preparation of the sustainability statement", "narrative", "basisOfPreparation"),
  dp("BP-2", "Disclosures in relation to specific circumstances", "narrative", "specificCircumstances"),

  dp("GOV-1", "Role of the administrative, management and supervisory bodies", "narrative", "governanceBodiesRole"),
  dp("GOV-1b", "Number of executive members of the governance body", "int", "governanceExecutiveMembers"),
  dp("GOV-1c", "Number of non-executive members of the governance body", "int", "governanceNonExecutiveMembers"),
  dp("GOV-1d", "Percentage of independent members", "pct", "governanceIndependentPct", { unit: "%" }),
  dp("GOV-1e", "Gender diversity of the governance body", "pct", "governanceGenderDiversityPct", { unit: "%" }),
  dp("GOV-2", "Information provided to and sustainability matters addressed by the governance bodies", "narrative", "governanceInformationFlow"),
  dp("GOV-3", "Integration of sustainability-related performance in incentive schemes", "narrative", "incentiveSchemes"),
  dp("GOV-4", "Statement on due diligence", "narrative", "dueDiligenceStatement"),
  dp("GOV-5", "Risk management and internal controls over sustainability reporting", "narrative", "riskManagementControls"),

  dp("SBM-1", "Strategy, business model and value chain", "narrative", "strategyBusinessModel"),
  dp("SBM-2", "Interests and views of stakeholders", "narrative", "stakeholderInterests"),
  dp("SBM-3", "Material impacts, risks and opportunities and their interaction with strategy", "narrative", "materialIroInteraction"),

  dp("IRO-1", "Process to identify and assess material impacts, risks and opportunities", "narrative", "iroIdentificationProcess"),
  dp("IRO-2", "Disclosure requirements covered by the sustainability statement", "narrative", "disclosureRequirementsCovered", {
    derived: true,
    hint: "Generated from the disclosure index rather than entered.",
  }),

  dp("MDR-P", "Policies adopted to manage material sustainability matters", "narrative", "minimumPolicies"),
  dp("MDR-A", "Actions and resources in relation to material sustainability matters", "narrative", "minimumActions"),
  dp("MDR-T", "Targets set to manage material sustainability matters", "narrative", "minimumTargets"),
  dp("MDR-M", "Metrics used to manage material sustainability matters", "narrative", "minimumMetrics"),
];

// ---------------------------------------------------------------------------
// Topical standards — gated by the double materiality assessment.
// ---------------------------------------------------------------------------

export const ESRS_STANDARDS: EsrsStandard[] = [
  {
    code: "ESRS_E1",
    label: "ESRS E1",
    title: "Climate change",
    pillar: "ENVIRONMENT",
    alwaysRequired: false,
    relation: "climateDisclosure",
    blurb: "Transition plan, physical and transition risk, energy consumption, GHG emissions across all three scopes, removals and carbon pricing.",
    datapoints: [
      dp("E1-1", "Transition plan for climate change mitigation", "narrative", "transitionPlan"),
      dp("E1-2", "Policies related to climate change mitigation and adaptation", "narrative", "climatePolicies"),
      dp("E1-3", "Actions and resources in relation to climate change policies", "narrative", "climateActions"),
      dp("E1-4", "Targets related to climate change mitigation and adaptation", "narrative", "climateTargets"),
      dp("E1-4a", "Base year for GHG reduction targets", "year", "targetBaseYear"),
      dp("E1-4b", "Absolute GHG reduction target", "pct", "targetReductionPct", { unit: "%" }),
      dp("E1-4c", "Target year", "year", "targetYear"),
      dp("E1-5", "Total energy consumption", "number", "totalEnergyConsumptionMwh", {
        unit: "MWh",
        derived: true,
        hint: "Electricity and imported steam reused from activity data; fuel energy entered manually.",
      }),
      dp("E1-5a", "Energy consumption from fossil sources", "number", "energyFossilMwh", { unit: "MWh" }),
      dp("E1-5b", "Energy consumption from nuclear sources", "number", "energyNuclearMwh", { unit: "MWh" }),
      dp("E1-5c", "Energy consumption from renewable sources", "number", "energyRenewableMwh", { unit: "MWh", derived: true }),
      dp("E1-5d", "Energy intensity per net revenue", "number", "energyIntensityPerRevenue", { unit: "MWh/EUR", derived: true }),
      dp("E1-6", "Gross Scope 1 GHG emissions", "number", "scope1Tco2e", { unit: "tCO2e", derived: true }),
      dp("E1-6a", "Gross location-based Scope 2 GHG emissions", "number", "scope2LocationTco2e", { unit: "tCO2e", derived: true }),
      dp("E1-6b", "Gross market-based Scope 2 GHG emissions", "number", "scope2MarketTco2e", { unit: "tCO2e" }),
      dp("E1-6c", "Gross Scope 3 GHG emissions", "number", "scope3Tco2e", { unit: "tCO2e", derived: true }),
      dp("E1-6d", "Total GHG emissions", "number", "totalGhgTco2e", { unit: "tCO2e", derived: true }),
      dp("E1-6e", "GHG intensity per net revenue", "number", "ghgIntensityPerRevenue", { unit: "tCO2e/EUR", derived: true }),
      dp("E1-6f", "Biogenic CO2 emissions", "number", "biogenicCo2Tonnes", { unit: "t CO2" }),
      dp("E1-7", "GHG removals and carbon credits", "narrative", "removalsAndCredits"),
      dp("E1-7a", "GHG removals in own operations", "number", "removalsOwnOperationsTco2e", { unit: "tCO2e" }),
      dp("E1-7b", "Carbon credits cancelled in the reporting year", "number", "carbonCreditsCancelledTco2e", { unit: "tCO2e", derived: true }),
      dp("E1-8", "Internal carbon pricing", "narrative", "internalCarbonPricing"),
      dp("E1-8a", "Internal carbon price applied", "currency", "internalCarbonPricePerTonne", { unit: "EUR/tCO2e" }),
      dp("E1-9", "Anticipated financial effects from physical and transition risks", "narrative", "anticipatedFinancialEffects", {
        phaseIn: "Transitional relief available for the first reporting year under ESRS 1 Appendix C.",
      }),
      dp("E1-9a", "Assets at material physical risk", "pct", "assetsAtPhysicalRiskPct", {
        unit: "%",
        phaseIn: "Transitional relief available for the first reporting year under ESRS 1 Appendix C.",
      }),
    ],
  },
  {
    code: "ESRS_E2",
    label: "ESRS E2",
    title: "Pollution",
    pillar: "ENVIRONMENT",
    alwaysRequired: false,
    relation: "pollutionDisclosure",
    blurb: "Pollution of air, water and soil, substances of concern, and microplastics.",
    datapoints: [
      dp("E2-1", "Policies related to pollution", "narrative", "pollutionPolicies"),
      dp("E2-2", "Actions and resources related to pollution", "narrative", "pollutionActions"),
      dp("E2-3", "Targets related to pollution", "narrative", "pollutionTargets"),
      dp("E2-4", "Pollution of air, water and soil", "narrative", "pollutionNarrative"),
      dp("E2-4a", "Emissions to air of pollutants", "number", "airPollutantsTonnes", { unit: "t" }),
      dp("E2-4b", "Emissions to water of pollutants", "number", "waterPollutantsTonnes", { unit: "t" }),
      dp("E2-4c", "Emissions to soil of pollutants", "number", "soilPollutantsTonnes", { unit: "t" }),
      dp("E2-5", "Substances of concern and substances of very high concern", "narrative", "substancesOfConcern"),
      dp("E2-5a", "Total substances of very high concern generated or used", "number", "svhcTonnes", { unit: "t" }),
      dp("E2-6", "Anticipated financial effects from pollution-related impacts, risks and opportunities", "narrative", "pollutionFinancialEffects", {
        phaseIn: "Transitional relief available for the first reporting year under ESRS 1 Appendix C.",
      }),
    ],
  },
  {
    code: "ESRS_E3",
    label: "ESRS E3",
    title: "Water and marine resources",
    pillar: "ENVIRONMENT",
    alwaysRequired: false,
    relation: "waterDisclosure",
    blurb: "Water consumption, withdrawal and discharge, water in areas of water stress, and marine resources.",
    datapoints: [
      dp("E3-1", "Policies related to water and marine resources", "narrative", "waterPolicies"),
      dp("E3-2", "Actions and resources related to water and marine resources", "narrative", "waterActions"),
      dp("E3-3", "Targets related to water and marine resources", "narrative", "waterTargets"),
      dp("E3-4", "Water consumption", "number", "waterConsumptionM3", { unit: "m3", derived: true }),
      dp("E3-4a", "Total water withdrawal", "number", "waterWithdrawalM3", { unit: "m3", derived: true }),
      dp("E3-4b", "Total water discharge", "number", "waterDischargeM3", { unit: "m3", derived: true }),
      dp("E3-4c", "Water consumption in areas of water stress", "number", "waterConsumptionStressM3", { unit: "m3" }),
      dp("E3-4d", "Water recycled and reused", "number", "waterRecycledM3", { unit: "m3", derived: true }),
      dp("E3-4e", "Water intensity per net revenue", "number", "waterIntensityPerRevenue", { unit: "m3/EUR", derived: true }),
      dp("E3-5", "Anticipated financial effects from water and marine resources-related risks", "narrative", "waterFinancialEffects", {
        phaseIn: "Transitional relief available for the first reporting year under ESRS 1 Appendix C.",
      }),
    ],
  },
  {
    code: "ESRS_E4",
    label: "ESRS E4",
    title: "Biodiversity and ecosystems",
    pillar: "ENVIRONMENT",
    alwaysRequired: false,
    relation: "biodiversityDisclosure",
    blurb: "Impacts on biodiversity and ecosystems, transition plan alignment, and land-use change.",
    datapoints: [
      dp("E4-1", "Transition plan and consideration of biodiversity and ecosystems in strategy", "narrative", "biodiversityTransitionPlan"),
      dp("E4-2", "Policies related to biodiversity and ecosystems", "narrative", "biodiversityPolicies"),
      dp("E4-3", "Actions and resources related to biodiversity and ecosystems", "narrative", "biodiversityActions"),
      dp("E4-4", "Targets related to biodiversity and ecosystems", "narrative", "biodiversityTargets"),
      dp("E4-5", "Impact metrics related to biodiversity and ecosystems change", "narrative", "biodiversityImpactMetrics"),
      dp("E4-5a", "Number of sites near biodiversity-sensitive areas", "int", "sitesNearSensitiveAreas"),
      dp("E4-5b", "Land use change", "number", "landUseChangeHa", { unit: "ha" }),
      dp("E4-5c", "Land area restored", "number", "landRestoredHa", { unit: "ha" }),
      dp("E4-6", "Anticipated financial effects from biodiversity-related impacts, risks and opportunities", "narrative", "biodiversityFinancialEffects", {
        phaseIn: "Transitional relief available for the first reporting year under ESRS 1 Appendix C.",
      }),
    ],
  },
  {
    code: "ESRS_E5",
    label: "ESRS E5",
    title: "Resource use and circular economy",
    pillar: "ENVIRONMENT",
    alwaysRequired: false,
    relation: "circularDisclosure",
    blurb: "Resource inflows and outflows, waste, and circular economy practices.",
    datapoints: [
      dp("E5-1", "Policies related to resource use and circular economy", "narrative", "circularPolicies"),
      dp("E5-2", "Actions and resources related to resource use and circular economy", "narrative", "circularActions"),
      dp("E5-3", "Targets related to resource use and circular economy", "narrative", "circularTargets"),
      dp("E5-4", "Resource inflows", "narrative", "resourceInflows"),
      dp("E5-4a", "Total weight of materials used", "number", "materialsUsedTonnes", { unit: "t" }),
      dp("E5-4b", "Share of secondary reused or recycled materials", "pct", "secondaryMaterialsPct", { unit: "%" }),
      dp("E5-5", "Resource outflows", "narrative", "resourceOutflows"),
      dp("E5-5a", "Total waste generated", "number", "wasteGeneratedTonnes", { unit: "t", derived: true }),
      dp("E5-5b", "Waste diverted from disposal", "number", "wasteDivertedTonnes", { unit: "t", derived: true }),
      dp("E5-5c", "Waste directed to disposal", "number", "wasteDisposalTonnes", { unit: "t", derived: true }),
      dp("E5-5d", "Hazardous waste", "number", "hazardousWasteTonnes", { unit: "t", derived: true }),
      dp("E5-5e", "Non-recycled waste", "number", "nonRecycledWasteTonnes", { unit: "t" }),
      dp("E5-6", "Anticipated financial effects from resource use and circular economy risks", "narrative", "circularFinancialEffects", {
        phaseIn: "Transitional relief available for the first reporting year under ESRS 1 Appendix C.",
      }),
    ],
  },
  {
    code: "ESRS_S1",
    label: "ESRS S1",
    title: "Own workforce",
    pillar: "SOCIAL",
    alwaysRequired: false,
    relation: "ownWorkforceDisclosure",
    blurb: "Working conditions, equal treatment and opportunities, and other work-related rights for the undertaking's own workforce.",
    datapoints: [
      dp("S1-1", "Policies related to own workforce", "narrative", "workforcePolicies"),
      dp("S1-2", "Processes for engaging with own workers about impacts", "narrative", "workerEngagement"),
      dp("S1-3", "Processes to remediate negative impacts and channels to raise concerns", "narrative", "workerRemediation"),
      dp("S1-4", "Taking action on material impacts on own workforce", "narrative", "workforceActions"),
      dp("S1-5", "Targets related to managing material impacts on own workforce", "narrative", "workforceTargets"),
      dp("S1-6", "Characteristics of the undertaking's employees", "int", "employeesTotal"),
      dp("S1-6a", "Number of employees by gender — female", "int", "employeesFemale"),
      dp("S1-6b", "Number of employees by gender — male", "int", "employeesMale"),
      dp("S1-6c", "Employee turnover rate", "pct", "employeeTurnoverPct", { unit: "%" }),
      dp("S1-7", "Characteristics of non-employee workers in own workforce", "int", "nonEmployeeWorkers"),
      dp("S1-8", "Collective bargaining coverage and social dialogue", "pct", "collectiveBargainingPct", { unit: "%" }),
      dp("S1-9", "Diversity metrics", "pct", "genderDiversityTopManagementPct", { unit: "%" }),
      dp("S1-10", "Adequate wages", "bool", "adequateWagesAllEmployees"),
      dp("S1-11", "Social protection", "narrative", "socialProtection"),
      dp("S1-12", "Persons with disabilities", "pct", "employeesWithDisabilitiesPct", { unit: "%" }),
      dp("S1-13", "Training and skills development metrics", "number", "avgTrainingHours", { unit: "hours" }),
      dp("S1-14", "Health and safety metrics", "narrative", "healthSafetyNarrative"),
      dp("S1-14a", "Percentage of own workers covered by a health and safety management system", "pct", "healthSafetyCoveragePct", { unit: "%" }),
      dp("S1-14b", "Number of fatalities from work-related injuries and ill health", "int", "fatalities"),
      dp("S1-14c", "Number of recordable work-related accidents", "int", "recordableAccidents"),
      dp("S1-14d", "Rate of recordable work-related accidents", "number", "recordableAccidentRate"),
      dp("S1-15", "Work-life balance metrics", "pct", "familyLeaveEntitledPct", { unit: "%" }),
      dp("S1-16", "Remuneration metrics — gender pay gap", "pct", "genderPayGapPct", { unit: "%" }),
      dp("S1-16a", "Annual total remuneration ratio", "number", "remunerationRatio"),
      dp("S1-17", "Incidents, complaints and severe human rights impacts", "int", "humanRightsIncidents"),
    ],
  },
  {
    code: "ESRS_S2",
    label: "ESRS S2",
    title: "Workers in the value chain",
    pillar: "SOCIAL",
    alwaysRequired: false,
    relation: "valueChainWorkersDisclosure",
    blurb: "Impacts on workers in the upstream and downstream value chain, and how they are managed.",
    datapoints: [
      dp("S2-1", "Policies related to value chain workers", "narrative", "valueChainWorkerPolicies"),
      dp("S2-2", "Processes for engaging with value chain workers about impacts", "narrative", "valueChainWorkerEngagement"),
      dp("S2-3", "Processes to remediate negative impacts and channels to raise concerns", "narrative", "valueChainWorkerRemediation"),
      dp("S2-4", "Taking action on material impacts on value chain workers", "narrative", "valueChainWorkerActions"),
      dp("S2-5", "Targets related to managing material impacts on value chain workers", "narrative", "valueChainWorkerTargets"),
      dp("S2-5a", "Suppliers assessed for social criteria", "int", "suppliersAssessed"),
      dp("S2-5b", "Suppliers with identified negative impacts", "int", "suppliersWithNegativeImpacts"),
    ],
  },
  {
    code: "ESRS_S3",
    label: "ESRS S3",
    title: "Affected communities",
    pillar: "SOCIAL",
    alwaysRequired: false,
    relation: "communitiesDisclosure",
    blurb: "Impacts on communities affected by the undertaking's operations and value chain, including indigenous peoples.",
    datapoints: [
      dp("S3-1", "Policies related to affected communities", "narrative", "communityPolicies"),
      dp("S3-2", "Processes for engaging with affected communities about impacts", "narrative", "communityEngagement"),
      dp("S3-3", "Processes to remediate negative impacts and channels to raise concerns", "narrative", "communityRemediation"),
      dp("S3-4", "Taking action on material impacts on affected communities", "narrative", "communityActions"),
      dp("S3-5", "Targets related to managing material impacts on affected communities", "narrative", "communityTargets"),
      dp("S3-5a", "Operations with community engagement or impact assessments", "pct", "operationsWithEngagementPct", { unit: "%" }),
    ],
  },
  {
    code: "ESRS_S4",
    label: "ESRS S4",
    title: "Consumers and end-users",
    pillar: "SOCIAL",
    alwaysRequired: false,
    relation: "consumersDisclosure",
    blurb: "Impacts on consumers and end-users, including product safety, privacy and access to information.",
    datapoints: [
      dp("S4-1", "Policies related to consumers and end-users", "narrative", "consumerPolicies"),
      dp("S4-2", "Processes for engaging with consumers and end-users about impacts", "narrative", "consumerEngagement"),
      dp("S4-3", "Processes to remediate negative impacts and channels to raise concerns", "narrative", "consumerRemediation"),
      dp("S4-4", "Taking action on material impacts on consumers and end-users", "narrative", "consumerActions"),
      dp("S4-5", "Targets related to managing material impacts on consumers and end-users", "narrative", "consumerTargets"),
      dp("S4-5a", "Substantiated complaints concerning product safety or data privacy", "int", "consumerComplaints"),
    ],
  },
  {
    code: "ESRS_G1",
    label: "ESRS G1",
    title: "Business conduct",
    pillar: "GOVERNANCE",
    alwaysRequired: false,
    relation: "businessConductDisclosure",
    blurb: "Corporate culture, protection of whistleblowers, anti-corruption, political engagement and payment practices.",
    datapoints: [
      dp("G1-1", "Business conduct policies and corporate culture", "narrative", "conductPolicies"),
      dp("G1-2", "Management of relationships with suppliers", "narrative", "supplierRelationships"),
      dp("G1-3", "Prevention and detection of corruption and bribery", "narrative", "corruptionPrevention"),
      dp("G1-3a", "Percentage of functions at risk covered by anti-corruption training", "pct", "antiCorruptionTrainingPct", { unit: "%" }),
      dp("G1-4", "Confirmed incidents of corruption or bribery", "int", "corruptionIncidents"),
      dp("G1-4a", "Fines for violation of anti-corruption and anti-bribery laws", "currency", "corruptionFinesEur", { unit: "EUR" }),
      dp("G1-5", "Political influence and lobbying activities", "narrative", "politicalInfluence"),
      dp("G1-5a", "Total monetary value of political contributions", "currency", "politicalContributionsEur", { unit: "EUR" }),
      dp("G1-6", "Payment practices", "narrative", "paymentPractices"),
      dp("G1-6a", "Average time to pay invoices", "int", "averageDaysToPay", { unit: "days" }),
    ],
  },
];

export const ESRS_STANDARD_CODES = ESRS_STANDARDS.map((s) => s.code);

const STANDARD_BY_CODE = new Map(ESRS_STANDARDS.map((s) => [s.code, s]));

export const getEsrsStandard = (code: string): EsrsStandard | undefined => STANDARD_BY_CODE.get(code);

export const isEsrsStandardCode = (code: string): boolean => STANDARD_BY_CODE.has(code);

/** Every topical datapoint across every standard, plus ESRS 2's. */
export const ESRS_TOTAL_DATAPOINT_COUNT =
  ESRS_2_DATAPOINTS.length + ESRS_STANDARDS.reduce((sum, s) => sum + s.datapoints.length, 0);

/**
 * How many datapoints have actually been reconciled against the adopted
 * ESRS (2026) delegated act. Surfaced in the UI and the disclosure index —
 * while this is below the total, no report may claim ESRS conformity.
 */
export const ESRS_CONFIRMED_DATAPOINT_COUNT =
  ESRS_2_DATAPOINTS.filter((d) => d.status === "CONFIRMED").length +
  ESRS_STANDARDS.reduce((sum, s) => sum + s.datapoints.filter((d) => d.status === "CONFIRMED").length, 0);

/** True once every datapoint in the registry has been checked against the official text. */
export const ESRS_REGISTRY_RECONCILED = ESRS_CONFIRMED_DATAPOINT_COUNT === ESRS_TOTAL_DATAPOINT_COUNT;

// ---------------------------------------------------------------------------
// Applicability — Omnibus I (Directive (EU) 2026/470)
//
// Verified: adopted by the Council 24 February 2026, published in the Official
// Journal 26 February 2026, in force 18 March 2026. Scope narrowed to
// undertakings with more than 1,000 employees AND more than EUR 450 million
// net turnover, cutting the population by roughly 80% and removing listed
// SMEs. Wave 2 undertakings first report for FY2027, published in 2028.
//
// This is stated on the product surfaces because most Intellocarbon customers
// — Indian MSME exporters — fall well below it and must not be led to believe
// they are mandatorily in scope.
// ---------------------------------------------------------------------------

export const CSRD_EMPLOYEE_THRESHOLD = 1_000;
export const CSRD_TURNOVER_THRESHOLD_EUR = 450_000_000;
export const CSRD_FIRST_MANDATORY_FY = "FY2027-28";

export const CSRD_APPLICABILITY_NOTICE =
  "Under the Omnibus I Directive (EU) 2026/470, in force 18 March 2026, CSRD reporting is mandatory only for " +
  "undertakings with more than 1,000 employees and more than EUR 450 million in net turnover, first reporting for " +
  "financial years beginning in 2027. Most undertakings below those thresholds are outside mandatory scope and may " +
  "use this report voluntarily — for example to answer a customer's value-chain request — but should not treat it " +
  "as evidence of a filing obligation.";

/**
 * The conformity claim. Deliberately narrower than GRI's "in accordance"
 * equivalent: until the registry is reconciled with the adopted ESRS (2026)
 * text, no report from this module may describe itself as ESRS-conformant,
 * however complete the customer's data entry is.
 */
export type CsrdClaimLevel = "ESRS_CONFORMANT" | "PREPARED_WITH_REFERENCE";

export const CSRD_CLAIM_STATEMENTS: Record<CsrdClaimLevel, string> = {
  ESRS_CONFORMANT:
    "This sustainability statement has been prepared in accordance with the European Sustainability Reporting " +
    "Standards (ESRS (2026)) for the reporting period stated in this report.",
  PREPARED_WITH_REFERENCE:
    "This report has been prepared with reference to the European Sustainability Reporting Standards. It is not a " +
    "conformant ESRS sustainability statement and must not be filed as one.",
};

/** GRI permits exactly four omission reasons; ESRS's transitional reliefs are named per datapoint instead. */
export const CSRD_OMISSION_REASONS = [
  "NOT_MATERIAL",
  "PHASE_IN_RELIEF",
  "DATA_UNAVAILABLE",
  "CONFIDENTIALITY",
] as const;

export type CsrdOmissionReason = (typeof CSRD_OMISSION_REASONS)[number];

export const CSRD_OMISSION_REASON_LABELS: Record<CsrdOmissionReason, string> = {
  NOT_MATERIAL: "Not material",
  PHASE_IN_RELIEF: "Phase-in relief applied",
  DATA_UNAVAILABLE: "Data unavailable",
  CONFIDENTIALITY: "Confidentiality constraints",
};
