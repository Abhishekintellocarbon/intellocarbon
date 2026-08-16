/**
 * Frontend mirror of the GRI Standards registry.
 *
 * This is a deliberate duplicate of the backend's `data/griStandards.ts` topic
 * list, kept in sync by hand. It carries only what the UI needs — codes,
 * labels, titles and the field groups each form section renders — and NOT the
 * disclosure/field mapping the content index is built from, which stays
 * server-side where the compliance claim is evaluated. The alternative (an
 * endpoint serving the registry) would make every disclosure form wait on a
 * round trip to know what to render.
 *
 * VERSION NOTES — the two substitutions that differ from a naive reading of
 * the 2021 standards, mirrored here so the UI copy stays truthful:
 *  - There is no GRI 307. It was withdrawn; compliance with laws and
 *    regulations is reported under Disclosure 2-27 in the Universal section.
 *  - Biodiversity is GRI 101: Biodiversity 2024, which replaced GRI 304 for
 *    reporting published on or after 1 January 2026.
 *  - GRI 302 and GRI 305 are current, but GRI 103: Energy 2025 and GRI 102:
 *    Climate Change 2025 replace them for periods beginning on or after
 *    1 January 2027.
 */

export type GriSeries = "ENVIRONMENTAL" | "SOCIAL";

export interface GriFormField {
  name: string;
  label: string;
  /** `text` renders a textarea; the rest render an Input or Select. */
  type: "text" | "number" | "int" | "pct" | "ratio" | "year" | "bool";
  /** GRI disclosure this field belongs to, shown as a small caption group header. */
  disclosure: string;
  hint?: string;
}

export interface GriTopicMeta {
  code: string;
  label: string;
  title: string;
  edition: string;
  series: GriSeries;
  /** Short description shown on the materiality step so a user can judge relevance. */
  blurb: string;
  fields: GriFormField[];
}

const f = (
  name: string,
  label: string,
  type: GriFormField["type"],
  disclosure: string,
  hint?: string,
): GriFormField => ({ name, label, type, disclosure, hint });

export const GRI_TOPICS: GriTopicMeta[] = [
  {
    code: "GRI_301",
    label: "GRI 301",
    title: "Materials",
    edition: "GRI 301: Materials 2016",
    series: "ENVIRONMENTAL",
    blurb: "Materials used by weight or volume, recycled inputs, and reclaimed products.",
    fields: [
      f("renewableMaterialsTonnes", "Renewable materials used (t)", "number", "301-1"),
      f("nonRenewableMaterialsTonnes", "Non-renewable materials used (t)", "number", "301-1"),
      f("materialsMethodology", "Methodology and assumptions", "text", "301-1"),
      f("recycledInputPct", "Recycled input materials used (%)", "pct", "301-2"),
      f("reclaimedProductsPct", "Reclaimed products and packaging (%)", "pct", "301-3"),
      f("reclaimedByCategory", "Reclaimed products by category", "text", "301-3"),
    ],
  },
  {
    code: "GRI_302",
    label: "GRI 302",
    title: "Energy",
    edition: "GRI 302: Energy 2016",
    series: "ENVIRONMENTAL",
    blurb: "Energy consumed inside and outside the organization, intensity, and reductions.",
    fields: [
      f("nonRenewableFuelGj", "Non-renewable fuel consumed (GJ)", "number", "302-1", "Fuel energy is manual — the platform holds emission factors but not calorific values."),
      f("renewableFuelGj", "Renewable fuel consumed (GJ)", "number", "302-1"),
      f("electricityConsumedGj", "Electricity consumed (GJ)", "number", "302-1"),
      f("heatingConsumedGj", "Heating consumed (GJ)", "number", "302-1"),
      f("coolingConsumedGj", "Cooling consumed (GJ)", "number", "302-1"),
      f("steamConsumedGj", "Steam consumed (GJ)", "number", "302-1"),
      f("electricitySoldGj", "Electricity sold (GJ)", "number", "302-1"),
      f("energyStandardsUsed", "Standards, methodologies and assumptions", "text", "302-1"),
      f("energyOutsideOrgGj", "Energy consumed outside the organization (GJ)", "number", "302-2"),
      f("intensityDenominatorDescription", "Intensity ratio denominator", "text", "302-3"),
      f("intensityIncludesOutsideOrg", "Intensity includes energy outside the organization", "bool", "302-3"),
      f("energyReductionGj", "Reduction in energy consumption (GJ)", "number", "302-4"),
      f("energyReductionBaseYear", "Base year for the reduction", "year", "302-4"),
      f("energyReductionBasis", "Basis for the reduction", "text", "302-4"),
      f("productEnergyReductionGj", "Reduction in product/service energy requirements (GJ)", "number", "302-5"),
      f("productEnergyReductionBasis", "Basis for the product reduction", "text", "302-5"),
    ],
  },
  {
    code: "GRI_303",
    label: "GRI 303",
    title: "Water and Effluents",
    edition: "GRI 303: Water and Effluents 2018",
    series: "ENVIRONMENTAL",
    blurb: "Water as a shared resource, discharge management, and withdrawal/discharge/consumption.",
    fields: [
      f("interactionsNarrative", "Interactions with water as a shared resource", "text", "303-1"),
      f("waterStressAssessmentTool", "Tool used to assess water stress", "text", "303-1", "e.g. WRI Aqueduct Water Risk Atlas"),
      f("dischargeImpactManagement", "Management of discharge-related impacts", "text", "303-2"),
      f("minimumEffluentStandards", "Minimum standards set for effluent quality", "text", "303-2"),
      f("withdrawalTotalMl", "Total water withdrawal (ML)", "number", "303-3", "Leave blank to use the figure derived from your ISO 14046 water inventory."),
      f("withdrawalWaterStressedMl", "Withdrawal from water-stressed areas (ML)", "number", "303-3"),
      f("withdrawalFreshwaterMl", "Freshwater withdrawal (ML)", "number", "303-3"),
      f("dischargeTotalMl", "Total water discharge (ML)", "number", "303-4"),
      f("dischargeWaterStressedMl", "Discharge to water-stressed areas (ML)", "number", "303-4"),
      f("dischargeFreshwaterMl", "Freshwater discharge (ML)", "number", "303-4"),
      f("prioritySubstancesOfConcern", "Priority substances of concern in discharge", "text", "303-4"),
      f("consumptionTotalMl", "Total water consumption (ML)", "number", "303-5"),
      f("consumptionWaterStressedMl", "Consumption in water-stressed areas (ML)", "number", "303-5"),
      f("storageChangeMl", "Change in water storage (ML)", "number", "303-5", "May be negative if storage fell."),
    ],
  },
  {
    code: "GRI_101",
    label: "GRI 101",
    title: "Biodiversity",
    edition: "GRI 101: Biodiversity 2024",
    series: "ENVIRONMENTAL",
    blurb:
      "Biodiversity policies, impact locations, and the five direct drivers of biodiversity loss. Replaced GRI 304 from 1 Jan 2026.",
    fields: [
      f("policiesNarrative", "Policies to halt and reverse biodiversity loss", "text", "101-1"),
      f("mitigationHierarchy", "Application of the mitigation hierarchy", "text", "101-2"),
      f("landRestoredHa", "Land restored (ha)", "number", "101-2"),
      f("accessBenefitSharing", "Access and benefit-sharing", "text", "101-3"),
      f("impactIdentificationProcess", "How biodiversity impacts were identified", "text", "101-4"),
      f("sitesTotalCount", "Sites with biodiversity impacts", "int", "101-5"),
      f("sitesInProtectedAreasCount", "Sites in or adjacent to protected areas", "int", "101-5"),
      f("sitesNearProtectedAreasCount", "Sites near areas of high biodiversity value", "int", "101-5"),
      f("siteLocationsDescription", "Description of site locations", "text", "101-5"),
      f("driverLandUseChange", "Driver — land and sea use change", "text", "101-6"),
      f("driverResourceExploitation", "Driver — resource exploitation", "text", "101-6"),
      f("driverClimateChange", "Driver — climate change", "text", "101-6"),
      f("driverPollution", "Driver — pollution", "text", "101-6"),
      f("driverInvasiveSpecies", "Driver — invasive alien species", "text", "101-6"),
      f("landUseChangeHa", "Land converted (ha)", "number", "101-6"),
      f("stateOfBiodiversityChanges", "Changes to the state of biodiversity", "text", "101-7"),
      f("ecosystemServicesAffected", "Ecosystem services affected", "text", "101-8"),
    ],
  },
  {
    code: "GRI_305",
    label: "GRI 305",
    title: "Emissions",
    edition: "GRI 305: Emissions 2016",
    series: "ENVIRONMENTAL",
    blurb: "GHG emissions by scope, intensity, reductions, ODS, and other significant air emissions.",
    fields: [
      f("biogenicCo2Tonnes", "Biogenic CO2 emissions (t)", "number", "305-1"),
      f("baseYear", "Base year", "year", "305-1"),
      f("baseYearEmissionsTco2e", "Base year emissions (tCO2e)", "number", "305-1"),
      f("gasesIncluded", "Gases included", "text", "305-1", "e.g. CO2, CH4, N2O"),
      f("consolidationApproach", "Consolidation approach", "text", "305-1", "e.g. Operational control"),
      f("emissionsStandardsUsed", "Standards, methodologies and assumptions", "text", "305-1"),
      f("scope2MarketBasedTco2e", "Scope 2 market-based (tCO2e)", "number", "305-2", "Location-based Scope 2 is derived from your activity data; market-based needs supplier instruments the platform does not hold."),
      f("scope3CategoriesIncluded", "Scope 3 categories included", "text", "305-3"),
      f("intensityDenominatorDescription", "Intensity ratio denominator", "text", "305-4"),
      f("intensityGasesIncluded", "Gases included in the intensity ratio", "text", "305-4"),
      f("reductionTco2e", "Reduction of GHG emissions (tCO2e)", "number", "305-5"),
      f("reductionBaseYear", "Base year for the reduction", "year", "305-5"),
      f("reductionScopesIncluded", "Scopes included in the reduction", "text", "305-5"),
      f("odsCfc11EquivalentTonnes", "ODS produced/imported/exported (t CFC-11 eq)", "number", "305-6"),
      f("odsSubstancesIncluded", "ODS substances included", "text", "305-6"),
      f("noxTonnes", "NOx (t)", "number", "305-7"),
      f("soxTonnes", "SOx (t)", "number", "305-7"),
      f("vocTonnes", "Volatile organic compounds (t)", "number", "305-7"),
      f("particulateMatterTonnes", "Particulate matter (t)", "number", "305-7"),
      f("persistentOrganicPollutantsTonnes", "Persistent organic pollutants (t)", "number", "305-7"),
      f("hazardousAirPollutantsTonnes", "Hazardous air pollutants (t)", "number", "305-7"),
    ],
  },
  {
    code: "GRI_306",
    label: "GRI 306",
    title: "Waste",
    edition: "GRI 306: Waste 2020",
    series: "ENVIRONMENTAL",
    blurb: "Waste impacts, waste generated, and waste diverted from or directed to disposal.",
    fields: [
      f("wasteImpactsNarrative", "Waste generation and significant waste-related impacts", "text", "306-1"),
      f("wasteManagementNarrative", "Management of significant waste-related impacts", "text", "306-2"),
      f("thirdPartyWasteManagement", "Third-party waste management", "text", "306-2"),
      f("wasteCompositionDescription", "Waste composition", "text", "306-3", "Total waste generated is derived from the diverted and disposal figures below."),
      f("hazardousDivertedReuseT", "Hazardous — preparation for reuse (t)", "number", "306-4"),
      f("hazardousDivertedRecyclingT", "Hazardous — recycling (t)", "number", "306-4"),
      f("hazardousDivertedOtherRecoveryT", "Hazardous — other recovery (t)", "number", "306-4"),
      f("nonHazardousDivertedReuseT", "Non-hazardous — preparation for reuse (t)", "number", "306-4"),
      f("nonHazardousDivertedRecyclingT", "Non-hazardous — recycling (t)", "number", "306-4"),
      f("nonHazardousDivertedOtherRecoveryT", "Non-hazardous — other recovery (t)", "number", "306-4"),
      f("hazardousDisposalIncinerationWithRecoveryT", "Hazardous — incineration with energy recovery (t)", "number", "306-5"),
      f("hazardousDisposalIncinerationNoRecoveryT", "Hazardous — incineration without energy recovery (t)", "number", "306-5"),
      f("hazardousDisposalLandfillT", "Hazardous — landfilling (t)", "number", "306-5"),
      f("hazardousDisposalOtherT", "Hazardous — other disposal (t)", "number", "306-5"),
      f("nonHazardousDisposalIncinerationWithRecoveryT", "Non-hazardous — incineration with energy recovery (t)", "number", "306-5"),
      f("nonHazardousDisposalIncinerationNoRecoveryT", "Non-hazardous — incineration without energy recovery (t)", "number", "306-5"),
      f("nonHazardousDisposalLandfillT", "Non-hazardous — landfilling (t)", "number", "306-5"),
      f("nonHazardousDisposalOtherT", "Non-hazardous — other disposal (t)", "number", "306-5"),
      f("onsiteOffsiteBreakdown", "Onsite and offsite breakdown", "text", "306-5"),
    ],
  },
  {
    code: "GRI_308",
    label: "GRI 308",
    title: "Supplier Environmental Assessment",
    edition: "GRI 308: Supplier Environmental Assessment 2016",
    series: "ENVIRONMENTAL",
    blurb: "Screening of new suppliers on environmental criteria and supply-chain impacts.",
    fields: [
      f("newSuppliersScreenedPct", "New suppliers screened on environmental criteria (%)", "pct", "308-1"),
      f("newSuppliersTotalCount", "Total new suppliers engaged", "int", "308-1"),
      f("screeningCriteria", "Screening criteria applied", "text", "308-1"),
      f("suppliersAssessedCount", "Suppliers assessed for environmental impacts", "int", "308-2"),
      f("suppliersWithNegativeImpactsCount", "Suppliers with significant negative impacts", "int", "308-2"),
      f("suppliersWithImprovementsAgreedCount", "Suppliers with improvements agreed", "int", "308-2"),
      f("suppliersTerminatedCount", "Supplier relationships terminated", "int", "308-2"),
      f("negativeImpactsDescription", "Negative impacts identified and actions taken", "text", "308-2"),
    ],
  },
  {
    code: "GRI_401",
    label: "GRI 401",
    title: "Employment",
    edition: "GRI 401: Employment 2016",
    series: "SOCIAL",
    blurb: "New hires and turnover, benefits, and parental leave.",
    fields: [
      f("newHiresTotal", "New hires — total", "int", "401-1"),
      f("newHiresFemale", "New hires — female", "int", "401-1"),
      f("newHiresUnder30", "New hires — under 30", "int", "401-1"),
      f("newHires30To50", "New hires — 30 to 50", "int", "401-1"),
      f("newHiresOver50", "New hires — over 50", "int", "401-1"),
      f("turnoverTotal", "Turnover — total", "int", "401-1"),
      f("turnoverFemale", "Turnover — female", "int", "401-1"),
      f("turnoverUnder30", "Turnover — under 30", "int", "401-1"),
      f("turnover30To50", "Turnover — 30 to 50", "int", "401-1"),
      f("turnoverOver50", "Turnover — over 50", "int", "401-1"),
      f("hiresTurnoverRegionalBreakdown", "Regional breakdown", "text", "401-1"),
      f("benefitsDescription", "Benefits provided to full-time employees", "text", "401-2"),
      f("parentalLeaveEntitledMale", "Entitled to parental leave — male", "int", "401-3"),
      f("parentalLeaveEntitledFemale", "Entitled to parental leave — female", "int", "401-3"),
      f("parentalLeaveTookMale", "Took parental leave — male", "int", "401-3"),
      f("parentalLeaveTookFemale", "Took parental leave — female", "int", "401-3"),
      f("parentalLeaveReturnedMale", "Returned after leave — male", "int", "401-3"),
      f("parentalLeaveReturnedFemale", "Returned after leave — female", "int", "401-3"),
      f("parentalLeaveRetainedMale", "Retained 12 months after return — male", "int", "401-3"),
      f("parentalLeaveRetainedFemale", "Retained 12 months after return — female", "int", "401-3"),
    ],
  },
  {
    code: "GRI_403",
    label: "GRI 403",
    title: "Occupational Health and Safety",
    edition: "GRI 403: Occupational Health and Safety 2018",
    series: "SOCIAL",
    blurb: "OHS management system, hazard identification, injuries, and work-related ill health.",
    fields: [
      f("managementSystemDescription", "OHS management system", "text", "403-1"),
      f("managementSystemIsIso45001", "Certified to ISO 45001", "bool", "403-1"),
      f("hazardIdentificationProcess", "Hazard identification, risk assessment and incident investigation", "text", "403-2"),
      f("occupationalHealthServices", "Occupational health services", "text", "403-3"),
      f("workerParticipation", "Worker participation, consultation and communication", "text", "403-4"),
      f("workerOhsTraining", "Worker training on OHS", "text", "403-5"),
      f("workerHealthPromotion", "Promotion of worker health", "text", "403-6"),
      f("businessRelationshipOhsImpacts", "Impacts linked by business relationships", "text", "403-7"),
      f("workersCoveredCount", "Workers covered by the OHS system", "int", "403-8"),
      f("workersCoveredPct", "Workers covered (%)", "pct", "403-8"),
      f("hoursWorked", "Hours worked", "number", "403-9", "Required to derive injury rates."),
      f("rateBasisHours", "Rate basis (hours)", "int", "403-9", "GRI 403-9 permits 200,000 or 1,000,000."),
      f("fatalitiesEmployees", "Fatalities — employees", "int", "403-9"),
      f("fatalitiesNonEmployees", "Fatalities — other workers", "int", "403-9"),
      f("highConsequenceInjuriesEmployees", "High-consequence injuries — employees", "int", "403-9"),
      f("highConsequenceInjuriesNonEmployees", "High-consequence injuries — other workers", "int", "403-9"),
      f("recordableInjuriesEmployees", "Recordable injuries — employees", "int", "403-9"),
      f("recordableInjuriesNonEmployees", "Recordable injuries — other workers", "int", "403-9"),
      f("mainInjuryTypes", "Main types of work-related injury", "text", "403-9"),
      f("illHealthFatalitiesEmployees", "Ill-health fatalities — employees", "int", "403-10"),
      f("illHealthCasesEmployees", "Ill-health cases — employees", "int", "403-10"),
      f("illHealthFatalitiesNonEmployees", "Ill-health fatalities — other workers", "int", "403-10"),
      f("illHealthCasesNonEmployees", "Ill-health cases — other workers", "int", "403-10"),
      f("illHealthHazards", "Hazards posing a risk of ill health", "text", "403-10"),
    ],
  },
  {
    code: "GRI_404",
    label: "GRI 404",
    title: "Training and Education",
    edition: "GRI 404: Training and Education 2016",
    series: "SOCIAL",
    blurb: "Average training hours, skills programs, and performance reviews.",
    fields: [
      f("avgTrainingHoursPerEmployee", "Average training hours per employee", "number", "404-1"),
      f("avgTrainingHoursMale", "Average training hours — male", "number", "404-1"),
      f("avgTrainingHoursFemale", "Average training hours — female", "number", "404-1"),
      f("avgTrainingHoursManagement", "Average training hours — management", "number", "404-1"),
      f("avgTrainingHoursNonManagement", "Average training hours — non-management", "number", "404-1"),
      f("skillsProgramsDescription", "Programs for upgrading employee skills", "text", "404-2"),
      f("transitionAssistanceDescription", "Transition assistance programs", "text", "404-2"),
      f("performanceReviewPct", "Employees receiving regular performance reviews (%)", "pct", "404-3"),
      f("performanceReviewMalePct", "Performance reviews — male (%)", "pct", "404-3"),
      f("performanceReviewFemalePct", "Performance reviews — female (%)", "pct", "404-3"),
    ],
  },
  {
    code: "GRI_405",
    label: "GRI 405",
    title: "Diversity and Equal Opportunity",
    edition: "GRI 405: Diversity and Equal Opportunity 2016",
    series: "SOCIAL",
    blurb: "Diversity of governance bodies and employees, and the women-to-men remuneration ratio.",
    fields: [
      f("governanceBodyTotal", "Governance body — total members", "int", "405-1"),
      f("governanceBodyFemale", "Governance body — female members", "int", "405-1"),
      f("governanceBodyUnder30", "Governance body — under 30", "int", "405-1"),
      f("governanceBody30To50", "Governance body — 30 to 50", "int", "405-1"),
      f("governanceBodyOver50", "Governance body — over 50", "int", "405-1"),
      f("employeesFemalePct", "Employees — female (%)", "pct", "405-1"),
      f("employeesUnder30Pct", "Employees — under 30 (%)", "pct", "405-1"),
      f("employees30To50Pct", "Employees — 30 to 50 (%)", "pct", "405-1"),
      f("employeesOver50Pct", "Employees — over 50 (%)", "pct", "405-1"),
      f("otherDiversityIndicators", "Other indicators of diversity", "text", "405-1"),
      f("salaryRatioOverall", "Salary ratio women:men — all employees", "ratio", "405-2", "1.00 is parity; below 1.00 means women are paid less."),
      f("salaryRatioManagement", "Salary ratio women:men — management", "ratio", "405-2"),
      f("salaryRatioNonManagement", "Salary ratio women:men — non-management", "ratio", "405-2"),
      f("salaryRatioBasis", "Basis of calculation", "text", "405-2"),
    ],
  },
  {
    code: "GRI_406",
    label: "GRI 406",
    title: "Non-discrimination",
    edition: "GRI 406: Non-discrimination 2016",
    series: "SOCIAL",
    blurb: "Incidents of discrimination and the corrective actions taken.",
    fields: [
      f("incidentsCount", "Total incidents of discrimination", "int", "406-1"),
      f("incidentsReviewedCount", "Incidents reviewed by the organization", "int", "406-1"),
      f("remediationPlansImplementedCount", "Remediation plans implemented", "int", "406-1"),
      f("incidentsNoLongerSubjectToActionCount", "Incidents no longer subject to action", "int", "406-1"),
      f("correctiveActionsDescription", "Corrective actions taken", "text", "406-1"),
    ],
  },
  {
    code: "GRI_413",
    label: "GRI 413",
    title: "Local Communities",
    edition: "GRI 413: Local Communities 2016",
    series: "SOCIAL",
    blurb: "Community engagement, impact assessments, and negative impacts on local communities.",
    fields: [
      f("operationsWithEngagementPct", "Operations with community engagement (%)", "pct", "413-1"),
      f("operationsWithImpactAssessmentPct", "Operations with impact assessments (%)", "pct", "413-1"),
      f("operationsWithDevelopmentProgramsPct", "Operations with development programs (%)", "pct", "413-1"),
      f("engagementDescription", "Engagement approach", "text", "413-1"),
      f("operationsWithNegativeImpactsCount", "Operations with significant negative impacts", "int", "413-2"),
      f("negativeImpactsDescription", "Negative impacts and actions taken", "text", "413-2"),
    ],
  },
  {
    code: "GRI_414",
    label: "GRI 414",
    title: "Supplier Social Assessment",
    edition: "GRI 414: Supplier Social Assessment 2016",
    series: "SOCIAL",
    blurb: "Screening of new suppliers on social criteria and supply-chain impacts.",
    fields: [
      f("newSuppliersScreenedPct", "New suppliers screened on social criteria (%)", "pct", "414-1"),
      f("newSuppliersTotalCount", "Total new suppliers engaged", "int", "414-1"),
      f("screeningCriteria", "Screening criteria applied", "text", "414-1"),
      f("suppliersAssessedCount", "Suppliers assessed for social impacts", "int", "414-2"),
      f("suppliersWithNegativeImpactsCount", "Suppliers with significant negative impacts", "int", "414-2"),
      f("suppliersWithImprovementsAgreedCount", "Suppliers with improvements agreed", "int", "414-2"),
      f("suppliersTerminatedCount", "Supplier relationships terminated", "int", "414-2"),
      f("negativeImpactsDescription", "Negative impacts identified and actions taken", "text", "414-2"),
    ],
  },
  {
    code: "GRI_416",
    label: "GRI 416",
    title: "Customer Health and Safety",
    edition: "GRI 416: Customer Health and Safety 2016",
    series: "SOCIAL",
    blurb: "Health and safety assessment of product categories, and related non-compliance.",
    fields: [
      f("productCategoriesAssessedPct", "Product categories assessed for H&S impacts (%)", "pct", "416-1"),
      f("assessmentDescription", "Assessment approach", "text", "416-1"),
      f("nonComplianceFinesCount", "Non-compliance resulting in a fine", "int", "416-2"),
      f("nonComplianceWarningsCount", "Non-compliance resulting in a warning", "int", "416-2"),
      f("nonComplianceVoluntaryCodesCount", "Non-compliance with voluntary codes", "int", "416-2"),
      f("nonComplianceDescription", "Description of non-compliance", "text", "416-2"),
    ],
  },
  {
    code: "GRI_418",
    label: "GRI 418",
    title: "Customer Privacy",
    edition: "GRI 418: Customer Privacy 2016",
    series: "SOCIAL",
    blurb: "Substantiated privacy complaints and losses of customer data.",
    fields: [
      f("complaintsFromThirdPartiesCount", "Substantiated complaints from outside parties", "int", "418-1"),
      f("complaintsFromRegulatorsCount", "Substantiated complaints from regulators", "int", "418-1"),
      f("dataBreachesCount", "Leaks, thefts or losses of customer data", "int", "418-1"),
      f("customersAffectedCount", "Customers affected", "int", "418-1"),
      f("breachDescription", "Description of breaches", "text", "418-1"),
    ],
  },
];

export const getGriTopic = (code: string): GriTopicMeta | undefined =>
  GRI_TOPICS.find((t) => t.code === code);

/** The six sub-requirements of Disclosure 3-3, reported once per material topic. */
export const GRI_3_3_FIELDS: { name: string; label: string; hint: string }[] = [
  { name: "impactsDescription", label: "Actual and potential impacts", hint: "The impacts this topic covers, as identified in your materiality assessment." },
  { name: "involvementDescription", label: "Involvement with the impacts", hint: "Whether the organization caused, contributed to, or is linked to them." },
  { name: "policiesCommitments", label: "Policies and commitments", hint: "Policies or commitments that address this topic." },
  { name: "actionsTaken", label: "Actions taken", hint: "Actions taken to manage the topic and related impacts." },
  { name: "effectivenessTracking", label: "Tracking effectiveness", hint: "How you track whether those actions are working." },
  { name: "stakeholderEngagement", label: "Stakeholder engagement", hint: "How engagement with stakeholders informed the actions taken." },
];

export const GRI_IMPACT_TYPES = [
  { value: "NEGATIVE_ACTUAL", label: "Negative — already occurring" },
  { value: "NEGATIVE_POTENTIAL", label: "Negative — could occur" },
  { value: "POSITIVE_ACTUAL", label: "Positive — already occurring" },
  { value: "POSITIVE_POTENTIAL", label: "Positive — could occur" },
] as const;

export const GRI_VALUE_CHAIN_LOCATIONS = [
  { value: "OWN_OPERATIONS", label: "Own operations" },
  { value: "UPSTREAM", label: "Upstream" },
  { value: "DOWNSTREAM", label: "Downstream" },
] as const;

export const isNegativeImpact = (type: string) => type.startsWith("NEGATIVE");
export const isPotentialImpact = (type: string) => type.endsWith("_POTENTIAL");
