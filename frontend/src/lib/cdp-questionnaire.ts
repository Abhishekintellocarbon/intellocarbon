/**
 * CDP Climate Change questionnaire registry — frontend mirror.
 *
 * GENERATED from backend/src/data/cdpQuestionnaire.ts. Do not edit by hand:
 * with fourteen modules and well over a hundred questions, a hand-maintained
 * copy would drift from the backend's definitions, and a question present in
 * only one of them either fails to render or fails to save. Regenerate after
 * changing the backend registry.
 *
 * It carries only what the UI needs — codes, labels, types, options, units and
 * the reconciliation status. The readiness bands and the response index stay
 * server-side, where the judgement about the responder's position is made.
 *
 * Read the backend file before trusting a question code here. In short: CDP
 * reissues its questionnaire annually and consolidated its separate
 * questionnaires into a unified corporate questionnaire in 2024, which
 * renumbered questions away from the classic C0-C15 lettering used here, so
 * every question is PENDING_SOURCE until reconciled against a questionnaire
 * document CDP actually issued.
 */

export type CdpModulePillar = "INTRODUCTION" | "GOVERNANCE" | "STRATEGY" | "EMISSIONS" | "ENGAGEMENT" | "SIGNOFF";
export type CdpQuestionStatus = "CONFIRMED" | "PENDING_SOURCE";
export type CdpQuestionType = "narrative" | "number" | "int" | "pct" | "year" | "bool" | "currency" | "select";

export interface CdpQuestion {
  code: string;
  label: string;
  type: CdpQuestionType;
  field: string;
  status: CdpQuestionStatus;
  options?: { value: string; label: string }[];
  unit?: string;
  hint?: string;
  derived?: boolean;
  /** Resolves for every report, so the readiness indicator ignores it. */
  constant?: boolean;
}

export interface CdpModuleMeta {
  code: string;
  label: string;
  title: string;
  pillar: CdpModulePillar;
  relation: string;
  blurb: string;
  optional?: boolean;
  questions: CdpQuestion[];
}

export const CDP_MODULES: CdpModuleMeta[] = [
  {
    code: "C0",
    label: "C0",
    title: "Introduction",
    pillar: "INTRODUCTION",
    relation: "introduction",
    blurb: "Who is responding, over what reporting year, in which countries and currency, and on what consolidation basis.",
    questions: [
      { code: "C0.1", label: "Give a general description of the organization, including its business activities", type: "narrative", field: "organizationDescription", status: "PENDING_SOURCE" },
      { code: "C0.2", label: "State the start and end date of the year for which you are reporting data", type: "narrative", field: "reportingYearDescription", status: "PENDING_SOURCE", hint: "Resolved from the reporting period and your financial year start month.", derived: true, constant: true },
      { code: "C0.3", label: "Select the countries or areas in which you operate", type: "narrative", field: "countriesOfOperation", status: "PENDING_SOURCE" },
      { code: "C0.4", label: "Select the currency used for all financial information disclosed", type: "narrative", field: "reportingCurrency", status: "PENDING_SOURCE", hint: "CDP asks for a single currency across the whole response. INR unless a buyer asked otherwise." },
      { code: "C0.5", label: "Select the consolidation approach used for your emissions data", type: "select", field: "consolidationApproach", status: "PENDING_SOURCE", options: [{"value":"OPERATIONAL_CONTROL","label":"Operational control"},{"value":"FINANCIAL_CONTROL","label":"Financial control"},{"value":"EQUITY_SHARE","label":"Equity share"}], hint: "This must match the boundary the Scope 1 and 2 figures were compiled on." },
      { code: "C0.6", label: "State the organizational boundary covered by this response", type: "narrative", field: "organizationalBoundary", status: "PENDING_SOURCE", hint: "This response is prepared per facility. State clearly whether the figures are facility-level or group-level." },
    ],
  },
  {
    code: "C1",
    label: "C1",
    title: "Governance",
    pillar: "GOVERNANCE",
    relation: "governance",
    blurb: "Board-level oversight of climate issues, management responsibility below board level, and climate-linked incentives.",
    questions: [
      { code: "C1.1", label: "Is there board-level oversight of climate-related issues within your organization?", type: "bool", field: "boardOversight", status: "PENDING_SOURCE" },
      { code: "C1.1a", label: "Identify the position(s) or committee(s) with board-level responsibility for climate-related issues", type: "narrative", field: "boardOversightPosition", status: "PENDING_SOURCE" },
      { code: "C1.1b", label: "Provide further details on the board's oversight of climate-related issues", type: "narrative", field: "boardOversightDetail", status: "PENDING_SOURCE", hint: "How climate is integrated into board business — which agenda items, and with what frequency." },
      { code: "C1.1c", label: "Frequency with which climate-related issues are a scheduled agenda item", type: "select", field: "boardReviewFrequency", status: "PENDING_SOURCE", options: [{"value":"EVERY_MEETING","label":"Scheduled — all meetings"},{"value":"SOME_MEETINGS","label":"Scheduled — some meetings"},{"value":"AS_IMPORTANT","label":"Some meetings — as important matters arise"},{"value":"NOT_SCHEDULED","label":"Not a scheduled agenda item"}] },
      { code: "C1.2", label: "Provide the highest management-level position(s) with responsibility for climate-related issues", type: "narrative", field: "managementResponsibility", status: "PENDING_SOURCE" },
      { code: "C1.2a", label: "Describe where in the organizational structure this position sits and how it reports to the board", type: "narrative", field: "managementReportingLine", status: "PENDING_SOURCE" },
      { code: "C1.3", label: "Do you provide incentives for the management of climate-related issues?", type: "bool", field: "climateIncentives", status: "PENDING_SOURCE" },
      { code: "C1.3a", label: "Provide further details on the incentives provided", type: "narrative", field: "climateIncentivesDetail", status: "PENDING_SOURCE", hint: "Who is entitled, what type of incentive, and which climate metric it is tied to." },
    ],
  },
  {
    code: "C2",
    label: "C2",
    title: "Risks and opportunities",
    pillar: "STRATEGY",
    relation: "risksOpportunities",
    blurb: "How climate risks and opportunities are identified and assessed, over what time horizons, and which ones could have a substantive financial effect.",
    questions: [
      { code: "C2.1", label: "Does your organization have a process for identifying, assessing and responding to climate-related risks and opportunities?", type: "bool", field: "hasRiskProcess", status: "PENDING_SOURCE" },
      { code: "C2.1a", label: "How does your organization define short-, medium- and long-term time horizons?", type: "narrative", field: "timeHorizonDefinition", status: "PENDING_SOURCE" },
      { code: "C2.1b", label: "Short-term horizon — to (years from reporting year)", type: "int", field: "shortTermYears", status: "PENDING_SOURCE", unit: "years" },
      { code: "C2.1c", label: "Medium-term horizon — to (years from reporting year)", type: "int", field: "mediumTermYears", status: "PENDING_SOURCE", unit: "years" },
      { code: "C2.1d", label: "Long-term horizon — to (years from reporting year)", type: "int", field: "longTermYears", status: "PENDING_SOURCE", unit: "years" },
      { code: "C2.1e", label: "How does your organization define substantive financial or strategic impact?", type: "narrative", field: "substantiveImpactDefinition", status: "PENDING_SOURCE", hint: "CDP expects a stated quantitative threshold where you have one — for example a currency figure or a share of EBITDA." },
      { code: "C2.2", label: "Describe your process for identifying, assessing and responding to climate-related risks and opportunities", type: "narrative", field: "riskProcessDescription", status: "PENDING_SOURCE", hint: "Cover frequency, coverage (which parts of the business and value chain), and how the process integrates with wider enterprise risk management." },
      { code: "C2.2a", label: "Is your risk assessment process integrated into multi-disciplinary company-wide risk management?", type: "bool", field: "riskProcessIntegrated", status: "PENDING_SOURCE" },
      { code: "C2.3", label: "Have you identified any inherent climate-related risks with the potential to have a substantive financial or strategic impact?", type: "bool", field: "hasSubstantiveRisks", status: "PENDING_SOURCE", hint: "The risks themselves are entered as rows below rather than as free text." },
      { code: "C2.4", label: "Have you identified any climate-related opportunities with the potential to have a substantive financial or strategic impact?", type: "bool", field: "hasSubstantiveOpportunities", status: "PENDING_SOURCE" },
      { code: "C2.5", label: "Describe any climate-related risks and opportunities that had a substantive effect in the reporting year", type: "narrative", field: "realizedImpacts", status: "PENDING_SOURCE" },
    ],
  },
  {
    code: "C3",
    label: "C3",
    title: "Business strategy",
    pillar: "STRATEGY",
    relation: "businessStrategy",
    blurb: "Transition plan, climate scenario analysis, and how climate influences strategy and financial planning.",
    questions: [
      { code: "C3.1", label: "Does your organization have a climate transition plan that aligns with a 1.5°C world?", type: "select", field: "transitionPlan", status: "PENDING_SOURCE", options: [{"value":"YES","label":"Yes"},{"value":"NO","label":"No"},{"value":"PLANNED","label":"No, but we plan to within the next two years"}] },
      { code: "C3.1a", label: "Describe the transition plan and how it is reviewed", type: "narrative", field: "transitionPlanDetail", status: "PENDING_SOURCE" },
      { code: "C3.2", label: "Does your organization use climate-related scenario analysis to inform its strategy?", type: "select", field: "usesScenarioAnalysis", status: "PENDING_SOURCE", options: [{"value":"YES","label":"Yes"},{"value":"NO","label":"No"},{"value":"PLANNED","label":"No, but we plan to within the next two years"}] },
      { code: "C3.2a", label: "Which climate scenarios were used, and over what time horizons?", type: "narrative", field: "scenariosUsed", status: "PENDING_SOURCE", hint: "Name the scenarios rather than describing them generically — e.g. IEA Net Zero Emissions by 2050, IEA STEPS, IPCC SSP1-2.6, SSP5-8.5." },
      { code: "C3.2b", label: "Describe the results of the scenario analysis and how they informed strategy", type: "narrative", field: "scenarioResults", status: "PENDING_SOURCE" },
      { code: "C3.3", label: "Describe where and how climate-related risks and opportunities have influenced your strategy", type: "narrative", field: "strategyInfluence", status: "PENDING_SOURCE", hint: "CDP expects this broken down across products and services, supply chain, R&D and operations." },
      { code: "C3.4", label: "Describe where and how climate-related risks and opportunities have influenced your financial planning", type: "narrative", field: "financialPlanningInfluence", status: "PENDING_SOURCE" },
      { code: "C3.5", label: "Capital expenditure aligned to low-carbon activities in the reporting year", type: "currency", field: "lowCarbonCapex", status: "PENDING_SOURCE", hint: "In the currency stated at C0.4." },
      { code: "C3.6", label: "Share of total capital expenditure aligned to low-carbon activities", type: "pct", field: "lowCarbonCapexPct", status: "PENDING_SOURCE", unit: "%" },
    ],
  },
  {
    code: "C4",
    label: "C4",
    title: "Targets and performance",
    pillar: "STRATEGY",
    relation: "targetsPerformance",
    blurb: "Emissions reduction targets (absolute and intensity), other climate targets, and the initiatives delivering against them.",
    questions: [
      { code: "C4.1", label: "Did you have an emissions target that was active in the reporting year?", type: "select", field: "targetType", status: "PENDING_SOURCE", options: [{"value":"ABSOLUTE","label":"Absolute target"},{"value":"INTENSITY","label":"Intensity target"},{"value":"BOTH","label":"Both absolute and intensity targets"},{"value":"NONE","label":"No target"}], hint: "The targets themselves are entered as rows below." },
      { code: "C4.1a", label: "Is any target validated by the Science Based Targets initiative (SBTi)?", type: "bool", field: "sbtiValidated", status: "PENDING_SOURCE", hint: "Only answer yes where SBTi has actually validated the target. An intention to submit is not a validation." },
      { code: "C4.1b", label: "Describe the SBTi validation status, including the date and the target ambition validated", type: "narrative", field: "sbtiDetail", status: "PENDING_SOURCE" },
      { code: "C4.2", label: "Did you have any other climate-related targets active in the reporting year?", type: "narrative", field: "otherTargets", status: "PENDING_SOURCE", hint: "For example renewable electricity share, energy efficiency, or a net-zero commitment year." },
      { code: "C4.3", label: "Did you have emissions reduction initiatives active in the reporting year?", type: "bool", field: "hasInitiatives", status: "PENDING_SOURCE" },
      { code: "C4.3a", label: "Number of emissions reduction initiatives active in the reporting year", type: "int", field: "initiativeCount", status: "PENDING_SOURCE" },
      { code: "C4.3b", label: "Total estimated annual CO2e savings from initiatives active in the reporting year", type: "number", field: "initiativeSavingsTco2e", status: "PENDING_SOURCE", unit: "tCO2e" },
      { code: "C4.3c", label: "Describe the initiatives and the methods used to drive investment in them", type: "narrative", field: "initiativeDetail", status: "PENDING_SOURCE" },
      { code: "C4.5", label: "Do you classify any of your products or services as low-carbon?", type: "narrative", field: "lowCarbonProducts", status: "PENDING_SOURCE" },
    ],
  },
  {
    code: "C5",
    label: "C5",
    title: "Emissions methodology",
    pillar: "EMISSIONS",
    relation: "emissionsMethodology",
    blurb: "Base year, base year emissions, the standards and protocols applied, and the global warming potential source used.",
    questions: [
      { code: "C5.1", label: "Base year for your emissions target and performance tracking", type: "year", field: "baseYear", status: "PENDING_SOURCE" },
      { code: "C5.1a", label: "Base year Scope 1 emissions", type: "number", field: "baseYearScope1Tco2e", status: "PENDING_SOURCE", unit: "tCO2e" },
      { code: "C5.1b", label: "Base year Scope 2 emissions, location-based", type: "number", field: "baseYearScope2LocationTco2e", status: "PENDING_SOURCE", unit: "tCO2e" },
      { code: "C5.1c", label: "Base year Scope 2 emissions, market-based", type: "number", field: "baseYearScope2MarketTco2e", status: "PENDING_SOURCE", unit: "tCO2e" },
      { code: "C5.1d", label: "Base year Scope 3 emissions", type: "number", field: "baseYearScope3Tco2e", status: "PENDING_SOURCE", unit: "tCO2e" },
      { code: "C5.2", label: "Select the standards, protocols and methodologies used to collect activity data and calculate emissions", type: "narrative", field: "standardsUsed", status: "PENDING_SOURCE", hint: "For example the GHG Protocol Corporate Accounting and Reporting Standard, and ISO 14064-1." },
      { code: "C5.3", label: "Global warming potential source applied", type: "select", field: "gwpSource", status: "PENDING_SOURCE", options: [{"value":"AR5","label":"IPCC Fifth Assessment Report (AR5, 100-year)"},{"value":"AR6","label":"IPCC Sixth Assessment Report (AR6, 100-year)"},{"value":"AR4","label":"IPCC Fourth Assessment Report (AR4, 100-year)"}], hint: "The figures reused into C6 are computed on the AR5 basis, which is the GHG Protocol convention CDP expects — deliberately distinct from the AR2/BUR3 basis India's CCTS requires on the same records." },
      { code: "C5.4", label: "Describe any structural change, base year recalculation or restatement made in the reporting year", type: "narrative", field: "baseYearRecalculation", status: "PENDING_SOURCE" },
    ],
  },
  {
    code: "C6",
    label: "C6",
    title: "Emissions data",
    pillar: "EMISSIONS",
    relation: "emissionsData",
    blurb: "Gross global Scope 1, Scope 2 on both accounting approaches, Scope 3 by category, and emissions intensity.",
    questions: [
      { code: "C6.1", label: "Gross global Scope 1 emissions", type: "number", field: "scope1Tco2e", status: "PENDING_SOURCE", unit: "tCO2e", hint: "Reused from this facility's submitted activity data on the IPCC AR5 basis.", derived: true },
      { code: "C6.1a", label: "Describe your gross global Scope 1 emissions and the sources included", type: "narrative", field: "scope1Description", status: "PENDING_SOURCE" },
      { code: "C6.2", label: "Scope 2 accounting approach applied", type: "select", field: "scope2Approach", status: "PENDING_SOURCE", options: [{"value":"LOCATION","label":"Location-based only"},{"value":"MARKET","label":"Market-based only"},{"value":"BOTH","label":"Both location-based and market-based"}] },
      { code: "C6.3", label: "Gross global Scope 2 emissions, location-based", type: "number", field: "scope2LocationTco2e", status: "PENDING_SOURCE", unit: "tCO2e", hint: "Reused from grid electricity and imported steam in this facility's activity data.", derived: true },
      { code: "C6.3a", label: "Gross global Scope 2 emissions, market-based", type: "number", field: "scope2MarketTco2e", status: "PENDING_SOURCE", unit: "tCO2e", hint: "Entered manually — a market-based figure needs supplier-specific or residual-mix factors the platform does not hold." },
      { code: "C6.4", label: "Are there any sources within your boundary that are not included in your disclosure?", type: "narrative", field: "exclusions", status: "PENDING_SOURCE", hint: "State the source, the reason for exclusion, and its estimated size. CDP treats a silent exclusion far more harshly than a disclosed one." },
      { code: "C6.5", label: "Account for your Scope 3 emissions by category", type: "number", field: "scope3Tco2e", status: "PENDING_SOURCE", unit: "tCO2e", hint: "Rolled up from submitted Scope 3 value-chain entries. The per-category breakdown is generated into the report automatically.", derived: true },
      { code: "C6.5a", label: "Explain the Scope 3 categories evaluated, and the basis for any judged not relevant", type: "narrative", field: "scope3Description", status: "PENDING_SOURCE" },
      { code: "C6.7", label: "Are carbon dioxide emissions from biogenic carbon relevant to your organization?", type: "number", field: "biogenicCo2Tonnes", status: "PENDING_SOURCE", unit: "t CO2" },
      { code: "C6.10", label: "Gross global combined Scope 1 and 2 emissions per unit of revenue", type: "number", field: "intensityPerRevenue", status: "PENDING_SOURCE", unit: "tCO2e/unit revenue", hint: "Calculated from the revenue figure entered on this report.", derived: true },
      { code: "C6.10a", label: "Describe any other intensity metric you track", type: "narrative", field: "otherIntensityMetric", status: "PENDING_SOURCE" },
    ],
  },
  {
    code: "C7",
    label: "C7",
    title: "Emissions breakdown",
    pillar: "EMISSIONS",
    relation: "emissionsBreakdownModule",
    blurb: "Scope 1 broken down by greenhouse gas, and Scope 1 and 2 broken down by country, business division and activity.",
    questions: [
      { code: "C7.1", label: "Does your organization break down its Scope 1 emissions by greenhouse gas type?", type: "bool", field: "breakdownByGas", status: "PENDING_SOURCE", hint: "The per-gas figures are entered as rows below." },
      { code: "C7.2", label: "Break down your total gross global Scope 1 emissions by country or area", type: "narrative", field: "breakdownByCountryNote", status: "PENDING_SOURCE", hint: "Entered as rows below. Use this field for anything the rows cannot express." },
      { code: "C7.3", label: "Indicate which other groupings you are able to provide a Scope 1 breakdown for", type: "narrative", field: "breakdownByDivisionNote", status: "PENDING_SOURCE", hint: "CDP accepts business division, facility, and activity. Entered as rows below." },
      { code: "C7.5", label: "Break down your total gross global Scope 2 emissions by country or area", type: "narrative", field: "scope2BreakdownNote", status: "PENDING_SOURCE" },
      { code: "C7.9", label: "How do your gross global emissions for the reporting year compare with the previous year?", type: "select", field: "yearOnYearDirection", status: "PENDING_SOURCE", options: [{"value":"DECREASED","label":"Decreased"},{"value":"INCREASED","label":"Increased"},{"value":"SAME","label":"About the same"},{"value":"FIRST_YEAR","label":"This is our first year of reporting"}] },
      { code: "C7.9a", label: "Identify the reasons for the change and quantify the effect of each", type: "narrative", field: "yearOnYearExplanation", status: "PENDING_SOURCE", hint: "CDP asks for change attributed to each driver separately — emissions reduction activities, divestment, acquisitions, output change, methodology change." },
    ],
  },
  {
    code: "C8",
    label: "C8",
    title: "Energy",
    pillar: "EMISSIONS",
    relation: "energy",
    blurb: "Energy consumption by carrier, the renewable and non-renewable split, and energy generated on site.",
    questions: [
      { code: "C8.1", label: "What percentage of your total operational spend in the reporting year was on energy?", type: "pct", field: "energySpendPct", status: "PENDING_SOURCE", unit: "%" },
      { code: "C8.2", label: "Select which energy-related activities your organization has undertaken", type: "narrative", field: "energyActivities", status: "PENDING_SOURCE", hint: "For example consumption of fuel, purchased electricity, purchased heat or steam, and generation of electricity on site." },
      { code: "C8.2a", label: "Total energy consumption", type: "number", field: "totalEnergyMwh", status: "PENDING_SOURCE", unit: "MWh", hint: "Electricity and imported steam reused from activity data. Fuel energy is entered below.", derived: true },
      { code: "C8.2b", label: "Consumption of purchased electricity", type: "number", field: "purchasedElectricityMwh", status: "PENDING_SOURCE", unit: "MWh", derived: true },
      { code: "C8.2c", label: "Consumption of renewable electricity", type: "number", field: "renewableElectricityMwh", status: "PENDING_SOURCE", unit: "MWh", derived: true },
      { code: "C8.2d", label: "Consumption of fuel, excluding feedstock", type: "number", field: "fuelConsumptionMwh", status: "PENDING_SOURCE", unit: "MWh" },
      { code: "C8.2e", label: "Consumption of purchased heat, steam and cooling", type: "number", field: "purchasedSteamMwh", status: "PENDING_SOURCE", unit: "MWh", hint: "Imported steam from activity data, converted at 3.6 GJ per MWh.", derived: true },
      { code: "C8.2f", label: "Total electricity generated on site", type: "number", field: "electricityGeneratedMwh", status: "PENDING_SOURCE", unit: "MWh" },
      { code: "C8.2g", label: "Of which generated from renewable sources", type: "number", field: "renewableGeneratedMwh", status: "PENDING_SOURCE", unit: "MWh" },
      { code: "C8.2h", label: "Share of total energy consumption from renewable sources", type: "pct", field: "renewableSharePct", status: "PENDING_SOURCE", unit: "%", derived: true },
      { code: "C8.3", label: "Describe how you are increasing your low-carbon energy consumption", type: "narrative", field: "lowCarbonEnergyPlan", status: "PENDING_SOURCE" },
    ],
  },
  {
    code: "C9",
    label: "C9",
    title: "Additional metrics",
    pillar: "EMISSIONS",
    relation: "additionalMetrics",
    blurb: "Optional and sector-specific metrics. CDP issues these based on the responding company's sector — leave blank unless your buyer asked for them.",
    optional: true,
    questions: [
      { code: "C9.1", label: "Provide any additional climate-related metrics relevant to your business", type: "narrative", field: "additionalMetrics", status: "PENDING_SOURCE" },
      { code: "C9.1a", label: "Sector-specific metric — name", type: "narrative", field: "sectorMetricName", status: "PENDING_SOURCE", hint: "CDP issues sector-specific questions only to companies in the sectors they apply to. If you were not asked for one, leave this blank." },
      { code: "C9.1b", label: "Sector-specific metric — value", type: "number", field: "sectorMetricValue", status: "PENDING_SOURCE" },
      { code: "C9.1c", label: "Sector-specific metric — unit", type: "narrative", field: "sectorMetricUnit", status: "PENDING_SOURCE" },
      { code: "C9.2", label: "Waste generated in the reporting year", type: "number", field: "wasteGeneratedTonnes", status: "PENDING_SOURCE", unit: "t", hint: "Reused from the GRI 306 waste disclosure for the same period where one exists.", derived: true },
      { code: "C9.3", label: "Water withdrawn in the reporting year", type: "number", field: "waterWithdrawalM3", status: "PENDING_SOURCE", unit: "m3", hint: "Reused from the ISO 14046 water inventory where one exists.", derived: true },
    ],
  },
  {
    code: "C10",
    label: "C10",
    title: "Verification",
    pillar: "EMISSIONS",
    relation: "verification",
    blurb: "Third-party verification or assurance of the emissions data disclosed, and the standard it was carried out under.",
    questions: [
      { code: "C10.1", label: "Indicate the verification or assurance status that applies to your Scope 1 emissions", type: "select", field: "scope1Assurance", status: "PENDING_SOURCE", options: [{"value":"NONE","label":"No third-party verification or assurance"},{"value":"LIMITED","label":"Limited assurance"},{"value":"REASONABLE","label":"Reasonable assurance"},{"value":"HIGH","label":"High assurance"}] },
      { code: "C10.1a", label: "Verification or assurance status of your Scope 2 emissions", type: "select", field: "scope2Assurance", status: "PENDING_SOURCE", options: [{"value":"NONE","label":"No third-party verification or assurance"},{"value":"LIMITED","label":"Limited assurance"},{"value":"REASONABLE","label":"Reasonable assurance"},{"value":"HIGH","label":"High assurance"}] },
      { code: "C10.1b", label: "Verification or assurance status of your Scope 3 emissions", type: "select", field: "scope3Assurance", status: "PENDING_SOURCE", options: [{"value":"NONE","label":"No third-party verification or assurance"},{"value":"LIMITED","label":"Limited assurance"},{"value":"REASONABLE","label":"Reasonable assurance"},{"value":"HIGH","label":"High assurance"}] },
      { code: "C10.1c", label: "Name of the verification or assurance provider", type: "narrative", field: "assuranceProvider", status: "PENDING_SOURCE" },
      { code: "C10.1d", label: "Standard the verification was carried out under", type: "narrative", field: "assuranceStandard", status: "PENDING_SOURCE", hint: "For example ISO 14064-3, ISAE 3000 (Revised), or a national equivalent." },
      { code: "C10.1e", label: "Date the assurance statement was issued", type: "year", field: "assuranceYear", status: "PENDING_SOURCE" },
      { code: "C10.2", label: "Do you verify any other climate-related information reported in this response?", type: "narrative", field: "otherVerification", status: "PENDING_SOURCE" },
      { code: "C10.3", label: "Describe the scope of the assurance engagement and any qualifications in the opinion", type: "narrative", field: "assuranceScope", status: "PENDING_SOURCE" },
    ],
  },
  {
    code: "C11",
    label: "C11",
    title: "Carbon pricing",
    pillar: "STRATEGY",
    relation: "carbonPricing",
    blurb: "Exposure to carbon pricing regulation, use of carbon credits, and any internal price on carbon applied.",
    questions: [
      { code: "C11.1", label: "Are any of your operations or activities regulated by a carbon pricing system?", type: "bool", field: "regulatedByCarbonPricing", status: "PENDING_SOURCE", hint: "The platform pre-fills what it can see from your CBAM and CCTS records, but you must confirm it — coverage depends on entity-level facts the platform does not hold." },
      { code: "C11.1a", label: "Select the carbon pricing regulations that apply to your operations", type: "narrative", field: "carbonPricingSystems", status: "PENDING_SOURCE", hint: "For example the EU Emissions Trading System, the EU or UK Carbon Border Adjustment Mechanism, or India's Carbon Credit Trading Scheme." },
      { code: "C11.1b", label: "Emissions covered by a carbon pricing system in the reporting year", type: "number", field: "coveredEmissionsTco2e", status: "PENDING_SOURCE", unit: "tCO2e" },
      { code: "C11.1c", label: "Describe your strategy for complying with the systems you are regulated by", type: "narrative", field: "carbonPricingStrategy", status: "PENDING_SOURCE" },
      { code: "C11.2", label: "Has your organization originated or purchased any project-based carbon credits?", type: "bool", field: "usesCarbonCredits", status: "PENDING_SOURCE" },
      { code: "C11.2a", label: "Carbon credits cancelled or retired in the reporting year", type: "number", field: "creditsCancelledTco2e", status: "PENDING_SOURCE", unit: "tCO2e", hint: "Reused from the voluntary offsets log.", derived: true },
      { code: "C11.2b", label: "Describe the projects, standards and vintages of the credits used", type: "narrative", field: "carbonCreditsDetail", status: "PENDING_SOURCE" },
      { code: "C11.3", label: "Does your organization use an internal price on carbon?", type: "select", field: "usesInternalCarbonPrice", status: "PENDING_SOURCE", options: [{"value":"YES","label":"Yes"},{"value":"NO","label":"No"},{"value":"PLANNED","label":"No, but we plan to within the next two years"}] },
      { code: "C11.3a", label: "Type of internal carbon price applied", type: "select", field: "internalPriceType", status: "PENDING_SOURCE", options: [{"value":"SHADOW_PRICE","label":"Shadow price"},{"value":"INTERNAL_FEE","label":"Internal fee or carbon charge"},{"value":"IMPLICIT_PRICE","label":"Implicit price"},{"value":"OFFSET_PRICE","label":"Offset price"}] },
      { code: "C11.3b", label: "Internal carbon price applied", type: "currency", field: "internalCarbonPrice", status: "PENDING_SOURCE", hint: "In the currency stated at C0.4, per tonne of CO2e." },
      { code: "C11.3c", label: "Describe how the internal carbon price is used in business decisions", type: "narrative", field: "internalPriceApplication", status: "PENDING_SOURCE" },
    ],
  },
  {
    code: "C12",
    label: "C12",
    title: "Engagement",
    pillar: "ENGAGEMENT",
    relation: "engagement",
    blurb: "Climate engagement with suppliers, customers and other value chain partners, plus policy engagement and public reporting.",
    questions: [
      { code: "C12.1", label: "Do you engage with your value chain on climate-related issues?", type: "bool", field: "engagesValueChain", status: "PENDING_SOURCE" },
      { code: "C12.1a", label: "Describe your climate-related supplier engagement strategy", type: "narrative", field: "supplierEngagement", status: "PENDING_SOURCE", hint: "CDP asks what proportion of suppliers you engage, by what method, and what the measured outcome was." },
      { code: "C12.1b", label: "Percentage of suppliers, by number, engaged on climate in the reporting year", type: "pct", field: "suppliersEngagedPct", status: "PENDING_SOURCE", unit: "%" },
      { code: "C12.1c", label: "Percentage of total Scope 3 emissions covered by your supplier engagement", type: "pct", field: "scope3CoveredByEngagementPct", status: "PENDING_SOURCE", unit: "%" },
      { code: "C12.1d", label: "Describe your climate-related engagement with customers and other partners", type: "narrative", field: "customerEngagement", status: "PENDING_SOURCE" },
      { code: "C12.2", label: "Do you include climate-related requirements in your supplier contracts or code of conduct?", type: "bool", field: "supplierRequirements", status: "PENDING_SOURCE" },
      { code: "C12.3", label: "Do you engage in activities that could directly or indirectly influence climate policy?", type: "bool", field: "policyEngagement", status: "PENDING_SOURCE" },
      { code: "C12.3a", label: "Describe your policy engagement, including any trade associations, and how it aligns with your climate strategy", type: "narrative", field: "policyEngagementDetail", status: "PENDING_SOURCE" },
      { code: "C12.4", label: "Publications in which you report climate-related information", type: "narrative", field: "publications", status: "PENDING_SOURCE", hint: "For example an annual report, a sustainability report, or a BRSR or ESRS filing prepared elsewhere on this platform." },
    ],
  },
  {
    code: "C15",
    label: "C15",
    title: "Sign off",
    pillar: "SIGNOFF",
    relation: "signoff",
    blurb: "The person submitting the response on the organization's behalf, and any final statement.",
    questions: [
      { code: "C15.1", label: "Job title of the person submitting this response", type: "narrative", field: "submitterJobTitle", status: "PENDING_SOURCE" },
      { code: "C15.1a", label: "Corresponding job category", type: "select", field: "submitterJobCategory", status: "PENDING_SOURCE", options: [{"value":"BOARD_CHAIR","label":"Board chair"},{"value":"BOARD_MEMBER","label":"Board or executive board member"},{"value":"CEO","label":"Chief Executive Officer"},{"value":"CFO","label":"Chief Financial Officer"},{"value":"CSO","label":"Chief Sustainability Officer"},{"value":"OTHER_C_SUITE","label":"Other C-suite officer"},{"value":"SUSTAINABILITY_MANAGER","label":"Environment or sustainability manager"},{"value":"OTHER","label":"Other, please specify"}] },
      { code: "C15.2", label: "Provide any final statement to accompany this response", type: "narrative", field: "finalStatement", status: "PENDING_SOURCE" },
    ],
  },
];

export const CDP_MODULE_CODES = CDP_MODULES.map((m) => m.code);

const MODULE_BY_CODE = new Map(CDP_MODULES.map((m) => [m.code, m]));

export const getCdpModule = (code: string): CdpModuleMeta | undefined => MODULE_BY_CODE.get(code);

export const CDP_TOTAL_QUESTION_COUNT = CDP_MODULES.reduce((sum, m) => sum + m.questions.length, 0);

export const CDP_CONFIRMED_QUESTION_COUNT = CDP_MODULES.reduce(
  (sum, m) => sum + m.questions.filter((q) => q.status === "CONFIRMED").length,
  0,
);

export const CDP_REGISTRY_RECONCILED = CDP_CONFIRMED_QUESTION_COUNT === CDP_TOTAL_QUESTION_COUNT;

// The three notices that keep this module honest about what CDP is. Shown
// wherever CDP is offered, for the same reason the Omnibus thresholds are
// shown wherever CSRD is.
export const CDP_APPLICABILITY_NOTICE = "CDP disclosure is voluntary and buyer-driven. It is not a legal or regulatory obligation, there is no statutory deadline, and no government body enforces it. Companies respond because a specific customer or investor asked them to — typically a large buyer running a supply chain climate programme, or an asset manager screening a portfolio. Check the exact scope, questionnaire version and deadline with whoever requested your response: those are set by CDP and by the requesting organization, not by this platform.";
export const CDP_SUBMISSION_NOTICE = "This report prepares your CDP response — it does not submit it. CDP responses are filed through CDP's own online response platform, against the questionnaire CDP issues to your organization for the relevant disclosure year. There is no PDF upload route. This document is ordered to match the questionnaire's module structure so answers can be transferred across, and question numbering should be checked against the questionnaire you were issued.";
export const CDP_SCORING_NOTICE = "CDP scores responses from A to D- using its own methodology, applied by CDP to the response submitted on its platform. This report does not predict, estimate or replicate that score. The bands shown here are an internal readiness indicator based on how completely each module has been answered and whether it is backed by real targets and third-party verification. A Strong band means the module is well prepared for submission. It is not a CDP grade and carries no relationship to one.";

export const CDP_MATURITY_BANDS = ["NOT_STARTED", "DEVELOPING", "ESTABLISHED", "STRONG"] as const;

export type CdpMaturityBand = (typeof CDP_MATURITY_BANDS)[number];

export const CDP_MATURITY_BAND_LABELS: Record<CdpMaturityBand, string> = {"NOT_STARTED":"Not started","DEVELOPING":"Developing","ESTABLISHED":"Established","STRONG":"Strong"};

export const CDP_MATURITY_BAND_DESCRIPTIONS: Record<CdpMaturityBand, string> = {"NOT_STARTED":"Nothing has been entered for this module yet.","DEVELOPING":"Partially answered, or answered without the supporting evidence CDP asks for.","ESTABLISHED":"Most questions answered with substantive content.","STRONG":"Answered in full, with the supporting evidence CDP asks for."};

export const CDP_RISK_KINDS = [
  { value: "RISK", label: "Risk" },
  { value: "OPPORTUNITY", label: "Opportunity" },
] as const;

export const CDP_TIME_HORIZONS = [
  { value: "SHORT_TERM", label: "Short term" },
  { value: "MEDIUM_TERM", label: "Medium term" },
  { value: "LONG_TERM", label: "Long term" },
] as const;

export const CDP_TARGET_KINDS = [
  { value: "ABSOLUTE", label: "Absolute target" },
  { value: "INTENSITY", label: "Intensity target" },
] as const;

export const CDP_BREAKDOWN_DIMENSIONS = [
  { value: "GAS", label: "By greenhouse gas" },
  { value: "COUNTRY", label: "By country or area" },
  { value: "BUSINESS_DIVISION", label: "By business division" },
  { value: "ACTIVITY", label: "By activity" },
] as const;

export const CDP_BREAKDOWN_SCOPES = [
  { value: "SCOPE_1", label: "Scope 1" },
  { value: "SCOPE_2", label: "Scope 2" },
] as const;

