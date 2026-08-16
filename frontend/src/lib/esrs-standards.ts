/**
 * ESRS registry — frontend mirror.
 *
 * GENERATED from backend/src/data/esrsStandards.ts. Do not edit by hand: with
 * eleven standards and ~180 datapoints, a hand-maintained copy would drift
 * from the backend's definitions, and a datapoint present in only one of them
 * either fails to render or fails to save. Regenerate after changing the
 * backend registry.
 *
 * It carries only what the UI needs — codes, labels, types, units and the
 * reconciliation status. The disclosure index and the conformity gate stay
 * server-side, where the compliance claim is evaluated.
 */

export type EsrsPillar = "ENVIRONMENT" | "SOCIAL" | "GOVERNANCE";
export type EsrsDatapointStatus = "CONFIRMED" | "PENDING_SOURCE";
export type EsrsDatapointType = "narrative" | "int" | "pct" | "year" | "number" | "currency" | "bool";

export interface EsrsDatapoint {
  code: string;
  label: string;
  type: EsrsDatapointType;
  field: string;
  status: EsrsDatapointStatus;
  unit?: string;
  hint?: string;
  derived?: boolean;
  phaseIn?: string;
}

export interface EsrsStandardMeta {
  code: string;
  label: string;
  title: string;
  pillar: EsrsPillar;
  relation: string;
  blurb: string;
  datapoints: EsrsDatapoint[];
}

export const ESRS_2_DATAPOINTS: EsrsDatapoint[] = [
  { code: "BP-1", label: "General basis for preparation of the sustainability statement", type: "narrative", field: "basisOfPreparation", status: "PENDING_SOURCE" },
  { code: "BP-2", label: "Disclosures in relation to specific circumstances", type: "narrative", field: "specificCircumstances", status: "PENDING_SOURCE" },
  { code: "GOV-1", label: "Role of the administrative, management and supervisory bodies", type: "narrative", field: "governanceBodiesRole", status: "PENDING_SOURCE" },
  { code: "GOV-1b", label: "Number of executive members of the governance body", type: "int", field: "governanceExecutiveMembers", status: "PENDING_SOURCE" },
  { code: "GOV-1c", label: "Number of non-executive members of the governance body", type: "int", field: "governanceNonExecutiveMembers", status: "PENDING_SOURCE" },
  { code: "GOV-1d", label: "Percentage of independent members", type: "pct", field: "governanceIndependentPct", status: "PENDING_SOURCE", unit: "%" },
  { code: "GOV-1e", label: "Gender diversity of the governance body", type: "pct", field: "governanceGenderDiversityPct", status: "PENDING_SOURCE", unit: "%" },
  { code: "GOV-2", label: "Information provided to and sustainability matters addressed by the governance bodies", type: "narrative", field: "governanceInformationFlow", status: "PENDING_SOURCE" },
  { code: "GOV-3", label: "Integration of sustainability-related performance in incentive schemes", type: "narrative", field: "incentiveSchemes", status: "PENDING_SOURCE" },
  { code: "GOV-4", label: "Statement on due diligence", type: "narrative", field: "dueDiligenceStatement", status: "PENDING_SOURCE" },
  { code: "GOV-5", label: "Risk management and internal controls over sustainability reporting", type: "narrative", field: "riskManagementControls", status: "PENDING_SOURCE" },
  { code: "SBM-1", label: "Strategy, business model and value chain", type: "narrative", field: "strategyBusinessModel", status: "PENDING_SOURCE" },
  { code: "SBM-2", label: "Interests and views of stakeholders", type: "narrative", field: "stakeholderInterests", status: "PENDING_SOURCE" },
  { code: "SBM-3", label: "Material impacts, risks and opportunities and their interaction with strategy", type: "narrative", field: "materialIroInteraction", status: "PENDING_SOURCE" },
  { code: "IRO-1", label: "Process to identify and assess material impacts, risks and opportunities", type: "narrative", field: "iroIdentificationProcess", status: "PENDING_SOURCE" },
  { code: "IRO-2", label: "Disclosure requirements covered by the sustainability statement", type: "narrative", field: "disclosureRequirementsCovered", status: "PENDING_SOURCE", hint: "Generated from the disclosure index rather than entered.", derived: true },
  { code: "MDR-P", label: "Policies adopted to manage material sustainability matters", type: "narrative", field: "minimumPolicies", status: "PENDING_SOURCE" },
  { code: "MDR-A", label: "Actions and resources in relation to material sustainability matters", type: "narrative", field: "minimumActions", status: "PENDING_SOURCE" },
  { code: "MDR-T", label: "Targets set to manage material sustainability matters", type: "narrative", field: "minimumTargets", status: "PENDING_SOURCE" },
  { code: "MDR-M", label: "Metrics used to manage material sustainability matters", type: "narrative", field: "minimumMetrics", status: "PENDING_SOURCE" },
];

export const ESRS_STANDARDS: EsrsStandardMeta[] = [
  {
    code: "ESRS_E1",
    label: "ESRS E1",
    title: "Climate change",
    pillar: "ENVIRONMENT",
    relation: "climateDisclosure",
    blurb: "Transition plan, physical and transition risk, energy consumption, GHG emissions across all three scopes, removals and carbon pricing.",
    datapoints: [
    { code: "E1-1", label: "Transition plan for climate change mitigation", type: "narrative", field: "transitionPlan", status: "PENDING_SOURCE" },
    { code: "E1-2", label: "Policies related to climate change mitigation and adaptation", type: "narrative", field: "climatePolicies", status: "PENDING_SOURCE" },
    { code: "E1-3", label: "Actions and resources in relation to climate change policies", type: "narrative", field: "climateActions", status: "PENDING_SOURCE" },
    { code: "E1-4", label: "Targets related to climate change mitigation and adaptation", type: "narrative", field: "climateTargets", status: "PENDING_SOURCE" },
    { code: "E1-4a", label: "Base year for GHG reduction targets", type: "year", field: "targetBaseYear", status: "PENDING_SOURCE" },
    { code: "E1-4b", label: "Absolute GHG reduction target", type: "pct", field: "targetReductionPct", status: "PENDING_SOURCE", unit: "%" },
    { code: "E1-4c", label: "Target year", type: "year", field: "targetYear", status: "PENDING_SOURCE" },
    { code: "E1-5", label: "Total energy consumption", type: "number", field: "totalEnergyConsumptionMwh", status: "PENDING_SOURCE", unit: "MWh", hint: "Electricity and imported steam reused from activity data; fuel energy entered manually.", derived: true },
    { code: "E1-5a", label: "Energy consumption from fossil sources", type: "number", field: "energyFossilMwh", status: "PENDING_SOURCE", unit: "MWh" },
    { code: "E1-5b", label: "Energy consumption from nuclear sources", type: "number", field: "energyNuclearMwh", status: "PENDING_SOURCE", unit: "MWh" },
    { code: "E1-5c", label: "Energy consumption from renewable sources", type: "number", field: "energyRenewableMwh", status: "PENDING_SOURCE", unit: "MWh", derived: true },
    { code: "E1-5d", label: "Energy intensity per net revenue", type: "number", field: "energyIntensityPerRevenue", status: "PENDING_SOURCE", unit: "MWh/EUR", derived: true },
    { code: "E1-6", label: "Gross Scope 1 GHG emissions", type: "number", field: "scope1Tco2e", status: "PENDING_SOURCE", unit: "tCO2e", derived: true },
    { code: "E1-6a", label: "Gross location-based Scope 2 GHG emissions", type: "number", field: "scope2LocationTco2e", status: "PENDING_SOURCE", unit: "tCO2e", derived: true },
    { code: "E1-6b", label: "Gross market-based Scope 2 GHG emissions", type: "number", field: "scope2MarketTco2e", status: "PENDING_SOURCE", unit: "tCO2e" },
    { code: "E1-6c", label: "Gross Scope 3 GHG emissions", type: "number", field: "scope3Tco2e", status: "PENDING_SOURCE", unit: "tCO2e", derived: true },
    { code: "E1-6d", label: "Total GHG emissions", type: "number", field: "totalGhgTco2e", status: "PENDING_SOURCE", unit: "tCO2e", derived: true },
    { code: "E1-6e", label: "GHG intensity per net revenue", type: "number", field: "ghgIntensityPerRevenue", status: "PENDING_SOURCE", unit: "tCO2e/EUR", derived: true },
    { code: "E1-6f", label: "Biogenic CO2 emissions", type: "number", field: "biogenicCo2Tonnes", status: "PENDING_SOURCE", unit: "t CO2" },
    { code: "E1-7", label: "GHG removals and carbon credits", type: "narrative", field: "removalsAndCredits", status: "PENDING_SOURCE" },
    { code: "E1-7a", label: "GHG removals in own operations", type: "number", field: "removalsOwnOperationsTco2e", status: "PENDING_SOURCE", unit: "tCO2e" },
    { code: "E1-7b", label: "Carbon credits cancelled in the reporting year", type: "number", field: "carbonCreditsCancelledTco2e", status: "PENDING_SOURCE", unit: "tCO2e", derived: true },
    { code: "E1-8", label: "Internal carbon pricing", type: "narrative", field: "internalCarbonPricing", status: "PENDING_SOURCE" },
    { code: "E1-8a", label: "Internal carbon price applied", type: "currency", field: "internalCarbonPricePerTonne", status: "PENDING_SOURCE", unit: "EUR/tCO2e" },
    { code: "E1-9", label: "Anticipated financial effects from physical and transition risks", type: "narrative", field: "anticipatedFinancialEffects", status: "PENDING_SOURCE", phaseIn: "Transitional relief available for the first reporting year under ESRS 1 Appendix C." },
    { code: "E1-9a", label: "Assets at material physical risk", type: "pct", field: "assetsAtPhysicalRiskPct", status: "PENDING_SOURCE", unit: "%", phaseIn: "Transitional relief available for the first reporting year under ESRS 1 Appendix C." },
    ],
  },
  {
    code: "ESRS_E2",
    label: "ESRS E2",
    title: "Pollution",
    pillar: "ENVIRONMENT",
    relation: "pollutionDisclosure",
    blurb: "Pollution of air, water and soil, substances of concern, and microplastics.",
    datapoints: [
    { code: "E2-1", label: "Policies related to pollution", type: "narrative", field: "pollutionPolicies", status: "PENDING_SOURCE" },
    { code: "E2-2", label: "Actions and resources related to pollution", type: "narrative", field: "pollutionActions", status: "PENDING_SOURCE" },
    { code: "E2-3", label: "Targets related to pollution", type: "narrative", field: "pollutionTargets", status: "PENDING_SOURCE" },
    { code: "E2-4", label: "Pollution of air, water and soil", type: "narrative", field: "pollutionNarrative", status: "PENDING_SOURCE" },
    { code: "E2-4a", label: "Emissions to air of pollutants", type: "number", field: "airPollutantsTonnes", status: "PENDING_SOURCE", unit: "t" },
    { code: "E2-4b", label: "Emissions to water of pollutants", type: "number", field: "waterPollutantsTonnes", status: "PENDING_SOURCE", unit: "t" },
    { code: "E2-4c", label: "Emissions to soil of pollutants", type: "number", field: "soilPollutantsTonnes", status: "PENDING_SOURCE", unit: "t" },
    { code: "E2-5", label: "Substances of concern and substances of very high concern", type: "narrative", field: "substancesOfConcern", status: "PENDING_SOURCE" },
    { code: "E2-5a", label: "Total substances of very high concern generated or used", type: "number", field: "svhcTonnes", status: "PENDING_SOURCE", unit: "t" },
    { code: "E2-6", label: "Anticipated financial effects from pollution-related impacts, risks and opportunities", type: "narrative", field: "pollutionFinancialEffects", status: "PENDING_SOURCE", phaseIn: "Transitional relief available for the first reporting year under ESRS 1 Appendix C." },
    ],
  },
  {
    code: "ESRS_E3",
    label: "ESRS E3",
    title: "Water and marine resources",
    pillar: "ENVIRONMENT",
    relation: "waterDisclosure",
    blurb: "Water consumption, withdrawal and discharge, water in areas of water stress, and marine resources.",
    datapoints: [
    { code: "E3-1", label: "Policies related to water and marine resources", type: "narrative", field: "waterPolicies", status: "PENDING_SOURCE" },
    { code: "E3-2", label: "Actions and resources related to water and marine resources", type: "narrative", field: "waterActions", status: "PENDING_SOURCE" },
    { code: "E3-3", label: "Targets related to water and marine resources", type: "narrative", field: "waterTargets", status: "PENDING_SOURCE" },
    { code: "E3-4", label: "Water consumption", type: "number", field: "waterConsumptionM3", status: "PENDING_SOURCE", unit: "m3", derived: true },
    { code: "E3-4a", label: "Total water withdrawal", type: "number", field: "waterWithdrawalM3", status: "PENDING_SOURCE", unit: "m3", derived: true },
    { code: "E3-4b", label: "Total water discharge", type: "number", field: "waterDischargeM3", status: "PENDING_SOURCE", unit: "m3", derived: true },
    { code: "E3-4c", label: "Water consumption in areas of water stress", type: "number", field: "waterConsumptionStressM3", status: "PENDING_SOURCE", unit: "m3" },
    { code: "E3-4d", label: "Water recycled and reused", type: "number", field: "waterRecycledM3", status: "PENDING_SOURCE", unit: "m3", derived: true },
    { code: "E3-4e", label: "Water intensity per net revenue", type: "number", field: "waterIntensityPerRevenue", status: "PENDING_SOURCE", unit: "m3/EUR", derived: true },
    { code: "E3-5", label: "Anticipated financial effects from water and marine resources-related risks", type: "narrative", field: "waterFinancialEffects", status: "PENDING_SOURCE", phaseIn: "Transitional relief available for the first reporting year under ESRS 1 Appendix C." },
    ],
  },
  {
    code: "ESRS_E4",
    label: "ESRS E4",
    title: "Biodiversity and ecosystems",
    pillar: "ENVIRONMENT",
    relation: "biodiversityDisclosure",
    blurb: "Impacts on biodiversity and ecosystems, transition plan alignment, and land-use change.",
    datapoints: [
    { code: "E4-1", label: "Transition plan and consideration of biodiversity and ecosystems in strategy", type: "narrative", field: "biodiversityTransitionPlan", status: "PENDING_SOURCE" },
    { code: "E4-2", label: "Policies related to biodiversity and ecosystems", type: "narrative", field: "biodiversityPolicies", status: "PENDING_SOURCE" },
    { code: "E4-3", label: "Actions and resources related to biodiversity and ecosystems", type: "narrative", field: "biodiversityActions", status: "PENDING_SOURCE" },
    { code: "E4-4", label: "Targets related to biodiversity and ecosystems", type: "narrative", field: "biodiversityTargets", status: "PENDING_SOURCE" },
    { code: "E4-5", label: "Impact metrics related to biodiversity and ecosystems change", type: "narrative", field: "biodiversityImpactMetrics", status: "PENDING_SOURCE" },
    { code: "E4-5a", label: "Number of sites near biodiversity-sensitive areas", type: "int", field: "sitesNearSensitiveAreas", status: "PENDING_SOURCE" },
    { code: "E4-5b", label: "Land use change", type: "number", field: "landUseChangeHa", status: "PENDING_SOURCE", unit: "ha" },
    { code: "E4-5c", label: "Land area restored", type: "number", field: "landRestoredHa", status: "PENDING_SOURCE", unit: "ha" },
    { code: "E4-6", label: "Anticipated financial effects from biodiversity-related impacts, risks and opportunities", type: "narrative", field: "biodiversityFinancialEffects", status: "PENDING_SOURCE", phaseIn: "Transitional relief available for the first reporting year under ESRS 1 Appendix C." },
    ],
  },
  {
    code: "ESRS_E5",
    label: "ESRS E5",
    title: "Resource use and circular economy",
    pillar: "ENVIRONMENT",
    relation: "circularDisclosure",
    blurb: "Resource inflows and outflows, waste, and circular economy practices.",
    datapoints: [
    { code: "E5-1", label: "Policies related to resource use and circular economy", type: "narrative", field: "circularPolicies", status: "PENDING_SOURCE" },
    { code: "E5-2", label: "Actions and resources related to resource use and circular economy", type: "narrative", field: "circularActions", status: "PENDING_SOURCE" },
    { code: "E5-3", label: "Targets related to resource use and circular economy", type: "narrative", field: "circularTargets", status: "PENDING_SOURCE" },
    { code: "E5-4", label: "Resource inflows", type: "narrative", field: "resourceInflows", status: "PENDING_SOURCE" },
    { code: "E5-4a", label: "Total weight of materials used", type: "number", field: "materialsUsedTonnes", status: "PENDING_SOURCE", unit: "t" },
    { code: "E5-4b", label: "Share of secondary reused or recycled materials", type: "pct", field: "secondaryMaterialsPct", status: "PENDING_SOURCE", unit: "%" },
    { code: "E5-5", label: "Resource outflows", type: "narrative", field: "resourceOutflows", status: "PENDING_SOURCE" },
    { code: "E5-5a", label: "Total waste generated", type: "number", field: "wasteGeneratedTonnes", status: "PENDING_SOURCE", unit: "t", derived: true },
    { code: "E5-5b", label: "Waste diverted from disposal", type: "number", field: "wasteDivertedTonnes", status: "PENDING_SOURCE", unit: "t", derived: true },
    { code: "E5-5c", label: "Waste directed to disposal", type: "number", field: "wasteDisposalTonnes", status: "PENDING_SOURCE", unit: "t", derived: true },
    { code: "E5-5d", label: "Hazardous waste", type: "number", field: "hazardousWasteTonnes", status: "PENDING_SOURCE", unit: "t", derived: true },
    { code: "E5-5e", label: "Non-recycled waste", type: "number", field: "nonRecycledWasteTonnes", status: "PENDING_SOURCE", unit: "t" },
    { code: "E5-6", label: "Anticipated financial effects from resource use and circular economy risks", type: "narrative", field: "circularFinancialEffects", status: "PENDING_SOURCE", phaseIn: "Transitional relief available for the first reporting year under ESRS 1 Appendix C." },
    ],
  },
  {
    code: "ESRS_S1",
    label: "ESRS S1",
    title: "Own workforce",
    pillar: "SOCIAL",
    relation: "ownWorkforceDisclosure",
    blurb: "Working conditions, equal treatment and opportunities, and other work-related rights for the undertaking's own workforce.",
    datapoints: [
    { code: "S1-1", label: "Policies related to own workforce", type: "narrative", field: "workforcePolicies", status: "PENDING_SOURCE" },
    { code: "S1-2", label: "Processes for engaging with own workers about impacts", type: "narrative", field: "workerEngagement", status: "PENDING_SOURCE" },
    { code: "S1-3", label: "Processes to remediate negative impacts and channels to raise concerns", type: "narrative", field: "workerRemediation", status: "PENDING_SOURCE" },
    { code: "S1-4", label: "Taking action on material impacts on own workforce", type: "narrative", field: "workforceActions", status: "PENDING_SOURCE" },
    { code: "S1-5", label: "Targets related to managing material impacts on own workforce", type: "narrative", field: "workforceTargets", status: "PENDING_SOURCE" },
    { code: "S1-6", label: "Characteristics of the undertaking's employees", type: "int", field: "employeesTotal", status: "PENDING_SOURCE" },
    { code: "S1-6a", label: "Number of employees by gender — female", type: "int", field: "employeesFemale", status: "PENDING_SOURCE" },
    { code: "S1-6b", label: "Number of employees by gender — male", type: "int", field: "employeesMale", status: "PENDING_SOURCE" },
    { code: "S1-6c", label: "Employee turnover rate", type: "pct", field: "employeeTurnoverPct", status: "PENDING_SOURCE", unit: "%" },
    { code: "S1-7", label: "Characteristics of non-employee workers in own workforce", type: "int", field: "nonEmployeeWorkers", status: "PENDING_SOURCE" },
    { code: "S1-8", label: "Collective bargaining coverage and social dialogue", type: "pct", field: "collectiveBargainingPct", status: "PENDING_SOURCE", unit: "%" },
    { code: "S1-9", label: "Diversity metrics", type: "pct", field: "genderDiversityTopManagementPct", status: "PENDING_SOURCE", unit: "%" },
    { code: "S1-10", label: "Adequate wages", type: "bool", field: "adequateWagesAllEmployees", status: "PENDING_SOURCE" },
    { code: "S1-11", label: "Social protection", type: "narrative", field: "socialProtection", status: "PENDING_SOURCE" },
    { code: "S1-12", label: "Persons with disabilities", type: "pct", field: "employeesWithDisabilitiesPct", status: "PENDING_SOURCE", unit: "%" },
    { code: "S1-13", label: "Training and skills development metrics", type: "number", field: "avgTrainingHours", status: "PENDING_SOURCE", unit: "hours" },
    { code: "S1-14", label: "Health and safety metrics", type: "narrative", field: "healthSafetyNarrative", status: "PENDING_SOURCE" },
    { code: "S1-14a", label: "Percentage of own workers covered by a health and safety management system", type: "pct", field: "healthSafetyCoveragePct", status: "PENDING_SOURCE", unit: "%" },
    { code: "S1-14b", label: "Number of fatalities from work-related injuries and ill health", type: "int", field: "fatalities", status: "PENDING_SOURCE" },
    { code: "S1-14c", label: "Number of recordable work-related accidents", type: "int", field: "recordableAccidents", status: "PENDING_SOURCE" },
    { code: "S1-14d", label: "Rate of recordable work-related accidents", type: "number", field: "recordableAccidentRate", status: "PENDING_SOURCE" },
    { code: "S1-15", label: "Work-life balance metrics", type: "pct", field: "familyLeaveEntitledPct", status: "PENDING_SOURCE", unit: "%" },
    { code: "S1-16", label: "Remuneration metrics — gender pay gap", type: "pct", field: "genderPayGapPct", status: "PENDING_SOURCE", unit: "%" },
    { code: "S1-16a", label: "Annual total remuneration ratio", type: "number", field: "remunerationRatio", status: "PENDING_SOURCE" },
    { code: "S1-17", label: "Incidents, complaints and severe human rights impacts", type: "int", field: "humanRightsIncidents", status: "PENDING_SOURCE" },
    ],
  },
  {
    code: "ESRS_S2",
    label: "ESRS S2",
    title: "Workers in the value chain",
    pillar: "SOCIAL",
    relation: "valueChainWorkersDisclosure",
    blurb: "Impacts on workers in the upstream and downstream value chain, and how they are managed.",
    datapoints: [
    { code: "S2-1", label: "Policies related to value chain workers", type: "narrative", field: "valueChainWorkerPolicies", status: "PENDING_SOURCE" },
    { code: "S2-2", label: "Processes for engaging with value chain workers about impacts", type: "narrative", field: "valueChainWorkerEngagement", status: "PENDING_SOURCE" },
    { code: "S2-3", label: "Processes to remediate negative impacts and channels to raise concerns", type: "narrative", field: "valueChainWorkerRemediation", status: "PENDING_SOURCE" },
    { code: "S2-4", label: "Taking action on material impacts on value chain workers", type: "narrative", field: "valueChainWorkerActions", status: "PENDING_SOURCE" },
    { code: "S2-5", label: "Targets related to managing material impacts on value chain workers", type: "narrative", field: "valueChainWorkerTargets", status: "PENDING_SOURCE" },
    { code: "S2-5a", label: "Suppliers assessed for social criteria", type: "int", field: "suppliersAssessed", status: "PENDING_SOURCE" },
    { code: "S2-5b", label: "Suppliers with identified negative impacts", type: "int", field: "suppliersWithNegativeImpacts", status: "PENDING_SOURCE" },
    ],
  },
  {
    code: "ESRS_S3",
    label: "ESRS S3",
    title: "Affected communities",
    pillar: "SOCIAL",
    relation: "communitiesDisclosure",
    blurb: "Impacts on communities affected by the undertaking's operations and value chain, including indigenous peoples.",
    datapoints: [
    { code: "S3-1", label: "Policies related to affected communities", type: "narrative", field: "communityPolicies", status: "PENDING_SOURCE" },
    { code: "S3-2", label: "Processes for engaging with affected communities about impacts", type: "narrative", field: "communityEngagement", status: "PENDING_SOURCE" },
    { code: "S3-3", label: "Processes to remediate negative impacts and channels to raise concerns", type: "narrative", field: "communityRemediation", status: "PENDING_SOURCE" },
    { code: "S3-4", label: "Taking action on material impacts on affected communities", type: "narrative", field: "communityActions", status: "PENDING_SOURCE" },
    { code: "S3-5", label: "Targets related to managing material impacts on affected communities", type: "narrative", field: "communityTargets", status: "PENDING_SOURCE" },
    { code: "S3-5a", label: "Operations with community engagement or impact assessments", type: "pct", field: "operationsWithEngagementPct", status: "PENDING_SOURCE", unit: "%" },
    ],
  },
  {
    code: "ESRS_S4",
    label: "ESRS S4",
    title: "Consumers and end-users",
    pillar: "SOCIAL",
    relation: "consumersDisclosure",
    blurb: "Impacts on consumers and end-users, including product safety, privacy and access to information.",
    datapoints: [
    { code: "S4-1", label: "Policies related to consumers and end-users", type: "narrative", field: "consumerPolicies", status: "PENDING_SOURCE" },
    { code: "S4-2", label: "Processes for engaging with consumers and end-users about impacts", type: "narrative", field: "consumerEngagement", status: "PENDING_SOURCE" },
    { code: "S4-3", label: "Processes to remediate negative impacts and channels to raise concerns", type: "narrative", field: "consumerRemediation", status: "PENDING_SOURCE" },
    { code: "S4-4", label: "Taking action on material impacts on consumers and end-users", type: "narrative", field: "consumerActions", status: "PENDING_SOURCE" },
    { code: "S4-5", label: "Targets related to managing material impacts on consumers and end-users", type: "narrative", field: "consumerTargets", status: "PENDING_SOURCE" },
    { code: "S4-5a", label: "Substantiated complaints concerning product safety or data privacy", type: "int", field: "consumerComplaints", status: "PENDING_SOURCE" },
    ],
  },
  {
    code: "ESRS_G1",
    label: "ESRS G1",
    title: "Business conduct",
    pillar: "GOVERNANCE",
    relation: "businessConductDisclosure",
    blurb: "Corporate culture, protection of whistleblowers, anti-corruption, political engagement and payment practices.",
    datapoints: [
    { code: "G1-1", label: "Business conduct policies and corporate culture", type: "narrative", field: "conductPolicies", status: "PENDING_SOURCE" },
    { code: "G1-2", label: "Management of relationships with suppliers", type: "narrative", field: "supplierRelationships", status: "PENDING_SOURCE" },
    { code: "G1-3", label: "Prevention and detection of corruption and bribery", type: "narrative", field: "corruptionPrevention", status: "PENDING_SOURCE" },
    { code: "G1-3a", label: "Percentage of functions at risk covered by anti-corruption training", type: "pct", field: "antiCorruptionTrainingPct", status: "PENDING_SOURCE", unit: "%" },
    { code: "G1-4", label: "Confirmed incidents of corruption or bribery", type: "int", field: "corruptionIncidents", status: "PENDING_SOURCE" },
    { code: "G1-4a", label: "Fines for violation of anti-corruption and anti-bribery laws", type: "currency", field: "corruptionFinesEur", status: "PENDING_SOURCE", unit: "EUR" },
    { code: "G1-5", label: "Political influence and lobbying activities", type: "narrative", field: "politicalInfluence", status: "PENDING_SOURCE" },
    { code: "G1-5a", label: "Total monetary value of political contributions", type: "currency", field: "politicalContributionsEur", status: "PENDING_SOURCE", unit: "EUR" },
    { code: "G1-6", label: "Payment practices", type: "narrative", field: "paymentPractices", status: "PENDING_SOURCE" },
    { code: "G1-6a", label: "Average time to pay invoices", type: "int", field: "averageDaysToPay", status: "PENDING_SOURCE", unit: "days" },
    ],
  },
];

const BY_CODE = new Map(ESRS_STANDARDS.map((s) => [s.code, s]));
export const getEsrsStandard = (code: string): EsrsStandardMeta | undefined => BY_CODE.get(code);

/** Minimum disclosure requirements, restated per material standard. */
export const ESRS_MDR_FIELDS: { name: string; label: string; hint: string }[] = [
  { name: "policies", label: "MDR-P Policies", hint: "Policies adopted to manage this matter." },
  { name: "actions", label: "MDR-A Actions", hint: "Actions taken and resources allocated." },
  { name: "targets", label: "MDR-T Targets", hint: "Measurable targets set, and progress against them." },
  { name: "metrics", label: "MDR-M Metrics", hint: "Metrics used to track effectiveness." },
];

export const ESRS_TOTAL_DATAPOINT_COUNT =
  ESRS_2_DATAPOINTS.length + ESRS_STANDARDS.reduce((sum, s) => sum + s.datapoints.length, 0);

export const ESRS_CONFIRMED_DATAPOINT_COUNT =
  ESRS_2_DATAPOINTS.filter((d) => d.status === "CONFIRMED").length +
  ESRS_STANDARDS.reduce((sum, s) => sum + s.datapoints.filter((d) => d.status === "CONFIRMED").length, 0);

export const ESRS_REGISTRY_RECONCILED = ESRS_CONFIRMED_DATAPOINT_COUNT === ESRS_TOTAL_DATAPOINT_COUNT;

// Omnibus I (Directive (EU) 2026/470) — verified thresholds, shown wherever
// CSRD is offered so nobody below them reads this as a filing obligation.
export const CSRD_EMPLOYEE_THRESHOLD = 1000;
export const CSRD_TURNOVER_THRESHOLD_EUR = 450000000;
export const CSRD_APPLICABILITY_NOTICE = "Under the Omnibus I Directive (EU) 2026/470, in force 18 March 2026, CSRD reporting is mandatory only for undertakings with more than 1,000 employees and more than EUR 450 million in net turnover, first reporting for financial years beginning in 2027. Most undertakings below those thresholds are outside mandatory scope and may use this report voluntarily — for example to answer a customer's value-chain request — but should not treat it as evidence of a filing obligation.";

export const CSRD_IRO_KINDS = [
  { value: "IMPACT", label: "Impact materiality only" },
  { value: "FINANCIAL", label: "Financial materiality only" },
  { value: "BOTH", label: "Both axes" },
] as const;

export const CSRD_IMPACT_TYPES = [
  { value: "NEGATIVE_ACTUAL", label: "Negative — already occurring" },
  { value: "NEGATIVE_POTENTIAL", label: "Negative — could occur" },
  { value: "POSITIVE_ACTUAL", label: "Positive — already occurring" },
  { value: "POSITIVE_POTENTIAL", label: "Positive — could occur" },
] as const;

export const CSRD_FINANCIAL_EFFECT_TYPES = [
  { value: "RISK", label: "Risk" },
  { value: "OPPORTUNITY", label: "Opportunity" },
] as const;

export const CSRD_VALUE_CHAIN_LOCATIONS = [
  { value: "OWN_OPERATIONS", label: "Own operations" },
  { value: "UPSTREAM", label: "Upstream" },
  { value: "DOWNSTREAM", label: "Downstream" },
] as const;

export const isNegativeImpact = (type: string) => type.startsWith("NEGATIVE");
export const isPotentialImpact = (type: string) => type.endsWith("_POTENTIAL");
