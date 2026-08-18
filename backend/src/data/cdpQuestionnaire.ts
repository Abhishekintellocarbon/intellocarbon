/**
 * CDP Climate Change questionnaire registry — the single source of truth for
 * which modules and questions this platform captures. Everything downstream
 * reads this file rather than hardcoding question codes: the maturity
 * indicator, the response index, the PDF, and the frontend's form grouping.
 * Same role esrsStandards.ts plays for CSRD and griStandards.ts for GRI.
 *
 * ===========================================================================
 * WHAT CDP IS — read before writing any user-facing copy against this module.
 *
 * CDP is NOT a government mandate. It is a voluntary disclosure system run by
 * a non-profit, and a company fills it in because a specific customer or
 * investor asked it to — a multinational retailer, an automotive OEM, a tech
 * buyer, an asset manager running a portfolio screen. There is no statutory
 * deadline, no regulator, and no penalty for not responding. What there is, is
 * a commercial consequence: a buyer that requested a response and did not get
 * one may score the supplier down or drop them from a tender.
 *
 * That distinction has to survive into every surface this module touches. The
 * platform correctly refused to imply CSRD applicability to companies below
 * the Omnibus thresholds; the equivalent failure here would be implying CDP is
 * a compliance obligation. It is not. See CDP_APPLICABILITY_NOTICE.
 *
 * A second limitation is structural rather than editorial: CDP responses are
 * submitted through CDP's own online response platform, against the
 * questionnaire CDP issues to that specific responding company. There is no
 * PDF upload route and no public API this platform can post to. This module
 * therefore PREPARES a response — it does not file one. The generated report
 * is a transfer document, ordered to match the questionnaire so answers can be
 * copied across. See CDP_SUBMISSION_NOTICE.
 *
 * ===========================================================================
 * VERSION AND PROVENANCE — read before adding or trusting a question.
 *
 * CDP reissues its questionnaire annually, and in 2024 consolidated the
 * previously separate climate change, water security and forests
 * questionnaires into a single unified corporate questionnaire, restructured
 * around IFRS S2 / TCFD. That consolidation renumbered questions away from the
 * classic "C0 … C15" climate-change lettering.
 *
 * The module structure below deliberately follows the CLASSIC climate change
 * questionnaire lettering (C0 Introduction through C15 Sign off), because that
 * is the structure buyers and consultants still name when they ask a supplier
 * for "the CDP climate questionnaire", and it is the structure this module was
 * specified against. It is a faithful map of the subject matter CDP asks
 * about. It is NOT a claim to be byte-identical to whichever questionnaire
 * version CDP has issued to any particular responding company this year.
 *
 * Accordingly every question carries an explicit `status`:
 *
 *   CONFIRMED      - reconciled against the CDP questionnaire version named in
 *                    CDP_QUESTIONNAIRE_VERSION.
 *   PENDING_SOURCE - subject matter and question shape carried from the
 *                    classic climate change questionnaire, NOT reconciled
 *                    against a published CDP questionnaire document.
 *
 * Nothing here is CONFIRMED. As with the ESRS registry, that is treated as a
 * first-class state rather than a footnote: the response index prints the
 * reconciliation status, the report says the numbering may not match the
 * questionnaire the responder was actually issued, and the UI says so too.
 *
 * TO POPULATE: obtain the questionnaire CDP issued for the relevant disclosure
 * year, work through it module by module, and set each question's `status` to
 * CONFIRMED only after correcting its code and wording against that document.
 * Do not flip a status without having read the source — the entire value of
 * the flag is that it is only ever set by someone who checked.
 *
 * ===========================================================================
 * SCORING — what this module deliberately does NOT do.
 *
 * CDP scores responses A through D- (and F for non-disclosure) using its own
 * methodology, applied by CDP to the response actually submitted on its
 * platform. That methodology is CDP's, it changes between cycles, and it
 * weighs things this platform cannot see. Predicting a CDP score from data
 * held here would be a fabricated number wearing a real scale's clothes.
 *
 * What this module produces instead is an internal completeness and maturity
 * band per module — Not Started / Developing / Established / Strong — derived
 * from how much of the module has real content behind it. It is directional
 * preparation feedback, it is labelled as such everywhere it appears, and it
 * is never expressed on CDP's A-to-D- scale. See cdpMaturity.service.ts.
 * ===========================================================================
 */

export type CdpModulePillar = "INTRODUCTION" | "GOVERNANCE" | "STRATEGY" | "EMISSIONS" | "ENGAGEMENT" | "SIGNOFF";

/** Whether a question has been reconciled against a published CDP questionnaire. */
export type CdpQuestionStatus = "CONFIRMED" | "PENDING_SOURCE";

/** How a question's value is captured, which also decides how the form renders it. */
export type CdpQuestionType = "narrative" | "number" | "int" | "pct" | "year" | "bool" | "currency" | "select";

export interface CdpQuestion {
  /** CDP question reference, e.g. "C6.1". */
  code: string;
  label: string;
  type: CdpQuestionType;
  /** Stored column on the module's disclosure table. */
  field: string;
  status: CdpQuestionStatus;
  /** Fixed options, for `select` questions. CDP uses closed option lists heavily. */
  options?: { value: string; label: string }[];
  unit?: string;
  hint?: string;
  /**
   * True where the value comes from data the platform already holds — the
   * emissions engine, activity data, the Scope 3 module — rather than being
   * typed in. The response index flags these so a reviewer can see which
   * figures were calculated and which were asserted.
   */
  derived?: boolean;
  /**
   * A derived question that resolves for EVERY report, because it depends only
   * on the report existing rather than on any data behind it. C0.2's reporting
   * window is the only one today.
   *
   * It has to be distinguished from an ordinary derived question because it
   * carries no signal. Counted normally it would make an untouched module
   * report as started and lift every response's completeness off zero — the
   * opposite of what a readiness indicator is for. The maturity indicator
   * therefore ignores these entirely; the response index still lists them,
   * because the transfer into CDP's platform genuinely needs the dates.
   */
  constant?: boolean;
  /**
   * A narrative question whose valid answers are legitimately brief — a
   * currency code, a country, a job title, a unit.
   *
   * The readiness indicator otherwise treats a very short narrative as an
   * unanswered placeholder, which is right for "describe your process" and
   * wrong here: "INR" is a complete and correct answer to which currency you
   * report in, and marking it unanswered would tell a responder to go and
   * write more where there is nothing more to write.
   */
  shortAnswer?: boolean;
}

export interface CdpModule {
  /** Stable internal key, also the value stored in CdpModuleProgress.moduleCode. */
  code: string;
  /** e.g. "C6" — as cited in the response index. */
  label: string;
  title: string;
  pillar: CdpModulePillar;
  /** Prisma relation on CdpReport holding this module's row. */
  relation: string;
  /** One line the module list shows so a responder knows what it covers. */
  blurb: string;
  /**
   * CDP treats some modules as optional or sector-specific — C9 in
   * particular. An unanswered optional module is not a gap, and the maturity
   * indicator must not report it as one.
   */
  optional?: boolean;
  questions: CdpQuestion[];
}

/** Shorthand — every question seeded in this pass is PENDING_SOURCE by construction. */
const q = (
  code: string,
  label: string,
  type: CdpQuestionType,
  field: string,
  extra: Partial<Omit<CdpQuestion, "code" | "label" | "type" | "field" | "status">> = {},
): CdpQuestion => ({ code, label, type, field, status: "PENDING_SOURCE", ...extra });

// Option lists CDP reuses across questions.
const YES_NO_PLANNED = [
  { value: "YES", label: "Yes" },
  { value: "NO", label: "No" },
  { value: "PLANNED", label: "No, but we plan to within the next two years" },
];

const CONSOLIDATION_APPROACHES = [
  { value: "OPERATIONAL_CONTROL", label: "Operational control" },
  { value: "FINANCIAL_CONTROL", label: "Financial control" },
  { value: "EQUITY_SHARE", label: "Equity share" },
];

const ASSURANCE_LEVELS = [
  { value: "NONE", label: "No third-party verification or assurance" },
  { value: "LIMITED", label: "Limited assurance" },
  { value: "REASONABLE", label: "Reasonable assurance" },
  { value: "HIGH", label: "High assurance" },
];

export const CDP_MODULES: CdpModule[] = [
  {
    code: "C0",
    label: "C0",
    title: "Introduction",
    pillar: "INTRODUCTION",
    relation: "introduction",
    blurb: "Who is responding, over what reporting year, in which countries and currency, and on what consolidation basis.",
    questions: [
      q("C0.1", "Give a general description of the organization, including its business activities", "narrative", "organizationDescription"),
      q("C0.2", "State the start and end date of the year for which you are reporting data", "narrative", "reportingYearDescription", {
        derived: true,
        constant: true,
        hint: "Resolved from the reporting period and your financial year start month.",
      }),
      q("C0.3", "Select the countries or areas in which you operate", "narrative", "countriesOfOperation", { shortAnswer: true }),
      q("C0.4", "Select the currency used for all financial information disclosed", "narrative", "reportingCurrency", {
        shortAnswer: true,
        hint: "CDP asks for a single currency across the whole response. INR unless a buyer asked otherwise.",
      }),
      q("C0.5", "Select the consolidation approach used for your emissions data", "select", "consolidationApproach", {
        options: CONSOLIDATION_APPROACHES,
        hint: "This must match the boundary the Scope 1 and 2 figures were compiled on.",
      }),
      q("C0.6", "State the organizational boundary covered by this response", "narrative", "organizationalBoundary", {
        hint: "This response is prepared per facility. State clearly whether the figures are facility-level or group-level.",
      }),
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
      q("C1.1", "Is there board-level oversight of climate-related issues within your organization?", "bool", "boardOversight"),
      q("C1.1a", "Identify the position(s) or committee(s) with board-level responsibility for climate-related issues", "narrative", "boardOversightPosition"),
      q("C1.1b", "Provide further details on the board's oversight of climate-related issues", "narrative", "boardOversightDetail", {
        hint: "How climate is integrated into board business — which agenda items, and with what frequency.",
      }),
      q("C1.1c", "Frequency with which climate-related issues are a scheduled agenda item", "select", "boardReviewFrequency", {
        options: [
          { value: "EVERY_MEETING", label: "Scheduled — all meetings" },
          { value: "SOME_MEETINGS", label: "Scheduled — some meetings" },
          { value: "AS_IMPORTANT", label: "Some meetings — as important matters arise" },
          { value: "NOT_SCHEDULED", label: "Not a scheduled agenda item" },
        ],
      }),
      q("C1.2", "Provide the highest management-level position(s) with responsibility for climate-related issues", "narrative", "managementResponsibility"),
      q("C1.2a", "Describe where in the organizational structure this position sits and how it reports to the board", "narrative", "managementReportingLine"),
      q("C1.3", "Do you provide incentives for the management of climate-related issues?", "bool", "climateIncentives"),
      q("C1.3a", "Provide further details on the incentives provided", "narrative", "climateIncentivesDetail", {
        hint: "Who is entitled, what type of incentive, and which climate metric it is tied to.",
      }),
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
      q("C2.1", "Does your organization have a process for identifying, assessing and responding to climate-related risks and opportunities?", "bool", "hasRiskProcess"),
      q("C2.1a", "How does your organization define short-, medium- and long-term time horizons?", "narrative", "timeHorizonDefinition"),
      q("C2.1b", "Short-term horizon — to (years from reporting year)", "int", "shortTermYears", { unit: "years" }),
      q("C2.1c", "Medium-term horizon — to (years from reporting year)", "int", "mediumTermYears", { unit: "years" }),
      q("C2.1d", "Long-term horizon — to (years from reporting year)", "int", "longTermYears", { unit: "years" }),
      q("C2.1e", "How does your organization define substantive financial or strategic impact?", "narrative", "substantiveImpactDefinition", {
        hint: "CDP expects a stated quantitative threshold where you have one — for example a currency figure or a share of EBITDA.",
      }),
      q("C2.2", "Describe your process for identifying, assessing and responding to climate-related risks and opportunities", "narrative", "riskProcessDescription", {
        hint: "Cover frequency, coverage (which parts of the business and value chain), and how the process integrates with wider enterprise risk management.",
      }),
      q("C2.2a", "Is your risk assessment process integrated into multi-disciplinary company-wide risk management?", "bool", "riskProcessIntegrated"),
      q("C2.3", "Have you identified any inherent climate-related risks with the potential to have a substantive financial or strategic impact?", "bool", "hasSubstantiveRisks", {
        hint: "The risks themselves are entered as rows below rather than as free text.",
      }),
      q("C2.4", "Have you identified any climate-related opportunities with the potential to have a substantive financial or strategic impact?", "bool", "hasSubstantiveOpportunities"),
      q("C2.5", "Describe any climate-related risks and opportunities that had a substantive effect in the reporting year", "narrative", "realizedImpacts"),
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
      q("C3.1", "Does your organization have a climate transition plan that aligns with a 1.5°C world?", "select", "transitionPlan", { options: YES_NO_PLANNED }),
      q("C3.1a", "Describe the transition plan and how it is reviewed", "narrative", "transitionPlanDetail"),
      q("C3.2", "Does your organization use climate-related scenario analysis to inform its strategy?", "select", "usesScenarioAnalysis", { options: YES_NO_PLANNED }),
      q("C3.2a", "Which climate scenarios were used, and over what time horizons?", "narrative", "scenariosUsed", {
        hint: "Name the scenarios rather than describing them generically — e.g. IEA Net Zero Emissions by 2050, IEA STEPS, IPCC SSP1-2.6, SSP5-8.5.",
      }),
      q("C3.2b", "Describe the results of the scenario analysis and how they informed strategy", "narrative", "scenarioResults"),
      q("C3.3", "Describe where and how climate-related risks and opportunities have influenced your strategy", "narrative", "strategyInfluence", {
        hint: "CDP expects this broken down across products and services, supply chain, R&D and operations.",
      }),
      q("C3.4", "Describe where and how climate-related risks and opportunities have influenced your financial planning", "narrative", "financialPlanningInfluence"),
      q("C3.5", "Capital expenditure aligned to low-carbon activities in the reporting year", "currency", "lowCarbonCapex", {
        hint: "In the currency stated at C0.4.",
      }),
      q("C3.6", "Share of total capital expenditure aligned to low-carbon activities", "pct", "lowCarbonCapexPct", { unit: "%" }),
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
      q("C4.1", "Did you have an emissions target that was active in the reporting year?", "select", "targetType", {
        options: [
          { value: "ABSOLUTE", label: "Absolute target" },
          { value: "INTENSITY", label: "Intensity target" },
          { value: "BOTH", label: "Both absolute and intensity targets" },
          { value: "NONE", label: "No target" },
        ],
        hint: "The targets themselves are entered as rows below.",
      }),
      q("C4.1a", "Is any target validated by the Science Based Targets initiative (SBTi)?", "bool", "sbtiValidated", {
        hint: "Only answer yes where SBTi has actually validated the target. An intention to submit is not a validation.",
      }),
      q("C4.1b", "Describe the SBTi validation status, including the date and the target ambition validated", "narrative", "sbtiDetail"),
      q("C4.2", "Did you have any other climate-related targets active in the reporting year?", "narrative", "otherTargets", {
        hint: "For example renewable electricity share, energy efficiency, or a net-zero commitment year.",
      }),
      q("C4.3", "Did you have emissions reduction initiatives active in the reporting year?", "bool", "hasInitiatives"),
      q("C4.3a", "Number of emissions reduction initiatives active in the reporting year", "int", "initiativeCount"),
      q("C4.3b", "Total estimated annual CO2e savings from initiatives active in the reporting year", "number", "initiativeSavingsTco2e", { unit: "tCO2e" }),
      q("C4.3c", "Describe the initiatives and the methods used to drive investment in them", "narrative", "initiativeDetail"),
      q("C4.5", "Do you classify any of your products or services as low-carbon?", "narrative", "lowCarbonProducts"),
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
      q("C5.1", "Base year for your emissions target and performance tracking", "year", "baseYear"),
      q("C5.1a", "Base year Scope 1 emissions", "number", "baseYearScope1Tco2e", { unit: "tCO2e" }),
      q("C5.1b", "Base year Scope 2 emissions, location-based", "number", "baseYearScope2LocationTco2e", { unit: "tCO2e" }),
      q("C5.1c", "Base year Scope 2 emissions, market-based", "number", "baseYearScope2MarketTco2e", { unit: "tCO2e" }),
      q("C5.1d", "Base year Scope 3 emissions", "number", "baseYearScope3Tco2e", { unit: "tCO2e" }),
      q("C5.2", "Select the standards, protocols and methodologies used to collect activity data and calculate emissions", "narrative", "standardsUsed", {
        hint: "For example the GHG Protocol Corporate Accounting and Reporting Standard, and ISO 14064-1.",
      }),
      q("C5.3", "Global warming potential source applied", "select", "gwpSource", {
        options: [
          { value: "AR5", label: "IPCC Fifth Assessment Report (AR5, 100-year)" },
          { value: "AR6", label: "IPCC Sixth Assessment Report (AR6, 100-year)" },
          { value: "AR4", label: "IPCC Fourth Assessment Report (AR4, 100-year)" },
        ],
        hint: "The figures reused into C6 are computed on the AR5 basis, which is the GHG Protocol convention CDP expects — deliberately distinct from the AR2/BUR3 basis India's CCTS requires on the same records.",
      }),
      q("C5.4", "Describe any structural change, base year recalculation or restatement made in the reporting year", "narrative", "baseYearRecalculation"),
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
      q("C6.1", "Gross global Scope 1 emissions", "number", "scope1Tco2e", {
        unit: "tCO2e",
        derived: true,
        hint: "Reused from this facility's submitted activity data on the IPCC AR5 basis.",
      }),
      q("C6.1a", "Describe your gross global Scope 1 emissions and the sources included", "narrative", "scope1Description"),
      q("C6.2", "Scope 2 accounting approach applied", "select", "scope2Approach", {
        options: [
          { value: "LOCATION", label: "Location-based only" },
          { value: "MARKET", label: "Market-based only" },
          { value: "BOTH", label: "Both location-based and market-based" },
        ],
      }),
      q("C6.3", "Gross global Scope 2 emissions, location-based", "number", "scope2LocationTco2e", {
        unit: "tCO2e",
        derived: true,
        hint: "Reused from grid electricity and imported steam in this facility's activity data.",
      }),
      q("C6.3a", "Gross global Scope 2 emissions, market-based", "number", "scope2MarketTco2e", {
        unit: "tCO2e",
        hint: "Entered manually — a market-based figure needs supplier-specific or residual-mix factors the platform does not hold.",
      }),
      q("C6.4", "Are there any sources within your boundary that are not included in your disclosure?", "narrative", "exclusions", {
        hint: "State the source, the reason for exclusion, and its estimated size. CDP treats a silent exclusion far more harshly than a disclosed one.",
      }),
      q("C6.5", "Account for your Scope 3 emissions by category", "number", "scope3Tco2e", {
        unit: "tCO2e",
        derived: true,
        hint: "Rolled up from submitted Scope 3 value-chain entries. The per-category breakdown is generated into the report automatically.",
      }),
      q("C6.5a", "Explain the Scope 3 categories evaluated, and the basis for any judged not relevant", "narrative", "scope3Description"),
      q("C6.7", "Are carbon dioxide emissions from biogenic carbon relevant to your organization?", "number", "biogenicCo2Tonnes", { unit: "t CO2" }),
      q("C6.10", "Gross global combined Scope 1 and 2 emissions per unit of revenue", "number", "intensityPerRevenue", {
        unit: "tCO2e/unit revenue",
        derived: true,
        hint: "Calculated from the revenue figure entered on this report.",
      }),
      q("C6.10a", "Describe any other intensity metric you track", "narrative", "otherIntensityMetric"),
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
      q("C7.1", "Does your organization break down its Scope 1 emissions by greenhouse gas type?", "bool", "breakdownByGas", {
        hint: "The per-gas figures are entered as rows below.",
      }),
      q("C7.2", "Break down your total gross global Scope 1 emissions by country or area", "narrative", "breakdownByCountryNote", {
        hint: "Entered as rows below. Use this field for anything the rows cannot express.",
      }),
      q("C7.3", "Indicate which other groupings you are able to provide a Scope 1 breakdown for", "narrative", "breakdownByDivisionNote", {
        hint: "CDP accepts business division, facility, and activity. Entered as rows below.",
      }),
      q("C7.5", "Break down your total gross global Scope 2 emissions by country or area", "narrative", "scope2BreakdownNote"),
      q("C7.9", "How do your gross global emissions for the reporting year compare with the previous year?", "select", "yearOnYearDirection", {
        options: [
          { value: "DECREASED", label: "Decreased" },
          { value: "INCREASED", label: "Increased" },
          { value: "SAME", label: "About the same" },
          { value: "FIRST_YEAR", label: "This is our first year of reporting" },
        ],
      }),
      q("C7.9a", "Identify the reasons for the change and quantify the effect of each", "narrative", "yearOnYearExplanation", {
        hint: "CDP asks for change attributed to each driver separately — emissions reduction activities, divestment, acquisitions, output change, methodology change.",
      }),
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
      q("C8.1", "What percentage of your total operational spend in the reporting year was on energy?", "pct", "energySpendPct", { unit: "%" }),
      q("C8.2", "Select which energy-related activities your organization has undertaken", "narrative", "energyActivities", {
        hint: "For example consumption of fuel, purchased electricity, purchased heat or steam, and generation of electricity on site.",
      }),
      q("C8.2a", "Total energy consumption", "number", "totalEnergyMwh", {
        unit: "MWh",
        derived: true,
        hint: "Electricity and imported steam reused from activity data. Fuel energy is entered below.",
      }),
      q("C8.2b", "Consumption of purchased electricity", "number", "purchasedElectricityMwh", {
        unit: "MWh",
        derived: true,
      }),
      q("C8.2c", "Consumption of renewable electricity", "number", "renewableElectricityMwh", {
        unit: "MWh",
        derived: true,
      }),
      q("C8.2d", "Consumption of fuel, excluding feedstock", "number", "fuelConsumptionMwh", { unit: "MWh" }),
      q("C8.2e", "Consumption of purchased heat, steam and cooling", "number", "purchasedSteamMwh", {
        unit: "MWh",
        derived: true,
        hint: "Imported steam from activity data, converted at 3.6 GJ per MWh.",
      }),
      q("C8.2f", "Total electricity generated on site", "number", "electricityGeneratedMwh", { unit: "MWh" }),
      q("C8.2g", "Of which generated from renewable sources", "number", "renewableGeneratedMwh", { unit: "MWh" }),
      q("C8.2h", "Share of total energy consumption from renewable sources", "pct", "renewableSharePct", {
        unit: "%",
        derived: true,
      }),
      q("C8.3", "Describe how you are increasing your low-carbon energy consumption", "narrative", "lowCarbonEnergyPlan"),
    ],
  },
  {
    code: "C9",
    label: "C9",
    title: "Additional metrics",
    pillar: "EMISSIONS",
    relation: "additionalMetrics",
    optional: true,
    blurb: "Optional and sector-specific metrics. CDP issues these based on the responding company's sector — leave blank unless your buyer asked for them.",
    questions: [
      q("C9.1", "Provide any additional climate-related metrics relevant to your business", "narrative", "additionalMetrics"),
      q("C9.1a", "Sector-specific metric — name", "narrative", "sectorMetricName", {
        hint: "CDP issues sector-specific questions only to companies in the sectors they apply to. If you were not asked for one, leave this blank.",
      }),
      q("C9.1b", "Sector-specific metric — value", "number", "sectorMetricValue"),
      q("C9.1c", "Sector-specific metric — unit", "narrative", "sectorMetricUnit", { shortAnswer: true }),
      q("C9.2", "Waste generated in the reporting year", "number", "wasteGeneratedTonnes", {
        unit: "t",
        derived: true,
        hint: "Reused from the GRI 306 waste disclosure for the same period where one exists.",
      }),
      q("C9.3", "Water withdrawn in the reporting year", "number", "waterWithdrawalM3", {
        unit: "m3",
        derived: true,
        hint: "Reused from the ISO 14046 water inventory where one exists.",
      }),
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
      q("C10.1", "Indicate the verification or assurance status that applies to your Scope 1 emissions", "select", "scope1Assurance", { options: ASSURANCE_LEVELS }),
      q("C10.1a", "Verification or assurance status of your Scope 2 emissions", "select", "scope2Assurance", { options: ASSURANCE_LEVELS }),
      q("C10.1b", "Verification or assurance status of your Scope 3 emissions", "select", "scope3Assurance", { options: ASSURANCE_LEVELS }),
      q("C10.1c", "Name of the verification or assurance provider", "narrative", "assuranceProvider"),
      q("C10.1d", "Standard the verification was carried out under", "narrative", "assuranceStandard", {
        hint: "For example ISO 14064-3, ISAE 3000 (Revised), or a national equivalent.",
      }),
      q("C10.1e", "Date the assurance statement was issued", "year", "assuranceYear"),
      q("C10.2", "Do you verify any other climate-related information reported in this response?", "narrative", "otherVerification"),
      q("C10.3", "Describe the scope of the assurance engagement and any qualifications in the opinion", "narrative", "assuranceScope"),
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
      q("C11.1", "Are any of your operations or activities regulated by a carbon pricing system?", "bool", "regulatedByCarbonPricing", {
        hint: "The platform pre-fills what it can see from your CBAM and CCTS records, but you must confirm it — coverage depends on entity-level facts the platform does not hold.",
      }),
      q("C11.1a", "Select the carbon pricing regulations that apply to your operations", "narrative", "carbonPricingSystems", {
        hint: "For example the EU Emissions Trading System, the EU or UK Carbon Border Adjustment Mechanism, or India's Carbon Credit Trading Scheme.",
      }),
      q("C11.1b", "Emissions covered by a carbon pricing system in the reporting year", "number", "coveredEmissionsTco2e", { unit: "tCO2e" }),
      q("C11.1c", "Describe your strategy for complying with the systems you are regulated by", "narrative", "carbonPricingStrategy"),
      q("C11.2", "Has your organization originated or purchased any project-based carbon credits?", "bool", "usesCarbonCredits"),
      q("C11.2a", "Carbon credits cancelled or retired in the reporting year", "number", "creditsCancelledTco2e", {
        unit: "tCO2e",
        derived: true,
        hint: "Reused from the voluntary offsets log.",
      }),
      q("C11.2b", "Describe the projects, standards and vintages of the credits used", "narrative", "carbonCreditsDetail"),
      q("C11.3", "Does your organization use an internal price on carbon?", "select", "usesInternalCarbonPrice", { options: YES_NO_PLANNED }),
      q("C11.3a", "Type of internal carbon price applied", "select", "internalPriceType", {
        options: [
          { value: "SHADOW_PRICE", label: "Shadow price" },
          { value: "INTERNAL_FEE", label: "Internal fee or carbon charge" },
          { value: "IMPLICIT_PRICE", label: "Implicit price" },
          { value: "OFFSET_PRICE", label: "Offset price" },
        ],
      }),
      q("C11.3b", "Internal carbon price applied", "currency", "internalCarbonPrice", {
        hint: "In the currency stated at C0.4, per tonne of CO2e.",
      }),
      q("C11.3c", "Describe how the internal carbon price is used in business decisions", "narrative", "internalPriceApplication"),
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
      q("C12.1", "Do you engage with your value chain on climate-related issues?", "bool", "engagesValueChain"),
      q("C12.1a", "Describe your climate-related supplier engagement strategy", "narrative", "supplierEngagement", {
        hint: "CDP asks what proportion of suppliers you engage, by what method, and what the measured outcome was.",
      }),
      q("C12.1b", "Percentage of suppliers, by number, engaged on climate in the reporting year", "pct", "suppliersEngagedPct", { unit: "%" }),
      q("C12.1c", "Percentage of total Scope 3 emissions covered by your supplier engagement", "pct", "scope3CoveredByEngagementPct", { unit: "%" }),
      q("C12.1d", "Describe your climate-related engagement with customers and other partners", "narrative", "customerEngagement"),
      q("C12.2", "Do you include climate-related requirements in your supplier contracts or code of conduct?", "bool", "supplierRequirements"),
      q("C12.3", "Do you engage in activities that could directly or indirectly influence climate policy?", "bool", "policyEngagement"),
      q("C12.3a", "Describe your policy engagement, including any trade associations, and how it aligns with your climate strategy", "narrative", "policyEngagementDetail"),
      q("C12.4", "Publications in which you report climate-related information", "narrative", "publications", {
        hint: "For example an annual report, a sustainability report, or a BRSR or ESRS filing prepared elsewhere on this platform.",
      }),
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
      q("C15.1", "Job title of the person submitting this response", "narrative", "submitterJobTitle", { shortAnswer: true }),
      q("C15.1a", "Corresponding job category", "select", "submitterJobCategory", {
        options: [
          { value: "BOARD_CHAIR", label: "Board chair" },
          { value: "BOARD_MEMBER", label: "Board or executive board member" },
          { value: "CEO", label: "Chief Executive Officer" },
          { value: "CFO", label: "Chief Financial Officer" },
          { value: "CSO", label: "Chief Sustainability Officer" },
          { value: "OTHER_C_SUITE", label: "Other C-suite officer" },
          { value: "SUSTAINABILITY_MANAGER", label: "Environment or sustainability manager" },
          { value: "OTHER", label: "Other, please specify" },
        ],
      }),
      q("C15.2", "Provide any final statement to accompany this response", "narrative", "finalStatement"),
    ],
  },
];

export const CDP_MODULE_CODES = CDP_MODULES.map((m) => m.code);

const MODULE_BY_CODE = new Map(CDP_MODULES.map((m) => [m.code, m]));

export const getCdpModule = (code: string): CdpModule | undefined => MODULE_BY_CODE.get(code);

export const isCdpModuleCode = (code: string): boolean => MODULE_BY_CODE.has(code);

/** Every question across every module. */
export const CDP_TOTAL_QUESTION_COUNT = CDP_MODULES.reduce((sum, m) => sum + m.questions.length, 0);

/**
 * How many questions have actually been reconciled against a published CDP
 * questionnaire. Surfaced in the UI and the response index — while this is
 * below the total, no report may present itself as matching CDP's own
 * question numbering.
 */
export const CDP_CONFIRMED_QUESTION_COUNT = CDP_MODULES.reduce(
  (sum, m) => sum + m.questions.filter((question) => question.status === "CONFIRMED").length,
  0,
);

/** True once every question in the registry has been checked against a CDP questionnaire document. */
export const CDP_REGISTRY_RECONCILED = CDP_CONFIRMED_QUESTION_COUNT === CDP_TOTAL_QUESTION_COUNT;

/** The questionnaire version this registry claims to follow. Null until reconciled. */
export const CDP_QUESTIONNAIRE_VERSION: string | null = null;

// ---------------------------------------------------------------------------
// Applicability and submission notices
//
// These are the CDP counterparts to CSRD_APPLICABILITY_NOTICE, and they carry
// the same weight: they are the guard against the platform implying an
// obligation that does not exist. The CSRD failure mode was implying a company
// below the Omnibus thresholds must file. The CDP failure mode is implying CDP
// is a regulator at all.
// ---------------------------------------------------------------------------

export const CDP_APPLICABILITY_NOTICE =
  "CDP disclosure is voluntary and buyer-driven. It is not a legal or regulatory obligation, there is no statutory " +
  "deadline, and no government body enforces it. Companies respond because a specific customer or investor asked " +
  "them to — typically a large buyer running a supply chain climate programme, or an asset manager screening a " +
  "portfolio. Check the exact scope, questionnaire version and deadline with whoever requested your response: those " +
  "are set by CDP and by the requesting organization, not by this platform.";

export const CDP_SUBMISSION_NOTICE =
  "This report prepares your CDP response — it does not submit it. CDP responses are filed through CDP's own online " +
  "response platform, against the questionnaire CDP issues to your organization for the relevant disclosure year. " +
  "There is no PDF upload route. This document is ordered to match the questionnaire's module structure so answers " +
  "can be transferred across, and question numbering should be checked against the questionnaire you were issued.";

export const CDP_SCORING_NOTICE =
  "CDP scores responses from A to D- using its own methodology, applied by CDP to the response submitted on its " +
  "platform. This report does not predict, estimate or replicate that score. The bands shown here are an internal " +
  "readiness indicator based on how completely each module has been answered and whether it is backed by real " +
  "targets and third-party verification. A Strong band means the module is well prepared for submission. It is not " +
  "a CDP grade and carries no relationship to one.";

/**
 * The claim this report makes about itself. Deliberately has no "conformant"
 * level: there is nothing to conform to. A CDP response is either submitted on
 * CDP's platform or it is not, and this module never submits.
 */
export const CDP_PREPARATION_STATEMENT =
  "This report has been prepared to support a CDP Climate Change response for the reporting period stated. It is a " +
  "preparation and transfer document. It is not a CDP submission, it has not been scored by CDP, and it must not be " +
  "presented as evidence of a completed CDP disclosure.";

// ---------------------------------------------------------------------------
// Maturity bands
//
// Named here rather than in the maturity service so the frontend mirror and
// the PDF share one definition of what each band means.
// ---------------------------------------------------------------------------

export const CDP_MATURITY_BANDS = ["NOT_STARTED", "DEVELOPING", "ESTABLISHED", "STRONG"] as const;

export type CdpMaturityBand = (typeof CDP_MATURITY_BANDS)[number];

export const CDP_MATURITY_BAND_LABELS: Record<CdpMaturityBand, string> = {
  NOT_STARTED: "Not started",
  DEVELOPING: "Developing",
  ESTABLISHED: "Established",
  STRONG: "Strong",
};

export const CDP_MATURITY_BAND_DESCRIPTIONS: Record<CdpMaturityBand, string> = {
  NOT_STARTED: "Nothing has been entered for this module yet.",
  DEVELOPING: "Partially answered, or answered without the supporting evidence CDP asks for.",
  ESTABLISHED: "Most questions answered with substantive content.",
  STRONG: "Answered in full, with the supporting evidence CDP asks for.",
};
