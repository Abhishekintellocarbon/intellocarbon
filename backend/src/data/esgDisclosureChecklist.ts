import type { BrsrCoreReport, IssbS1S2Report } from "@prisma/client";
import { CDP_MODULES } from "./cdpQuestionnaire";

/**
 * What "complete" means for each framework, expressed as the fields that have
 * to be non-null on the stored report row.
 *
 * This is the single definition behind the ESG Overview's completeness strip
 * ("X of Y required disclosures complete"). It's kept here, next to the other
 * static regulatory reference data, rather than inside the overview service —
 * the checklist is a property of the frameworks, not of one screen, and the
 * BRSR grouping mirrors the attribute comments in schema.prisma's
 * BrsrCoreReport model exactly.
 *
 * Attribute 1 (GHG footprint) is deliberately keyed on `turnoverInr` alone:
 * the emissions themselves are rolled up from existing ActivityData by
 * brsrCalculation.service, so turnover is the only thing the disclosure
 * itself has to supply for the intensity ratios to resolve.
 */
export interface DisclosureRequirement<T> {
  /** Stable key — used as the React list key on the frontend. */
  key: string;
  label: string;
  fields: (keyof T)[];
}

export const BRSR_CORE_ATTRIBUTES: DisclosureRequirement<BrsrCoreReport>[] = [
  { key: "ghg", label: "GHG footprint", fields: ["turnoverInr"] },
  { key: "water", label: "Water footprint", fields: ["waterWithdrawnKl", "waterDischargedKl"] },
  { key: "waste", label: "Waste management", fields: ["wasteGeneratedTonnes", "wasteRecoveredTonnes"] },
  {
    key: "energy",
    label: "Energy footprint",
    fields: ["renewableEnergyConsumptionGj", "nonRenewableEnergyConsumptionGj"],
  },
  {
    key: "wellbeing",
    label: "Employee wellbeing",
    fields: ["employeeCountTotal", "wagesPaidMaleInr", "wagesPaidFemaleInr", "safetyIncidentsCount"],
  },
  {
    key: "diversity",
    label: "Gender diversity",
    fields: ["employeeCountFemale", "womenInWorkforcePct", "womenInManagementPct"],
  },
  { key: "inclusive", label: "Inclusive development", fields: ["procurementFromMsmePct"] },
  {
    key: "openness",
    label: "Openness of business",
    fields: ["purchasesFromTop10SuppliersPct", "salesToTop10CustomersPct"],
  },
  {
    key: "fairness",
    label: "Customer fairness",
    fields: ["consumerComplaintsCount", "consumerComplaintsResolvedPct"],
  },
];

/**
 * The four core-content pillars every IFRS S1/S2 disclosure must cover.
 * Scope 1 and 2 are excluded from Metrics & Targets on purpose — those are
 * rolled up from ActivityData by issbCalculation.service and are never
 * entered on the report, so counting them would report a pillar as complete
 * before the preparer has disclosed anything.
 */
export const ISSB_PILLARS: DisclosureRequirement<IssbS1S2Report>[] = [
  { key: "governance", label: "Governance", fields: ["governanceBodyOversight", "managementRole"] },
  {
    key: "strategy",
    label: "Strategy",
    fields: ["climateRisksOpportunities", "businessModelImpact", "financialEffects", "scenarioAnalysisResilience"],
  },
  {
    key: "risk",
    label: "Risk management",
    fields: ["riskIdentificationProcess", "riskManagementProcess", "riskIntegrationOverall"],
  },
  {
    key: "metrics",
    label: "Metrics & targets",
    fields: ["scope3Tco2e", "targetDescription", "targetYear", "baselineYear", "baselineEmissionsTco2e"],
  },
];

/** A requirement counts as met only when every one of its fields is present. */
export const isRequirementMet = <T extends object>(row: T, requirement: DisclosureRequirement<T>): boolean =>
  requirement.fields.every((field) => row[field] !== null && row[field] !== undefined && row[field] !== "");

/**
 * GRI's reporting requirements, as the completeness strip expresses them.
 *
 * Deliberately NOT a DisclosureRequirement<GriReport>: unlike BRSR and ISSB,
 * GRI has no fixed set of fields that constitute a complete disclosure. Which
 * Topic Standards apply is decided per facility by its materiality assessment,
 * so two facilities can both be fully compliant while reporting entirely
 * different topics. Counting topic fields would therefore compare facilities
 * against each other rather than against the standard.
 *
 * What IS fixed is GRI 1's reporting requirements, which every report must
 * meet regardless of which topics it covers. Those are what this list scores,
 * and they line up one-to-one with the blockers evaluateAccordance produces —
 * so the strip and the "in accordance" claim can never disagree.
 */
export interface GriReportingRequirement {
  key: string;
  label: string;
}

export const GRI_REPORTING_REQUIREMENTS: GriReportingRequirement[] = [
  { key: "materiality", label: "Materiality assessment (GRI 3-1)" },
  { key: "materialTopics", label: "Material topics identified (GRI 3-2)" },
  { key: "managementApproach", label: "Management approach per topic (GRI 3-3)" },
  { key: "universal", label: "General disclosures (GRI 2)" },
  { key: "topicData", label: "Disclosure data for every material topic" },
];

/**
 * CSRD/ESRS and CDP reporting requirements, for the same completeness strip.
 *
 * Both follow GRI's shape rather than BRSR's, and for the same reason: neither
 * has a fixed set of fields that constitutes a complete disclosure.
 *
 * CSRD is double-materiality gated — which of the ten topical standards a
 * company must report is an output of its own assessment, so counting all ten
 * would score companies against each other instead of against ESRS. What is
 * fixed is the frame around the assessment: ESRS 2 applies to everyone, the
 * assessment itself must be done, exclusions must carry a stated rationale,
 * and every standard found material must satisfy its minimum disclosures and
 * actually carry data. These map one-to-one onto evaluateConformity's
 * blockers, so the strip and the conformity claim cannot disagree.
 *
 * The registry-reconciliation blocker is deliberately NOT a requirement here.
 * It is the platform's own gap, not the preparer's (see the comment on
 * CsrdConformityEvaluation.registryReconciled), and showing it as an
 * outstanding disclosure would ask a customer to fix something they cannot.
 */
export const CSRD_REPORTING_REQUIREMENTS: GriReportingRequirement[] = [
  { key: "materiality", label: "Double materiality assessment complete" },
  { key: "esrs2", label: "ESRS 2 general disclosures" },
  { key: "materialTopics", label: "Material standards identified, exclusions explained" },
  { key: "minimumDisclosures", label: "Minimum disclosures per material standard" },
  { key: "standardData", label: "Datapoints reported for every material standard" },
];

/**
 * CDP is scored by module, which is how the questionnaire is actually
 * structured and how a responder works through it. One requirement per
 * required module, met when every question in it is answered.
 *
 * Derived from CDP_MODULES rather than written out, so a module added to or
 * renamed in the questionnaire cannot leave a stale hand-maintained list
 * behind. Optional modules are excluded, matching assessCdpMaturity's own
 * answered/total — an untouched optional module is not a gap, and counting it
 * would report a complete response as incomplete.
 *
 * Note this is completeness, never a CDP score or band. CDP scores CDP
 * submissions; the maturity bands elsewhere in the platform are a readiness
 * indicator and must not be restated here as a grade.
 */
export const CDP_REPORTING_REQUIREMENTS: GriReportingRequirement[] = CDP_MODULES.filter(
  (module) => !module.optional,
).map((module) => ({ key: module.code, label: `${module.label} ${module.title}` }));
