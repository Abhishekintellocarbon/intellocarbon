import type { PathwayMetric, PathwayMetricId, ProjectedValue } from "./types";

/**
 * Formatting rules for projected figures.
 *
 * Pure, and separated from the components, because these are the rules that
 * carry the product's claims — a projection must not be printed to more
 * precision than the server says it has, a range must not be collapsed to a
 * midpoint, and a projected figure must not be formatted so that it reads like
 * a measured one. A component can be eyeballed; these can be tested.
 */

/**
 * A number at exactly the precision the server allowed.
 *
 * `decimals` is fixed at both ends, so 41,000 shows as "41,000" and never as
 * "41,000.38" — and 18,772.6 keeps its tenth rather than being rounded off to
 * look tidy next to a whole-euro figure beside it.
 */
export const formatAtPrecision = (value: number, decimals: number): string =>
  value.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

/**
 * A projected value as text.
 *
 * A range is always rendered as both ends joined by an en dash. It is never
 * averaged, never rounded to a "headline" figure, and never shown as one end
 * with the other in small print: the width of the range is the honest content
 * of the estimate. A point value — the server's own `isPoint` — prints once.
 */
export const formatProjected = (projected: ProjectedValue): string =>
  projected.isPoint
    ? formatAtPrecision(projected.low, projected.decimals)
    : `${formatAtPrecision(projected.low, projected.decimals)}–${formatAtPrecision(projected.high, projected.decimals)}`;

/** The change from current to projected, signed, at the same precision. */
export const formatChange = (metric: PathwayMetric): string | null => {
  if (metric.changeLow === null || metric.changeHigh === null || !metric.projected) return null;
  const dp = metric.projected.decimals;
  const sign = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "");
  const one = (n: number) => `${sign(n)}${formatAtPrecision(Math.abs(n), dp)}`;
  return metric.changeLow === metric.changeHigh ? one(metric.changeLow) : `${one(metric.changeLow)} to ${one(metric.changeHigh)}`;
};

export const METRIC_UNIT_SUFFIX: Record<PathwayMetricId, string> = {
  TOTAL_EMISSIONS_TCO2E: " tCO2e",
  CBAM_LIABILITY_EUR: " EUR",
  CCTS_POSITION_TCO2E: " tCO2e",
};

export type ChangeTone = "GOOD" | "BAD" | "NEUTRAL";

/**
 * Whether a projected move is good news for this facility.
 *
 * The sign alone does not say: emissions and liability falling is good, but the
 * CCTS position is a surplus and falling is bad. `lowerIsBetter` travels with
 * the metric from the server for exactly this reason.
 *
 * A range that straddles zero is NEUTRAL rather than tinted by whichever end is
 * larger — colouring "somewhere between a small improvement and a small
 * worsening" as an improvement would be the UI making a claim the projection
 * does not support.
 */
export const changeTone = (metric: PathwayMetric): ChangeTone => {
  if (metric.changeLow === null || metric.changeHigh === null) return "NEUTRAL";
  if (metric.changeLow === 0 && metric.changeHigh === 0) return "NEUTRAL";
  if (metric.changeLow < 0 && metric.changeHigh > 0) return "NEUTRAL";
  const falls = metric.changeHigh <= 0;
  return falls === metric.lowerIsBetter ? "GOOD" : "BAD";
};

/**
 * A CCTS position in words, since the sign of the number is not self-
 * explanatory: +200 tCO2e is 200 tonnes of surplus to bank or sell, −200 is a
 * deficit to cover.
 */
export const cctsPositionLabel = (value: number): "surplus" | "deficit" | "exactly at target" =>
  value > 0 ? "surplus" : value < 0 ? "deficit" : "exactly at target";
