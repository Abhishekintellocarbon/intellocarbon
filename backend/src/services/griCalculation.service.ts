import { prisma } from "../config/prisma";
import type { Company, Facility, GriImpact, GriMaterialTopic, Prisma } from "@prisma/client";
import { resolveFyWindow as resolveBrsrFyWindow, type BrsrFyWindow } from "./brsrCalculation.service";
import { buildWaterFootprint, type WaterFootprint } from "./waterCalculation.service";
import {
  GRI_TOPIC_STANDARDS,
  GRI_3_3_REQUIREMENTS,
  GRI_UNIVERSAL_DISCLOSURES,
  getGriTopic,
} from "../data/griStandards";

const round = (value: number, decimals = 4) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const MWH_TO_GJ = 3.6;
/** GRI 303 reports water in megalitres; the platform's WaterEntry inventory is in m3. */
const M3_PER_MEGALITRE = 1000;

// Same "FY2025-26" parsing/window resolution as BRSR Core and ISSB — reused
// rather than duplicating the date math a third time.
export type GriFyWindow = BrsrFyWindow;
export const resolveFyWindow = resolveBrsrFyWindow;

// ---------------------------------------------------------------------------
// GRI 3 materiality scoring
// ---------------------------------------------------------------------------

/**
 * Significance of a single impact, following GRI 3: Material Topics 2021's
 * actual methodology rather than a generic impact-times-likelihood matrix.
 *
 *  - For NEGATIVE impacts, significance is the impact's SEVERITY, which GRI 3
 *    determines from three attributes together: scale (how grave), scope (how
 *    widespread) and irremediability (how hard to counteract or make good).
 *  - For POSITIVE impacts, severity does not apply. GRI 3 assesses them on
 *    scale and scope only — irremediability is meaningless for a benefit.
 *  - For POTENTIAL impacts of either direction, the result is additionally
 *    weighted by LIKELIHOOD, since an impact that may not occur cannot rank
 *    alongside one that already has.
 *
 * Inputs are all 1-5, so the unweighted mean is also 1-5 and the returned
 * score stays on the same scale as GriMaterialityAssessment.materialityThreshold
 * regardless of impact type — which is what makes a single threshold able to
 * gate a mixed set of impacts.
 *
 * Likelihood is applied as a MULTIPLIER rather than averaged in as a fourth
 * attribute: averaging would let a highly likely but trivial impact outrank a
 * catastrophic but unlikely one, inverting GRI 3's stated priority that
 * severity takes precedence over likelihood.
 *
 * The multiplier is deliberately narrow — 0.6 at likelihood 1 up to 1.0 at
 * likelihood 5, i.e. `0.5 + 0.5 * (likelihood / 5)`. A raw `likelihood / 5`
 * factor spans 0.2-1.0, which lets likelihood alone move a score fivefold and
 * hands it the dominant role that severity is supposed to hold: under it a
 * maximally severe fatality hazard rated merely "possible" falls below a
 * threshold of 3 and drops out of the report entirely. Capping the reduction
 * at 40% keeps likelihood as a genuine discount on uncertain impacts without
 * letting it veto a severe one. GRI is explicit on this point for negative
 * human-rights impacts, where severity takes precedence outright.
 */
const LIKELIHOOD_FLOOR = 0.5;
export const computeImpactSignificance = (input: {
  impactType: GriImpact["impactType"];
  scale: number;
  scope: number;
  irremediability?: number | null;
  likelihood?: number | null;
}): number => {
  const isNegative = input.impactType === "NEGATIVE_ACTUAL" || input.impactType === "NEGATIVE_POTENTIAL";
  const isPotential = input.impactType === "NEGATIVE_POTENTIAL" || input.impactType === "POSITIVE_POTENTIAL";

  const attributes = [input.scale, input.scope];
  // Only negative impacts carry irremediability; a null on a negative impact
  // means the user left it blank, so it is dropped from the mean rather than
  // treated as zero (which would understate severity).
  if (isNegative && input.irremediability != null) attributes.push(input.irremediability);

  const base = attributes.reduce((sum, v) => sum + v, 0) / attributes.length;

  // A potential impact with no stated likelihood is scored at full weight —
  // the conservative reading, since assuming it is unlikely would suppress it
  // out of the report.
  const weight =
    isPotential && input.likelihood != null
      ? LIKELIHOOD_FLOOR + (1 - LIKELIHOOD_FLOOR) * (input.likelihood / 5)
      : 1;

  return round(base * weight, 2);
};

export interface GriTopicRanking {
  topicCode: string;
  /** Highest significance among this topic's impacts — GRI ranks by the most significant impact, not the average. */
  significanceScore: number;
  impactCount: number;
  /** True when significanceScore meets or exceeds the assessment's disclosed threshold. */
  meetsThreshold: boolean;
  rank: number;
}

/**
 * Rolls a flat list of scored impacts up into per-topic rankings.
 *
 * A topic takes the MAXIMUM significance of its impacts rather than the mean:
 * under GRI 3 a topic is material if it has at least one significant impact,
 * so averaging would let a cluster of minor impacts dilute a severe one out of
 * the report — the opposite of the standard's intent.
 *
 * Rank is assigned over all topics that have impacts, ordered by score
 * descending, so ranks stay stable whether or not the threshold is later moved.
 */
export const rankTopicsByImpacts = (
  impacts: Pick<GriImpact, "topicCode" | "significanceScore">[],
  materialityThreshold: number,
): GriTopicRanking[] => {
  const byTopic = new Map<string, { max: number; count: number }>();

  for (const impact of impacts) {
    const existing = byTopic.get(impact.topicCode);
    if (existing) {
      existing.max = Math.max(existing.max, impact.significanceScore);
      existing.count += 1;
    } else {
      byTopic.set(impact.topicCode, { max: impact.significanceScore, count: 1 });
    }
  }

  return Array.from(byTopic.entries())
    .map(([topicCode, { max, count }]) => ({
      topicCode,
      significanceScore: round(max, 2),
      impactCount: count,
      meetsThreshold: max >= materialityThreshold,
    }))
    // Ties break on topic code so the ordering is deterministic across runs —
    // the PDF's matrix and the content index must not reshuffle between two
    // generations of the same report.
    .sort((a, b) => b.significanceScore - a.significanceScore || a.topicCode.localeCompare(b.topicCode))
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
};

// ---------------------------------------------------------------------------
// Reuse of existing platform data
// ---------------------------------------------------------------------------

export interface GriGhgRollup {
  /** GRI 305-1. AR5/GHG-Protocol basis — GRI 305 follows GHG Protocol, not India's AR2/BUR3 convention. */
  scope1Co2e: number;
  /** GRI 305-2, location-based. Market-based has no engine source and is a manual disclosure. */
  scope2LocationBasedCo2e: number;
  /** GRI 305-3, rolled up from submitted Scope3Data for the same window. */
  scope3Co2e: number | null;
  scope3CategoryCount: number;
  totalScope1And2Co2e: number;
  productionQuantityT: number;
  /** GRI 302-1, the portion the platform can actually compute — electricity + imported steam. */
  electricityAndSteamEnergyGj: number;
  renewableElectricityGj: number;
  activityDataCount: number;
}

/**
 * Reads EmissionCalculationResult and Scope3Data for the FY window and
 * recomputes nothing — the single point of contact between the GRI module and
 * the platform's calculation engines, mirroring issbCalculation's rollup.
 *
 * Uses the AR5 columns, not the AR2/BUR3 ones: GRI 305 requires GHG Protocol
 * alignment, the same reasoning that makes ISSB read AR5 while BRSR Core reads
 * AR2/BUR3 off the very same rows.
 */
export const rollupFacilityGhgForFy = async (
  facilityId: string,
  reportingPeriod: string,
  window: GriFyWindow,
): Promise<GriGhgRollup> => {
  const [entries, scope3Rows] = await Promise.all([
    prisma.activityData.findMany({
      where: {
        facilityId,
        status: "SUBMITTED",
        periodStart: { gte: window.start },
        periodEnd: { lt: window.end },
      },
      include: { calculationResult: true },
    }),
    prisma.scope3Data.findMany({
      where: { facilityId, reportingPeriod, status: "SUBMITTED" },
      select: { calculatedEmissionsTco2e: true },
    }),
  ]);

  let scope1Co2e = 0;
  let scope2LocationBasedCo2e = 0;
  let productionQuantityT = 0;
  let electricityAndSteamEnergyGj = 0;
  let renewableElectricityGj = 0;

  for (const entry of entries) {
    if (entry.calculationResult) {
      scope1Co2e += entry.calculationResult.totalDirectCo2eAr5;
      scope2LocationBasedCo2e +=
        entry.calculationResult.indirectElectricityCo2e + entry.calculationResult.indirectSteamCo2e;
    }
    productionQuantityT += entry.productionQuantityT ?? 0;
    electricityAndSteamEnergyGj +=
      (entry.gridElectricityMwh + entry.renewableElectricityMwh) * MWH_TO_GJ + entry.steamImportedGj;
    renewableElectricityGj += entry.renewableElectricityMwh * MWH_TO_GJ;
  }

  const scope3Co2e = scope3Rows.length
    ? round(scope3Rows.reduce((sum, r) => sum + r.calculatedEmissionsTco2e, 0), 2)
    : null;

  return {
    scope1Co2e: round(scope1Co2e, 2),
    scope2LocationBasedCo2e: round(scope2LocationBasedCo2e, 2),
    scope3Co2e,
    scope3CategoryCount: scope3Rows.length,
    totalScope1And2Co2e: round(scope1Co2e + scope2LocationBasedCo2e, 2),
    productionQuantityT: round(productionQuantityT, 3),
    electricityAndSteamEnergyGj: round(electricityAndSteamEnergyGj, 3),
    renewableElectricityGj: round(renewableElectricityGj, 3),
    activityDataCount: entries.length,
  };
};

export interface GriWaterRollup {
  hasData: boolean;
  /** All in megalitres, converted from the m3 ISO 14046 inventory. */
  withdrawalTotalMl: number;
  dischargeTotalMl: number;
  consumptionTotalMl: number;
  withdrawalFreshwaterMl: number;
  entriesWithWater: number;
}

/**
 * Converts the existing ISO 14046 WaterEntry inventory into GRI 303's reporting
 * unit. The only place the m3 -> ML boundary is crossed; GriWaterDisclosure
 * stores megalitres throughout so the PDF never has to know about m3.
 */
export const rollupFacilityWaterForFy = async (
  facilityId: string,
  window: GriFyWindow,
): Promise<GriWaterRollup> => {
  const entries = await prisma.activityData.findMany({
    where: {
      facilityId,
      status: "SUBMITTED",
      periodStart: { gte: window.start },
      periodEnd: { lt: window.end },
    },
    include: { waterEntries: true },
  });

  let withdrawnM3 = 0;
  let dischargedM3 = 0;
  let freshwaterM3 = 0;
  let entriesWithWater = 0;

  for (const entry of entries) {
    if (entry.waterEntries.length === 0) continue;
    entriesWithWater += 1;
    const footprint: WaterFootprint = buildWaterFootprint(entry.waterEntries, entry.productionQuantityT);
    withdrawnM3 += footprint.totalWithdrawnM3;
    dischargedM3 += footprint.totalDischargedM3;
    freshwaterM3 += footprint.freshwaterWithdrawnM3;
  }

  const toMl = (m3: number) => round(m3 / M3_PER_MEGALITRE, 4);

  return {
    hasData: entriesWithWater > 0,
    withdrawalTotalMl: toMl(withdrawnM3),
    dischargeTotalMl: toMl(dischargedM3),
    // Consumption is derived, never stored — the same rule WaterEntry follows.
    consumptionTotalMl: toMl(withdrawnM3 - dischargedM3),
    withdrawalFreshwaterMl: toMl(freshwaterM3),
    entriesWithWater,
  };
};

// ---------------------------------------------------------------------------
// Derived topic metrics
// ---------------------------------------------------------------------------

export interface GriWasteTotals {
  hasData: boolean;
  hazardousDivertedT: number;
  hazardousDisposalT: number;
  nonHazardousDivertedT: number;
  nonHazardousDisposalT: number;
  totalDivertedT: number;
  totalDisposalT: number;
  /** GRI 306-3: waste generated is the sum of diverted and directed-to-disposal. */
  totalGeneratedT: number;
  diversionRatePct: number | null;
}

const sumNullable = (values: (number | null | undefined)[]): { total: number; anyPresent: boolean } => {
  let total = 0;
  let anyPresent = false;
  for (const v of values) {
    if (v != null) {
      total += v;
      anyPresent = true;
    }
  }
  return { total, anyPresent };
};

/**
 * GRI 306-3 (waste generated) is not a stored column — it is the sum of 306-4
 * (diverted from disposal) and 306-5 (directed to disposal). Deriving it is
 * what guarantees the three disclosures reconcile, which is exactly what an
 * assurance provider checks first.
 */
export const computeWasteTotals = (waste: {
  hazardousDivertedReuseT?: number | null;
  hazardousDivertedRecyclingT?: number | null;
  hazardousDivertedOtherRecoveryT?: number | null;
  nonHazardousDivertedReuseT?: number | null;
  nonHazardousDivertedRecyclingT?: number | null;
  nonHazardousDivertedOtherRecoveryT?: number | null;
  hazardousDisposalIncinerationWithRecoveryT?: number | null;
  hazardousDisposalIncinerationNoRecoveryT?: number | null;
  hazardousDisposalLandfillT?: number | null;
  hazardousDisposalOtherT?: number | null;
  nonHazardousDisposalIncinerationWithRecoveryT?: number | null;
  nonHazardousDisposalIncinerationNoRecoveryT?: number | null;
  nonHazardousDisposalLandfillT?: number | null;
  nonHazardousDisposalOtherT?: number | null;
} | null): GriWasteTotals => {
  const empty: GriWasteTotals = {
    hasData: false,
    hazardousDivertedT: 0,
    hazardousDisposalT: 0,
    nonHazardousDivertedT: 0,
    nonHazardousDisposalT: 0,
    totalDivertedT: 0,
    totalDisposalT: 0,
    totalGeneratedT: 0,
    diversionRatePct: null,
  };
  if (!waste) return empty;

  const hazDiverted = sumNullable([
    waste.hazardousDivertedReuseT,
    waste.hazardousDivertedRecyclingT,
    waste.hazardousDivertedOtherRecoveryT,
  ]);
  const nonHazDiverted = sumNullable([
    waste.nonHazardousDivertedReuseT,
    waste.nonHazardousDivertedRecyclingT,
    waste.nonHazardousDivertedOtherRecoveryT,
  ]);
  const hazDisposal = sumNullable([
    waste.hazardousDisposalIncinerationWithRecoveryT,
    waste.hazardousDisposalIncinerationNoRecoveryT,
    waste.hazardousDisposalLandfillT,
    waste.hazardousDisposalOtherT,
  ]);
  const nonHazDisposal = sumNullable([
    waste.nonHazardousDisposalIncinerationWithRecoveryT,
    waste.nonHazardousDisposalIncinerationNoRecoveryT,
    waste.nonHazardousDisposalLandfillT,
    waste.nonHazardousDisposalOtherT,
  ]);

  const hasData =
    hazDiverted.anyPresent || nonHazDiverted.anyPresent || hazDisposal.anyPresent || nonHazDisposal.anyPresent;
  if (!hasData) return empty;

  const totalDivertedT = hazDiverted.total + nonHazDiverted.total;
  const totalDisposalT = hazDisposal.total + nonHazDisposal.total;
  const totalGeneratedT = totalDivertedT + totalDisposalT;

  return {
    hasData: true,
    hazardousDivertedT: round(hazDiverted.total, 3),
    hazardousDisposalT: round(hazDisposal.total, 3),
    nonHazardousDivertedT: round(nonHazDiverted.total, 3),
    nonHazardousDisposalT: round(nonHazDisposal.total, 3),
    totalDivertedT: round(totalDivertedT, 3),
    totalDisposalT: round(totalDisposalT, 3),
    totalGeneratedT: round(totalGeneratedT, 3),
    diversionRatePct: totalGeneratedT > 0 ? round((totalDivertedT / totalGeneratedT) * 100, 2) : null,
  };
};

export interface GriSafetyRates {
  hasData: boolean;
  /** GRI 403-9 permits a 200,000- or 1,000,000-hour basis but requires the choice to be stated. */
  rateBasisHours: number;
  fatalityRate: number | null;
  highConsequenceInjuryRate: number | null;
  recordableInjuryRate: number | null;
  totalFatalities: number;
  totalRecordableInjuries: number;
}

/**
 * GRI 403-9 injury rates. Rates are derived, never stored — they are a pure
 * function of counts and hours worked, and a stored rate could disagree with
 * its own inputs after an edit.
 *
 * Employee and non-employee counts are summed because hoursWorked is captured
 * as a single figure; GRI permits a combined rate provided the population is
 * stated, which the report does alongside the number.
 */
export const computeSafetyRates = (ohs: {
  hoursWorked?: number | null;
  rateBasisHours?: number | null;
  fatalitiesEmployees?: number | null;
  fatalitiesNonEmployees?: number | null;
  highConsequenceInjuriesEmployees?: number | null;
  highConsequenceInjuriesNonEmployees?: number | null;
  recordableInjuriesEmployees?: number | null;
  recordableInjuriesNonEmployees?: number | null;
} | null): GriSafetyRates => {
  const basis = ohs?.rateBasisHours ?? 200_000;
  const totalFatalities = (ohs?.fatalitiesEmployees ?? 0) + (ohs?.fatalitiesNonEmployees ?? 0);
  const totalHighConsequence =
    (ohs?.highConsequenceInjuriesEmployees ?? 0) + (ohs?.highConsequenceInjuriesNonEmployees ?? 0);
  const totalRecordable = (ohs?.recordableInjuriesEmployees ?? 0) + (ohs?.recordableInjuriesNonEmployees ?? 0);

  const hours = ohs?.hoursWorked ?? null;
  const rate = (count: number) => (hours != null && hours > 0 ? round((count / hours) * basis, 3) : null);

  return {
    hasData: hours != null && hours > 0,
    rateBasisHours: basis,
    fatalityRate: rate(totalFatalities),
    highConsequenceInjuryRate: rate(totalHighConsequence),
    recordableInjuryRate: rate(totalRecordable),
    totalFatalities,
    totalRecordableInjuries: totalRecordable,
  };
};

export interface GriIntensityRatios {
  /** GRI 305-4, per tonne of product. Null when no production quantity was submitted. */
  emissionsPerTonneProduct: number | null;
  /** GRI 305-4, per rupee of turnover. */
  emissionsPerRupeeTurnover: number | null;
  /** GRI 302-3, per tonne of product. */
  energyPerTonneProduct: number | null;
  energyPerRupeeTurnover: number | null;
}

export const computeIntensityRatios = (
  ghg: Pick<GriGhgRollup, "totalScope1And2Co2e" | "productionQuantityT" | "electricityAndSteamEnergyGj">,
  turnoverInr: number | null,
): GriIntensityRatios => {
  const perProduction = (numerator: number) =>
    ghg.productionQuantityT > 0 ? round(numerator / ghg.productionQuantityT, 6) : null;
  const perTurnover = (numerator: number) =>
    turnoverInr != null && turnoverInr > 0 ? round(numerator / turnoverInr, 10) : null;

  return {
    emissionsPerTonneProduct: perProduction(ghg.totalScope1And2Co2e),
    emissionsPerRupeeTurnover: perTurnover(ghg.totalScope1And2Co2e),
    energyPerTonneProduct: perProduction(ghg.electricityAndSteamEnergyGj),
    energyPerRupeeTurnover: perTurnover(ghg.electricityAndSteamEnergyGj),
  };
};

// ---------------------------------------------------------------------------
// "In accordance with GRI Standards" evaluation
// ---------------------------------------------------------------------------

export interface GriTopicCompleteness {
  topicCode: string;
  label: string;
  title: string;
  isMaterial: boolean;
  /** GRI 3-3's six sub-requirements, all of which are mandatory for a material topic. */
  managementApproachComplete: boolean;
  missingManagementApproachFields: string[];
  /** Disclosures with at least one non-null backing field. */
  disclosuresReported: number;
  disclosuresTotal: number;
  hasAnyData: boolean;
}

export interface GriAccordanceEvaluation {
  /** True only when every requirement below is met — gates the "in accordance" claim in the PDF. */
  inAccordance: boolean;
  universalDisclosuresReported: number;
  universalDisclosuresTotal: number;
  missingUniversalDisclosures: string[];
  materialityAssessmentComplete: boolean;
  materialTopicCount: number;
  /** Topics judged not material but left without the rationale GRI requires. */
  unexplainedExclusions: string[];
  topics: GriTopicCompleteness[];
  /** Human-readable list of what is blocking the "in accordance" claim, in report order. */
  blockers: string[];
}

const hasValue = (v: unknown): boolean => v !== null && v !== undefined && v !== "";

/** A disclosure counts as reported when at least one of its backing fields carries a value. */
export const isDisclosureReported = (row: Record<string, unknown> | null | undefined, fields: string[]): boolean => {
  if (!row) return false;
  if (fields.length === 0) return false;
  return fields.some((f) => hasValue(row[f]));
};

/**
 * Decides whether this report may claim "in accordance with the GRI
 * Standards" — the strong claim under GRI 1, which requires all nine reporting
 * requirements, or the weaker "with reference" claim when it cannot.
 *
 * This is the check that keeps an incomplete report from asserting compliance.
 * It is deliberately strict: any missing GRI 2 disclosure, an unfinished
 * materiality assessment, a material topic with an incomplete GRI 3-3, or an
 * excluded topic with no stated rationale all drop the report to "with
 * reference". The blockers list is surfaced verbatim in the UI so the gap is
 * actionable rather than a bare refusal.
 */
export const evaluateAccordance = (input: {
  universal: Record<string, unknown> | null;
  materialityCompletedAt: Date | null;
  materialTopics: GriMaterialTopic[];
  topicRows: Record<string, Record<string, unknown> | null>;
}): GriAccordanceEvaluation => {
  const blockers: string[] = [];

  // --- GRI 2: every one of the 30 general disclosures ---
  const missingUniversalDisclosures = GRI_UNIVERSAL_DISCLOSURES.filter(
    (d) => !isDisclosureReported(input.universal, d.fields),
  ).map((d) => d.number);
  const universalDisclosuresReported = GRI_UNIVERSAL_DISCLOSURES.length - missingUniversalDisclosures.length;

  if (missingUniversalDisclosures.length > 0) {
    blockers.push(
      `${missingUniversalDisclosures.length} of ${GRI_UNIVERSAL_DISCLOSURES.length} GRI 2 general disclosures not yet reported (${missingUniversalDisclosures.slice(0, 6).join(", ")}${missingUniversalDisclosures.length > 6 ? ", ..." : ""})`,
    );
  }

  // --- GRI 3-1: the materiality assessment must actually be finished ---
  const materialityAssessmentComplete = input.materialityCompletedAt != null;
  if (!materialityAssessmentComplete) {
    blockers.push("Materiality assessment (GRI 3-1) has not been completed");
  }

  const materialTopicRecords = input.materialTopics.filter((t) => t.isMaterial);
  if (materialTopicRecords.length === 0) {
    blockers.push("No material topics identified — GRI 3-2 requires at least one");
  }

  // --- Topics excluded without the rationale GRI requires ---
  const unexplainedExclusions = input.materialTopics
    .filter((t) => !t.isMaterial && !hasValue(t.notMaterialRationale))
    .map((t) => t.topicCode);
  if (unexplainedExclusions.length > 0) {
    blockers.push(
      `${unexplainedExclusions.length} topic${unexplainedExclusions.length === 1 ? "" : "s"} marked not material without a stated rationale`,
    );
  }

  // --- GRI 3-3 per material topic, plus per-topic disclosure coverage ---
  const topics: GriTopicCompleteness[] = GRI_TOPIC_STANDARDS.map((standard) => {
    const record = input.materialTopics.find((t) => t.topicCode === standard.code);
    const isMaterial = record?.isMaterial ?? false;
    const row = input.topicRows[standard.code] ?? null;

    const missingManagementApproachFields = record
      ? GRI_3_3_REQUIREMENTS.filter((r) => !hasValue((record as unknown as Record<string, unknown>)[r.field])).map(
          (r) => r.label,
        )
      : GRI_3_3_REQUIREMENTS.map((r) => r.label);

    const disclosuresReported = standard.disclosures.filter((d) => isDisclosureReported(row, d.fields)).length;

    return {
      topicCode: standard.code,
      label: standard.label,
      title: standard.title,
      isMaterial,
      managementApproachComplete: isMaterial && missingManagementApproachFields.length === 0,
      missingManagementApproachFields,
      disclosuresReported,
      disclosuresTotal: standard.disclosures.length,
      hasAnyData: disclosuresReported > 0,
    };
  });

  for (const topic of topics) {
    if (!topic.isMaterial) continue;
    if (!topic.managementApproachComplete) {
      blockers.push(
        `${topic.label} ${topic.title}: GRI 3-3 incomplete (${topic.missingManagementApproachFields.join(", ")})`,
      );
    }
    if (!topic.hasAnyData) {
      blockers.push(`${topic.label} ${topic.title} is material but has no disclosure data`);
    }
  }

  return {
    inAccordance: blockers.length === 0,
    universalDisclosuresReported,
    universalDisclosuresTotal: GRI_UNIVERSAL_DISCLOSURES.length,
    missingUniversalDisclosures,
    materialityAssessmentComplete,
    materialTopicCount: materialTopicRecords.length,
    unexplainedExclusions,
    topics,
    blockers,
  };
};

// ---------------------------------------------------------------------------
// Assembled metrics
// ---------------------------------------------------------------------------

/** Every GriReport relation the metrics builder and PDF need, in one include. */
export const GRI_REPORT_INCLUDE = {
  materialityAssessment: { include: { impacts: true } },
  universalDisclosures: true,
  materialTopics: true,
  materialsDisclosure: true,
  energyDisclosure: true,
  waterDisclosure: true,
  biodiversityDisclosure: true,
  emissionsDisclosure: true,
  wasteDisclosure: true,
  supplierEnvDisclosure: true,
  employmentDisclosure: true,
  ohsDisclosure: true,
  trainingDisclosure: true,
  diversityDisclosure: true,
  nonDiscriminationDisclosure: true,
  localCommunitiesDisclosure: true,
  supplierSocialDisclosure: true,
  customerHsDisclosure: true,
  customerPrivacyDisclosure: true,
} satisfies Prisma.GriReportInclude;

export type GriReportWithRelations = Prisma.GriReportGetPayload<{ include: typeof GRI_REPORT_INCLUDE }>;

/** Maps a topic code to the loaded disclosure row for that topic, via the registry's `relation` name. */
export const topicRowsFrom = (report: GriReportWithRelations): Record<string, Record<string, unknown> | null> => {
  const rows: Record<string, Record<string, unknown> | null> = {};
  for (const standard of GRI_TOPIC_STANDARDS) {
    rows[standard.code] =
      ((report as unknown as Record<string, unknown>)[standard.relation] as Record<string, unknown> | null) ?? null;
  }
  return rows;
};

export interface GriMetrics {
  fyWindow: GriFyWindow;
  ghg: GriGhgRollup;
  water: GriWaterRollup;
  waste: GriWasteTotals;
  safety: GriSafetyRates;
  intensity: GriIntensityRatios;
  rankings: GriTopicRanking[];
  accordance: GriAccordanceEvaluation;
}

/** Shared by the JSON report endpoint and the PDF builder, matching BRSR/ISSB's buildXMetrics wrapper. */
export const buildGriMetrics = async (
  report: GriReportWithRelations,
  facility: Pick<Facility, "id">,
  company: Pick<Company, "reportingFyStartMonth">,
): Promise<GriMetrics> => {
  const fyWindow = resolveFyWindow(report.reportingPeriod, company.reportingFyStartMonth);

  const [ghg, water] = await Promise.all([
    rollupFacilityGhgForFy(facility.id, report.reportingPeriod, fyWindow),
    rollupFacilityWaterForFy(facility.id, fyWindow),
  ]);

  const threshold = report.materialityAssessment?.materialityThreshold ?? 3;
  const rankings = rankTopicsByImpacts(report.materialityAssessment?.impacts ?? [], threshold);

  return {
    fyWindow,
    ghg,
    water,
    waste: computeWasteTotals(report.wasteDisclosure),
    safety: computeSafetyRates(report.ohsDisclosure),
    intensity: computeIntensityRatios(ghg, report.turnoverInr),
    rankings,
    accordance: evaluateAccordance({
      universal: report.universalDisclosures as unknown as Record<string, unknown> | null,
      materialityCompletedAt: report.materialityAssessment?.completedAt ?? null,
      materialTopics: report.materialTopics,
      topicRows: topicRowsFrom(report),
    }),
  };
};

/** Resolves a topic code to its human label for error messages — falls back to the raw code for unknown ones. */
export const topicLabel = (code: string): string => {
  const topic = getGriTopic(code);
  return topic ? `${topic.label} ${topic.title}` : code;
};
