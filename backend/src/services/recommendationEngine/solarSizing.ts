/**
 * Solar system sizing — the one implementation.
 *
 * Extracted out of `solarSelfGenerationRule` when Pathway Modelling needed the
 * same numbers to project forward. It is deliberately a shared function rather
 * than a second copy of the arithmetic: a pathway that said "installing the
 * recommended capacity removes X tCO2e" while the recommendation card beside it
 * had sized a different system would be the single most damaging inconsistency
 * this feature could ship. There is one sizing calculation, and both callers
 * read it.
 *
 * Pure: annual consumption, a published yield range and the sanctioned load in,
 * a capacity and generation range out. No clock, no database, no benchmarks
 * beyond the two ranges passed in by the caller's import.
 */
import {
  SOLAR_SPECIFIC_YIELD_KWH_PER_KWP_YEAR,
  SOLAR_OFFSET_DESIGN_RANGE,
} from "../../data/decarbonizationBenchmarks";

export type SolarSizing = {
  /** Indicative installed capacity, kWp. */
  lowKwp: number;
  highKwp: number;
  /** Annual generation that capacity displaces from grid supply, MWh. */
  genLowMwh: number;
  genHighMwh: number;
  /** tCO2e/year avoided, at the grid factor actually applied to this facility. */
  savedLowCo2e: number;
  savedHighCo2e: number;
  /** True when the sanctioned load, not the design range, set the upper size. */
  cappedByLoad: boolean;
  yieldLow: number;
  yieldHigh: number;
};

/**
 * Sizes a system against annualised grid consumption, capped by the sanctioned
 * load read off the bill.
 *
 * The three bounds applied here are all conservative on purpose:
 *
 *   - the low end pairs the smaller offset target with the better yield (least
 *     capacity needed) and the high end the larger target with the poorer
 *     yield, which is the widest honest reading of the two published ranges;
 *   - kWp is capped against the sanctioned load figure directly even when that
 *     figure is printed in kVA, because real power in kW never exceeds apparent
 *     power in kVA — the bound holds without inventing a power factor the bill
 *     does not print;
 *   - generation is capped at consumption, since offsetting more than you draw
 *     is export, a different commercial arrangement and a different emissions
 *     claim.
 */
export const sizeSolarSystem = (input: {
  annualisedGridMwh: number;
  /** Sanctioned load as printed on the bill, in whatever unit it was printed in. */
  sanctionedLoadValue: number;
  /** tCO2e removed per MWh displaced — the factor actually applied to this facility. */
  emissionFactorUsed: number;
}): SolarSizing => {
  const yieldLow = SOLAR_SPECIFIC_YIELD_KWH_PER_KWP_YEAR.low;
  const yieldHigh = SOLAR_SPECIFIC_YIELD_KWH_PER_KWP_YEAR.high;
  const annualKwh = input.annualisedGridMwh * 1000;

  const rawLowKwp = (annualKwh * SOLAR_OFFSET_DESIGN_RANGE.low) / yieldHigh;
  const rawHighKwp = (annualKwh * SOLAR_OFFSET_DESIGN_RANGE.high) / yieldLow;

  const capKw = input.sanctionedLoadValue;
  const lowKwp = Math.min(rawLowKwp, capKw);
  const highKwp = Math.min(rawHighKwp, capKw);

  const genLowMwh = Math.min((lowKwp * yieldLow) / 1000, input.annualisedGridMwh);
  const genHighMwh = Math.min((highKwp * yieldHigh) / 1000, input.annualisedGridMwh);

  return {
    lowKwp,
    highKwp,
    genLowMwh,
    genHighMwh,
    savedLowCo2e: genLowMwh * input.emissionFactorUsed,
    savedHighCo2e: genHighMwh * input.emissionFactorUsed,
    cappedByLoad: rawHighKwp > capKw,
    yieldLow,
    yieldHigh,
  };
};
