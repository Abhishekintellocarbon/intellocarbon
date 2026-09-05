import type { Citation } from "../../data/decarbonizationBenchmarks";
import type { RecommendationInput } from "../recommendationEngine/types";

/**
 * IntelloAdvisor Phase 4 — Pathway Modelling.
 *
 * The output contract. Three things about it are load-bearing:
 *
 *   1. Every projected metric is a `ProjectedValue`, never a bare number, and a
 *      `ProjectedValue` always carries both ends of its range plus the words
 *      that say what those two ends are. Where the arithmetic is exact given a
 *      stated assumption the two ends are equal and `isPoint` says so — that is
 *      a different claim from "we averaged a range" and the UI renders it
 *      differently.
 *   2. `decimals` travels with the value. The projection cannot be printed to
 *      more precision than its inputs support, and the place that knows what
 *      the inputs support is here, not the component.
 *   3. `projectedFrom` is mandatory on every projected metric. It is what the
 *      "Projected from {X}" badge prints, so a projected figure can never reach
 *      a screen without saying what it was projected from.
 */

export type PathwayScenarioId =
  /** Install the capacity the solar recommendation already sized. */
  | "SOLAR_RECOMMENDED_CAPACITY"
  /** A customer-supplied percentage change in production volume. */
  | "PRODUCTION_CHANGE"
  /** Baseline: current position carried forward on the facility's own observed trend. */
  | "BUSINESS_AS_USUAL";

export type PathwayMetricId =
  | "TOTAL_EMISSIONS_TCO2E"
  | "CBAM_LIABILITY_EUR"
  | "CCTS_POSITION_TCO2E";

/**
 * A projected figure.
 *
 * `low` and `high` are the two ends of the honest range. They are equal only
 * when the projection is exact arithmetic on a stated assumption (a production
 * change at held intensity, for instance), and `isPoint` is then true so the UI
 * can say "exact given the assumption below" instead of drawing a zero-width
 * range bar that would read as spurious confidence.
 */
export type ProjectedValue = {
  low: number;
  high: number;
  isPoint: boolean;
  /**
   * Decimal places the underlying data supports. Currency gets 0 — pricing a
   * projected tonnage to the cent claims a precision the tonnage never had.
   */
  decimals: number;
  /** In words: what the two ends of this range actually are. */
  basis: string;
};

export type PathwayMetric = {
  metric: PathwayMetricId;
  label: string;
  unit: string;
  /**
   * The facility's position today, from the stored calculation. Null when the
   * platform does not hold it — a CCTS position with no BEE-notified target,
   * for instance — in which case there is nothing to project either.
   */
  current: number | null;
  /** Where `current` came from. Never PROJECTED. */
  currentSource: RecommendationInput["source"];
  /** Null whenever the scenario could not be projected; `unavailableReason` then says why. */
  projected: ProjectedValue | null;
  /** What the projection derives from. Printed by the badge as "Projected from {this}". */
  projectedFrom: string;
  /** projected − current, at each end. Null when either side is missing. */
  changeLow: number | null;
  changeHigh: number | null;
  /**
   * True where a fall in this metric is the good direction. Emissions and
   * liability fall; the CCTS position is a surplus and wants to rise, which is
   * why the UI cannot infer the tone from the sign alone.
   */
  lowerIsBetter: boolean;
  unavailableReason: string | null;
  inputs: RecommendationInput[];
  citations: Citation[];
  caveats: string[];
};

export type PathwayScenario = {
  id: PathwayScenarioId;
  title: string;
  /** One line for the selector. */
  summary: string;
  /** The full statement of what is being assumed, shown above the comparison. */
  assumption: string;
  metrics: PathwayMetric[];
  /**
   * Non-null when the whole scenario could not be modelled — no sanctioned
   * load for the solar case, no second period for the trend. The scenario is
   * still returned so the selector can offer it and explain itself, rather
   * than silently omitting an option.
   */
  unavailableReason: string | null;
  /** True when any citation behind this scenario is still NEEDS_COMPLIANCE_REVIEW. */
  requiresComplianceReview: boolean;
};

export type PathwayCurrentPosition = {
  totalEmissionsCbamAr5: number;
  ghgIntensityCcts: number;
  productionQuantityT: number | null;
  /** Tonnes, or MWh exported to the EU for the electricity sector. */
  productionBasisLabel: string;
  cbamNetLiabilityEur: number;
  cbamGrossLiabilityEur: number;
  certificatePrice: number;
  certificatePriceQuarter: string;
  certificatePriceSource: string;
  carbonPricePaidEurPerTonne: number;
  cctsTargetIntensity: number | null;
  cctsPositionTco2e: number | null;
};

export type PathwayReport = {
  facility: { id: string; name: string; state: string | null; sector: string };
  activityData: {
    id: string;
    periodStart: Date | null;
    periodEnd: Date | null;
    reportingPeriodDays: number | null;
  } | null;
  basedOnCalculationAt: Date | null;
  generatedAt: Date;
  engineVersion: string;
  basis: "CBAM_AR5";
  current: PathwayCurrentPosition | null;
  scenarios: PathwayScenario[];
  /** Non-null when nothing at all could be modelled; `scenarios` is then empty. */
  unavailableReason: string | null;
};
