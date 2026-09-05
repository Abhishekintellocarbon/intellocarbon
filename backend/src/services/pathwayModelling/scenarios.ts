/**
 * The scenario projections.
 *
 * Every function here is pure — facts in, a scenario out — and none of them
 * contains any emissions arithmetic of its own. Emissions come from the stored
 * calculation, the solar sizing comes from `recommendationEngine/solarSizing`,
 * and the liability and CCTS position come from the same two functions the
 * regulatory reports are priced with. This module's job is only to say what
 * changes under a scenario and to hand the changed inputs back to those.
 *
 * That constraint is the whole feature. A projection that used its own
 * simplified liability formula would eventually disagree with the customer's
 * own CBAM report, and a forward projection that contradicts the filed number
 * is worse than no forward projection at all.
 */
import {
  computeCbamCertificateArithmetic,
  cctsPositionTco2e,
} from "../cbamFinancialImpact.service";
import { SOLAR_SPECIFIC_YIELD_KWH_PER_KWP_YEAR, SOLAR_OFFSET_DESIGN_RANGE, type Citation } from "../../data/decarbonizationBenchmarks";
import { sizeSolarSystem } from "../recommendationEngine/solarSizing";
import { HIGH_ELECTRICITY_SHARE_PCT } from "../recommendationEngine/rules";
import type { SanctionedLoad } from "../recommendationEngine/rules";
import type { RecommendationInput } from "../recommendationEngine/types";
import type { PathwayMetric, PathwayScenario, ProjectedValue } from "./types";

const DAYS_PER_YEAR = 365;

/** Decimals each metric is allowed to be printed to. See ProjectedValue.decimals. */
export const METRIC_DECIMALS = {
  TOTAL_EMISSIONS_TCO2E: 1,
  /** Whole euros. Pricing a projected tonnage to the cent is precision the tonnage never had. */
  CBAM_LIABILITY_EUR: 0,
  CCTS_POSITION_TCO2E: 1,
} as const;

const roundTo = (n: number, dp: number) => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

const fmt = (n: number, dp = 0) =>
  n.toLocaleString("en-IN", { minimumFractionDigits: dp, maximumFractionDigits: dp });

const pct = (n: number, dp = 1) => Number(n.toFixed(dp));

const needsReview = (citations: Citation[]) => citations.some((c) => c.verification === "NEEDS_COMPLIANCE_REVIEW");

/**
 * Builds a ProjectedValue, rounding both ends to the precision the metric
 * supports before anything downstream can read them.
 *
 * Rounding here rather than in the UI is deliberate: the API response is a
 * surface of its own, and a caller that pulled 41307.638214 out of the JSON
 * would be reading five digits of precision the projection does not have.
 *
 * `isPoint` means "print one number", not "this is certain" — it is true when
 * the two ends coincide at the metric's own precision, which happens both for
 * exact arithmetic on a stated assumption and for a range too narrow to show.
 * The claim about *why* always lives in `basis`.
 */
const projected = (low: number, high: number, decimals: number, basis: string): ProjectedValue => {
  const l = roundTo(Math.min(low, high), decimals);
  const h = roundTo(Math.max(low, high), decimals);
  return { low: l, high: h, isPoint: l === h, decimals, basis };
};

const change = (metric: PathwayMetric): Pick<PathwayMetric, "changeLow" | "changeHigh"> => {
  if (metric.current === null || metric.projected === null) return { changeLow: null, changeHigh: null };
  const current = metric.current;
  return {
    changeLow: roundTo(metric.projected.low - current, metric.projected.decimals),
    changeHigh: roundTo(metric.projected.high - current, metric.projected.decimals),
  };
};

const withChange = (metric: Omit<PathwayMetric, "changeLow" | "changeHigh">): PathwayMetric => {
  const full = { ...metric, changeLow: null, changeHigh: null } as PathwayMetric;
  return { ...full, ...change(full) };
};

// ---------------------------------------------------------------------------
// Facts
// ---------------------------------------------------------------------------

export type PathwayFacts = {
  /** Stored CBAM/AR5 total for the reporting period, tCO2e. */
  totalEmissionsCbamAr5: number;
  /** Stored CCTS/AR2-BUR3 total for the same period, tCO2e. */
  totalEmissionsCctsAr2Bur3: number;
  /** Stored CCTS GHG intensity, tCO2e per unit of production. */
  ghgIntensityCcts: number;
  /**
   * Production for the period — tonnes of product, or MWh exported to the EU
   * for the electricity sector, matching what the CBAM report prices against.
   * Null or zero disables every intensity- and production-based projection.
   */
  production: number | null;
  productionBasisLabel: string;
  certificatePrice: number;
  certificatePriceCitation: Citation;
  carbonPricePaidEurPerTonne: number;
  /** BEE-notified intensity target. Null until BEE notifies one for the sub-sector. */
  cctsTargetIntensity: number | null;

  // --- Solar scenario ------------------------------------------------------
  /** tCO2e removed per MWh of grid supply displaced, at the factor in force. */
  emissionFactorUsed: number;
  /**
   * Scope 2 electricity as a share of total CBAM-basis emissions, derived the
   * same way `buildComposition` derives it. The solar scenario fires on the
   * same threshold the solar *recommendation* fires on, so the pathway can
   * never offer to project a capacity that was never recommended.
   */
  scope2ElectricitySharePct: number;
  annualisedGridMwh: number | null;
  reportingPeriodDays: number | null;
  sanctionedLoad: SanctionedLoad | null;
  /** Why sanctionedLoad is null, carried straight through from the recommendation engine. */
  sanctionedLoadAbsenceReason: string | null;

  // --- Business-as-usual ---------------------------------------------------
  /** Submitted periods with a calculation, oldest first. At least two are needed for a trend. */
  history: Array<{ periodEnd: Date | null; production: number | null }>;
};

// ---------------------------------------------------------------------------
// The projection kernel: hold intensity, move production
// ---------------------------------------------------------------------------

type VolumeProjection = {
  production: number;
  totalEmissionsCbamAr5: number;
  totalEmissionsCctsAr2Bur3: number;
  netLiabilityEur: number;
  cctsPositionTco2e: number | null;
};

/**
 * Projects the position at a given percentage change in production volume,
 * holding emissions intensity at today's calculated value.
 *
 * Holding intensity is the whole model, and it is stated rather than hidden:
 * emissions are volume times intensity, so a volume scenario that did anything
 * else would need a fixed-versus-variable split of this plant's emissions,
 * which the platform does not hold. Inventing one would be the same mistake the
 * recommendation engine deliberately refuses to make with its volume-versus-
 * intensity split. So intensity is held, the assumption is printed above the
 * numbers, and the arithmetic below it is exact.
 *
 * Both the "Production change" and "Business as usual" scenarios run through
 * here — BAU is a production change whose percentage comes from the facility's
 * own observed history instead of from a text box.
 */
export const projectVolumeChange = (facts: PathwayFacts, changePct: number): VolumeProjection | null => {
  if (facts.production === null || facts.production <= 0) return null;

  const factor = 1 + changePct / 100;
  const production = facts.production * factor;
  const totalEmissionsCbamAr5 = facts.totalEmissionsCbamAr5 * factor;
  const totalEmissionsCctsAr2Bur3 = facts.totalEmissionsCctsAr2Bur3 * factor;

  const { netLiabilityEur } = computeCbamCertificateArithmetic({
    totalEmissionsCbamAr5,
    production,
    carbonPricePaidEurPerTonne: facts.carbonPricePaidEurPerTonne,
    certificatePrice: facts.certificatePrice,
  });

  return {
    production,
    totalEmissionsCbamAr5,
    totalEmissionsCctsAr2Bur3,
    netLiabilityEur,
    // Intensity is unchanged by construction, so the position moves with volume
    // alone — a facility already in surplus banks proportionally more of it.
    cctsPositionTco2e:
      facts.cctsTargetIntensity === null
        ? null
        : cctsPositionTco2e(facts.cctsTargetIntensity, facts.ghgIntensityCcts, production),
  };
};

// ---------------------------------------------------------------------------
// Shared metric builders
// ---------------------------------------------------------------------------

const currentLiability = (facts: PathwayFacts): number =>
  computeCbamCertificateArithmetic({
    totalEmissionsCbamAr5: facts.totalEmissionsCbamAr5,
    production: facts.production ?? 0,
    carbonPricePaidEurPerTonne: facts.carbonPricePaidEurPerTonne,
    certificatePrice: facts.certificatePrice,
  }).netLiabilityEur;

export const currentCctsPosition = (facts: PathwayFacts): number | null =>
  facts.cctsTargetIntensity === null || facts.production === null
    ? null
    : cctsPositionTco2e(facts.cctsTargetIntensity, facts.ghgIntensityCcts, facts.production);

/**
 * The CCTS metric when there is no notified target.
 *
 * A surplus/deficit against an un-notified target does not exist, so nothing is
 * projected and the absence is explained. This is the same refusal the CBAM
 * report makes with its `pending: true` position.
 */
const cctsUnavailable = (reason: string): Omit<PathwayMetric, "changeLow" | "changeHigh"> => ({
  metric: "CCTS_POSITION_TCO2E",
  label: "CCTS position vs notified target",
  unit: "tCO2e",
  current: null,
  currentSource: "PLATFORM_CALCULATION",
  projected: null,
  projectedFrom: "",
  lowerIsBetter: false,
  unavailableReason: reason,
  inputs: [],
  citations: [],
  caveats: [],
});

const NO_TARGET_REASON =
  "No BEE-notified GHG emission intensity target is recorded for this facility's sub-sector and compliance cycle, so there is no surplus or deficit to state today and none to project. Once the target is notified and entered against the reporting period, this scenario will project the position with it.";

const NO_PRODUCTION_REASON =
  "This reporting period records no production quantity, so emissions intensity cannot be derived and a volume-based projection has nothing to scale. Enter the production quantity on the activity data entry for this period.";

// ---------------------------------------------------------------------------
// Scenario 1 — adopt the recommended solar capacity
// ---------------------------------------------------------------------------

const SOLAR_ASSUMPTION =
  "Projects the same reporting period as if the capacity IntelloAdvisor already sized for this facility had been operating throughout it, at unchanged production and unchanged grid tariff. It is not a project appraisal: it assumes the system is built, is commissioned for the whole period, and performs at the published specific yield.";

export const solarAdoptionScenario = (facts: PathwayFacts, certPriceCitation: Citation): PathwayScenario => {
  const base = {
    id: "SOLAR_RECOMMENDED_CAPACITY" as const,
    title: "Adopt the recommended solar capacity",
    summary: "What this period would have looked like with the sized system running",
    assumption: SOLAR_ASSUMPTION,
  };

  // Same trigger as solarSelfGenerationRule. Without it the pathway would
  // offer to project "the recommended capacity" for a facility whose
  // recommendations contain no solar card at all — a scenario referring to
  // advice that was never given.
  if (facts.scope2ElectricitySharePct < HIGH_ELECTRICITY_SHARE_PCT) {
    return {
      ...base,
      metrics: [],
      unavailableReason:
        `Grid electricity is ${pct(facts.scope2ElectricitySharePct)}% of this facility's total CBAM-basis emissions, below the ` +
        `${HIGH_ELECTRICITY_SHARE_PCT}% share at which IntelloAdvisor recommends solar self-generation as a material lever. No solar ` +
        `capacity has been recommended for this facility, so there is none to project. The fuel and process levers on the ` +
        `recommendations above are where this profile's emissions sit.`,
      requiresComplianceReview: false,
    };
  }

  if (!facts.sanctionedLoad || facts.annualisedGridMwh === null || facts.annualisedGridMwh <= 0 || !facts.reportingPeriodDays) {
    return {
      ...base,
      metrics: [],
      unavailableReason:
        facts.sanctionedLoadAbsenceReason ??
        "This scenario projects the capacity the solar recommendation sized, and no capacity could be sized for this facility — sizing needs the sanctioned load from an uploaded electricity bill and the length of the reporting period. Nothing is projected rather than a default system size assumed.",
      requiresComplianceReview: false,
    };
  }

  const sizing = sizeSolarSystem({
    annualisedGridMwh: facts.annualisedGridMwh,
    sanctionedLoadValue: facts.sanctionedLoad.value,
    emissionFactorUsed: facts.emissionFactorUsed,
  });

  // The sizing is annual; the position being projected is one reporting period.
  // Scaling the annual saving by the period's share of a year puts the two on
  // the same basis — the alternative, comparing an annual saving against a
  // quarterly liability, would overstate the effect by four.
  const periodShare = facts.reportingPeriodDays / DAYS_PER_YEAR;
  const savedLow = sizing.savedLowCo2e * periodShare;
  const savedHigh = sizing.savedHighCo2e * periodShare;

  const citations: Citation[] = [SOLAR_SPECIFIC_YIELD_KWH_PER_KWP_YEAR.citation, certPriceCitation];

  const sizingInputs: RecommendationInput[] = [
    {
      label: "Sanctioned load",
      value: `${fmt(facts.sanctionedLoad.value)} ${facts.sanctionedLoad.unit}`,
      source: "BILL_EXTRACTION",
    },
    {
      label: "Annualised grid consumption",
      value: `${fmt(facts.annualisedGridMwh)} MWh/year`,
      source: "PLATFORM_CALCULATION",
    },
    {
      label: "Solar specific yield assumed",
      value: `${fmt(sizing.yieldLow)}–${fmt(sizing.yieldHigh)} kWh/kWp/year`,
      source: "PUBLISHED_BENCHMARK",
    },
    {
      label: "Capacity modelled",
      value: `${fmt(sizing.lowKwp)}–${fmt(sizing.highKwp)} kWp`,
      source: "PROJECTED",
      derivedFrom: "your solar recommendation's sizing",
    },
    {
      label: "Grid supply displaced this period",
      value: `${fmt(sizing.genLowMwh * periodShare, 1)}–${fmt(sizing.genHighMwh * periodShare, 1)} MWh`,
      source: "PROJECTED",
      derivedFrom: "the modelled capacity at the published yield",
    },
    {
      label: "Grid emission factor applied",
      value: `${facts.emissionFactorUsed} tCO2e/MWh`,
      source: "PLATFORM_CALCULATION",
    },
  ];

  const sharedCaveats = [
    `Indicative sizing only, capped at the ${fmt(facts.sanctionedLoad.value)} ${facts.sanctionedLoad.unit} sanctioned load read from your bill. Actual capacity depends on shadow-free roof or land area, structural loading and sanctioned-load headroom at the time of application — none of which this platform holds.`,
    "Displaced generation is capped at the grid supply actually drawn. Anything beyond that is export, which is a different commercial arrangement and a different emissions claim, and is not modelled here.",
    "No capital cost, tariff, open-access charge or payback is modelled. This projects the emissions and liability position only.",
  ];

  const yieldBasis =
    `Range spans a ${pct(SOLAR_OFFSET_DESIGN_RANGE.low * 100, 0)}% offset of annualised grid consumption at ${fmt(sizing.yieldHigh)} kWh/kWp/year ` +
    `through a ${pct(SOLAR_OFFSET_DESIGN_RANGE.high * 100, 0)}% offset at ${fmt(sizing.yieldLow)} kWh/kWp/year — ` +
    `${fmt(savedHigh, 1)} tCO2e avoided at the optimistic end, ${fmt(savedLow, 1)} tCO2e at the conservative end, over this ${facts.reportingPeriodDays}-day period.`;

  const emissions = withChange({
    metric: "TOTAL_EMISSIONS_TCO2E",
    label: "Total emissions",
    unit: "tCO2e",
    current: roundTo(facts.totalEmissionsCbamAr5, METRIC_DECIMALS.TOTAL_EMISSIONS_TCO2E),
    currentSource: "PLATFORM_CALCULATION",
    projected: projected(
      facts.totalEmissionsCbamAr5 - savedHigh,
      facts.totalEmissionsCbamAr5 - savedLow,
      METRIC_DECIMALS.TOTAL_EMISSIONS_TCO2E,
      yieldBasis,
    ),
    projectedFrom: "your solar recommendation's sizing",
    lowerIsBetter: true,
    unavailableReason: null,
    inputs: sizingInputs,
    citations,
    caveats: sharedCaveats,
  });

  const liabilityLow = computeCbamCertificateArithmetic({
    totalEmissionsCbamAr5: facts.totalEmissionsCbamAr5 - savedHigh,
    production: facts.production ?? 0,
    carbonPricePaidEurPerTonne: facts.carbonPricePaidEurPerTonne,
    certificatePrice: facts.certificatePrice,
  }).netLiabilityEur;
  const liabilityHigh = computeCbamCertificateArithmetic({
    totalEmissionsCbamAr5: facts.totalEmissionsCbamAr5 - savedLow,
    production: facts.production ?? 0,
    carbonPricePaidEurPerTonne: facts.carbonPricePaidEurPerTonne,
    certificatePrice: facts.certificatePrice,
  }).netLiabilityEur;

  const liability = withChange({
    metric: "CBAM_LIABILITY_EUR",
    label: "CBAM liability",
    unit: "EUR",
    current: roundTo(currentLiability(facts), METRIC_DECIMALS.CBAM_LIABILITY_EUR),
    currentSource: "PLATFORM_CALCULATION",
    projected: projected(liabilityLow, liabilityHigh, METRIC_DECIMALS.CBAM_LIABILITY_EUR, `${yieldBasis} Priced at the ${facts.certificatePrice} EUR/tCO2e certificate price in force, held constant across the comparison.`),
    projectedFrom: "the projected emissions above, at today's certificate price",
    lowerIsBetter: true,
    unavailableReason: null,
    inputs: [
      ...sizingInputs,
      { label: "CBAM certificate price", value: `${facts.certificatePrice} EUR/tCO2e`, source: "PUBLISHED_BENCHMARK" },
    ],
    citations,
    caveats: [
      ...sharedCaveats,
      "Both sides of this comparison are priced at today's certificate price. The projection is a change in tonnage, not a forecast of the certificate price, which moves quarterly with the EU ETS.",
    ],
  });

  const currentPosition = currentCctsPosition(facts);
  let ccts: Omit<PathwayMetric, "changeLow" | "changeHigh">;

  if (facts.cctsTargetIntensity === null) {
    ccts = cctsUnavailable(NO_TARGET_REASON);
  } else if (facts.production === null || facts.production <= 0) {
    ccts = cctsUnavailable(NO_PRODUCTION_REASON);
  } else {
    const production = facts.production;
    // Grid electricity emissions are a single CO2e column shared by both
    // regulatory totals — the grid factor carries no GWP-table dependency — so
    // the tonnes displaced by solar come off the CCTS/AR2-BUR3 total exactly as
    // they come off the CBAM/AR5 one. This is a property of the stored
    // calculation, not an assumption made here.
    const intensityLow = (facts.totalEmissionsCctsAr2Bur3 - savedHigh) / production;
    const intensityHigh = (facts.totalEmissionsCctsAr2Bur3 - savedLow) / production;
    const target = facts.cctsTargetIntensity;

    ccts = {
      metric: "CCTS_POSITION_TCO2E",
      label: "CCTS position vs notified target",
      unit: "tCO2e",
      current: currentPosition === null ? null : roundTo(currentPosition, METRIC_DECIMALS.CCTS_POSITION_TCO2E),
      currentSource: "PLATFORM_CALCULATION",
      projected: projected(
        cctsPositionTco2e(target, intensityHigh, production),
        cctsPositionTco2e(target, intensityLow, production),
        METRIC_DECIMALS.CCTS_POSITION_TCO2E,
        `Positive is a surplus against the notified target of ${target} tCO2e/t, negative a deficit. ${yieldBasis} Production is held at ${fmt(production, 2)} ${facts.productionBasisLabel}, so the position moves only with the displaced grid emissions.`,
      ),
      projectedFrom: "the displaced grid emissions above, against your notified CCTS intensity target",
      lowerIsBetter: false,
      unavailableReason: null,
      inputs: [
        ...sizingInputs,
        { label: "Notified CCTS intensity target", value: `${target} tCO2e/t`, source: "PLATFORM_CALCULATION" },
        {
          label: "Projected GHG intensity",
          value: `${intensityLow.toFixed(4)}–${intensityHigh.toFixed(4)} tCO2e/t`,
          source: "PROJECTED",
          derivedFrom: "the displaced grid emissions at unchanged production",
        },
      ],
      citations,
      caveats: [
        ...sharedCaveats,
        "The CCTS position is stated on the CCTS/AR2-BUR3 basis, against the notified target held for this reporting period. A target revised for a later compliance cycle would change the position without any change at the plant.",
      ],
    };
  }

  return {
    ...base,
    metrics: [emissions, liability, withChange(ccts)],
    unavailableReason: null,
    requiresComplianceReview: needsReview(citations),
  };
};

// ---------------------------------------------------------------------------
// Scenario 2 — a production volume change
// ---------------------------------------------------------------------------

const HELD_INTENSITY_CAVEAT =
  "Emissions intensity is held at this period's calculated value, so emissions move in exact proportion to volume. Real plants carry some load that does not scale with output, which would make a decrease slightly less favourable and an increase slightly more favourable than shown. This platform does not hold a fixed-versus-variable split of this facility's emissions and does not invent one, so the assumption is stated rather than modelled around.";

/**
 * Builds the three metrics for any volume-change projection.
 *
 * Shared by the customer-entered production change and by business-as-usual,
 * because the two are the same projection with the percentage sourced
 * differently. `lowPct` and `highPct` are equal for a single stated change.
 */
const volumeChangeMetrics = (
  facts: PathwayFacts,
  lowPct: number,
  highPct: number,
  options: { basisSuffix: string; projectedFromSuffix: string; extraInputs: RecommendationInput[]; extraCaveats: string[]; citations: Citation[] },
): PathwayMetric[] | null => {
  const a = projectVolumeChange(facts, lowPct);
  const b = projectVolumeChange(facts, highPct);
  if (!a || !b) return null;

  const production = facts.production!;
  const volumeInputs: RecommendationInput[] = [
    {
      label: "Production this period",
      value: `${fmt(production, 2)} ${facts.productionBasisLabel}`,
      source: "PLATFORM_CALCULATION",
    },
    {
      label: "Emissions intensity held at",
      value: `${facts.ghgIntensityCcts.toFixed(4)} tCO2e/t (CCTS basis)`,
      source: "PLATFORM_CALCULATION",
    },
    {
      label: "Projected production",
      value:
        lowPct === highPct
          ? `${fmt(a.production, 2)} ${facts.productionBasisLabel}`
          : `${fmt(Math.min(a.production, b.production), 2)}–${fmt(Math.max(a.production, b.production), 2)} ${facts.productionBasisLabel}`,
      source: "PROJECTED",
      derivedFrom: options.projectedFromSuffix,
    },
    ...options.extraInputs,
  ];

  const caveats = [HELD_INTENSITY_CAVEAT, ...options.extraCaveats];

  const emissions = withChange({
    metric: "TOTAL_EMISSIONS_TCO2E",
    label: "Total emissions",
    unit: "tCO2e",
    current: roundTo(facts.totalEmissionsCbamAr5, METRIC_DECIMALS.TOTAL_EMISSIONS_TCO2E),
    currentSource: "PLATFORM_CALCULATION",
    projected: projected(
      a.totalEmissionsCbamAr5,
      b.totalEmissionsCbamAr5,
      METRIC_DECIMALS.TOTAL_EMISSIONS_TCO2E,
      options.basisSuffix,
    ),
    projectedFrom: `this period's calculated emissions at ${options.projectedFromSuffix}`,
    lowerIsBetter: true,
    unavailableReason: null,
    inputs: volumeInputs,
    citations: options.citations,
    caveats,
  });

  const liability = withChange({
    metric: "CBAM_LIABILITY_EUR",
    label: "CBAM liability",
    unit: "EUR",
    current: roundTo(currentLiability(facts), METRIC_DECIMALS.CBAM_LIABILITY_EUR),
    currentSource: "PLATFORM_CALCULATION",
    projected: projected(
      a.netLiabilityEur,
      b.netLiabilityEur,
      METRIC_DECIMALS.CBAM_LIABILITY_EUR,
      `${options.basisSuffix} Priced at the ${facts.certificatePrice} EUR/tCO2e certificate price in force, held constant across the comparison.`,
    ),
    projectedFrom: `the projected emissions above, at today's certificate price`,
    lowerIsBetter: true,
    unavailableReason: null,
    inputs: [
      ...volumeInputs,
      { label: "CBAM certificate price", value: `${facts.certificatePrice} EUR/tCO2e`, source: "PUBLISHED_BENCHMARK" },
    ],
    citations: options.citations,
    caveats: [
      ...caveats,
      "Both sides of this comparison are priced at today's certificate price. The projection is a change in tonnage, not a forecast of the certificate price, which moves quarterly with the EU ETS.",
      ...(facts.carbonPricePaidEurPerTonne > 0
        ? [
            `An Article 9 deduction for a carbon price of ${facts.carbonPricePaidEurPerTonne} EUR/tCO2e paid at origin is applied to both sides. That deduction scales with production, so it moves with the volume change rather than staying fixed.`,
          ]
        : []),
    ],
  });

  let ccts: Omit<PathwayMetric, "changeLow" | "changeHigh">;
  if (facts.cctsTargetIntensity === null) {
    ccts = cctsUnavailable(NO_TARGET_REASON);
  } else {
    const current = currentCctsPosition(facts);
    ccts = {
      metric: "CCTS_POSITION_TCO2E",
      label: "CCTS position vs notified target",
      unit: "tCO2e",
      current: current === null ? null : roundTo(current, METRIC_DECIMALS.CCTS_POSITION_TCO2E),
      currentSource: "PLATFORM_CALCULATION",
      projected: projected(
        a.cctsPositionTco2e!,
        b.cctsPositionTco2e!,
        METRIC_DECIMALS.CCTS_POSITION_TCO2E,
        `Positive is a surplus against the notified target of ${facts.cctsTargetIntensity} tCO2e/t, negative a deficit. Intensity is unchanged under this scenario, so the position scales with volume alone: a facility in surplus banks proportionally more of it as output rises, and a facility in deficit owes proportionally more. ${options.basisSuffix}`,
      ),
      projectedFrom: `your unchanged calculated intensity at ${options.projectedFromSuffix}`,
      lowerIsBetter: false,
      unavailableReason: null,
      inputs: [
        ...volumeInputs,
        { label: "Notified CCTS intensity target", value: `${facts.cctsTargetIntensity} tCO2e/t`, source: "PLATFORM_CALCULATION" },
      ],
      citations: options.citations,
      caveats: [
        ...caveats,
        "Intensity is what the CCTS target is set against, and this scenario does not move it. A volume change alone never brings a facility over its notified target — it only changes how many tonnes of surplus or deficit that position is worth.",
      ],
    };
  }

  return [emissions, liability, withChange(ccts)];
};

export const productionChangeScenario = (
  facts: PathwayFacts,
  changePct: number | null,
  certPriceCitation: Citation,
): PathwayScenario => {
  const direction = changePct === null ? "" : changePct >= 0 ? "increase" : "decrease";
  const base = {
    id: "PRODUCTION_CHANGE" as const,
    title:
      changePct === null
        ? "Production change"
        : `Production ${direction} of ${Math.abs(changePct)}%`,
    summary: "Scale this period's position to a different production volume",
    assumption:
      changePct === null
        ? "Enter a percentage change in production volume and this scenario projects the same reporting period at that volume, holding emissions intensity at its calculated value."
        : `Projects the same reporting period at ${Math.abs(changePct)}% ${direction === "increase" ? "higher" : "lower"} production, holding emissions intensity at this period's calculated value. Everything else — fuel mix, grid factor, certificate price and the notified CCTS target — is held as it is today.`,
  };

  if (changePct === null) {
    return {
      ...base,
      metrics: [],
      unavailableReason:
        "No production change has been entered. Enter a percentage change and this scenario will project the position at that volume — nothing is assumed on your behalf.",
      requiresComplianceReview: false,
    };
  }

  if (facts.production === null || facts.production <= 0) {
    return { ...base, metrics: [], unavailableReason: NO_PRODUCTION_REASON, requiresComplianceReview: false };
  }

  const citations = [certPriceCitation];
  const metrics = volumeChangeMetrics(facts, changePct, changePct, {
    basisSuffix: `A stated ${Math.abs(changePct)}% ${direction} in production volume at held intensity — the arithmetic is exact given that assumption, which is why a single figure is shown rather than a range.`,
    projectedFromSuffix: `a stated ${Math.abs(changePct)}% production ${direction}`,
    extraInputs: [
      { label: "Production change entered", value: `${changePct > 0 ? "+" : ""}${changePct}%`, source: "FACILITY_PROFILE" },
    ],
    extraCaveats: [],
    citations,
  });

  if (!metrics) {
    return { ...base, metrics: [], unavailableReason: NO_PRODUCTION_REASON, requiresComplianceReview: false };
  }

  return { ...base, metrics, unavailableReason: null, requiresComplianceReview: needsReview(citations) };
};

// ---------------------------------------------------------------------------
// Scenario 3 — business as usual
// ---------------------------------------------------------------------------

/**
 * Period-over-period production growth rates observed in this facility's own
 * submitted history, oldest pair first.
 *
 * Only real, submitted, calculated periods count, and a pair whose earlier
 * period recorded no production yields no rate — a growth rate off a zero base
 * does not exist. This is the only place BAU gets its numbers from: there is no
 * sector growth assumption, no national trend, and no default.
 */
export const observedProductionGrowthPct = (history: PathwayFacts["history"]): number[] => {
  const rates: number[] = [];
  for (let i = 1; i < history.length; i++) {
    const prev = history[i - 1].production;
    const curr = history[i].production;
    if (prev === null || curr === null || prev <= 0) continue;
    rates.push(((curr - prev) / prev) * 100);
  }
  return rates;
};

export const businessAsUsualScenario = (facts: PathwayFacts, certPriceCitation: Citation): PathwayScenario => {
  const base = {
    id: "BUSINESS_AS_USUAL" as const,
    title: "No change (business as usual)",
    summary: "Carry this facility's own observed production trend forward one period",
    assumption:
      "Projects the next reporting period of the same length at this facility's own observed production trend, holding emissions intensity at its calculated value. The trend comes only from periods you have submitted — there is no sector growth rate or national trend behind it.",
  };

  const rates = observedProductionGrowthPct(facts.history);

  if (facts.production === null || facts.production <= 0) {
    return { ...base, metrics: [], unavailableReason: NO_PRODUCTION_REASON, requiresComplianceReview: false };
  }

  if (rates.length === 0) {
    return {
      ...base,
      metrics: [],
      unavailableReason:
        "A business-as-usual projection needs at least two submitted reporting periods with production recorded, so this facility's own trend can be measured. There is only one, and a trend cannot be drawn through a single point — so nothing is projected rather than a growth rate assumed.",
      requiresComplianceReview: false,
    };
  }

  const lowPct = Math.min(...rates);
  const highPct = Math.max(...rates);
  const single = rates.length === 1;

  const observedLabel = single
    ? `${lowPct >= 0 ? "+" : ""}${pct(lowPct)}%`
    : `${pct(lowPct)}% to ${highPct >= 0 ? "+" : ""}${pct(highPct)}%`;

  const basisSuffix = single
    ? `Your own submitted history contains one period-over-period change in production, ${observedLabel}, and that single change is carried forward. One observation is not a trend, which is why no range is shown and why this figure should be read as "the last move repeated", not as a forecast.`
    : `Range spans the slowest and fastest period-over-period changes in production actually observed across your submitted periods (${observedLabel}, from ${rates.length} observed changes). It is the span of your own history, not a confidence interval.`;

  const citations = [certPriceCitation];
  const metrics = volumeChangeMetrics(facts, lowPct, highPct, {
    basisSuffix,
    projectedFromSuffix: `your own observed production trend (${observedLabel})`,
    extraInputs: [
      {
        label: "Observed production change per period",
        value: observedLabel,
        source: "PLATFORM_CALCULATION",
      },
      {
        label: "Periods compared",
        value: `${facts.history.length} submitted periods`,
        source: "PLATFORM_CALCULATION",
      },
    ],
    extraCaveats: [
      "This is a baseline for comparison, not a forecast. It extrapolates what has already happened at this facility and takes no view on order books, planned shutdowns, capacity additions or market conditions.",
      ...(single
        ? [
            "Only one period-over-period change exists in your submitted history. A second submitted period would let this show the span of your actual variation instead of repeating a single move.",
          ]
        : []),
    ],
    citations,
  });

  if (!metrics) {
    return { ...base, metrics: [], unavailableReason: NO_PRODUCTION_REASON, requiresComplianceReview: false };
  }

  return { ...base, metrics, unavailableReason: null, requiresComplianceReview: needsReview(citations) };
};
