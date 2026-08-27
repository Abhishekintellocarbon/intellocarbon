/**
 * Reads a facility's stored emissions calculation and reshapes it into the
 * composition the recommendation rules trigger on.
 *
 * This module derives; it never calculates. Every figure below is either a
 * column the calculation engine already wrote, or a share of one such column
 * over another. If a number here disagrees with the facility's report, the
 * report is right and this is a bug — there is deliberately no second
 * implementation of the emissions maths to drift out of step.
 */
import type { EmissionCalculationResult } from "@prisma/client";
import { getGridEmissionFactor, getGridEmissionFactorSource } from "../../data/emissionFactors";
import { SOLID_FOSSIL_FUEL_KEYS } from "../../data/decarbonizationBenchmarks";

export type ComponentShare = {
  co2e: number;
  /** Share of totalCo2e, 0-100. Zero when the total is zero. */
  sharePct: number;
};

export type FuelContribution = {
  fuelType: string;
  label: string;
  co2e: number;
  sharePct: number;
};

export type EmissionsComposition = {
  /**
   * Which regulatory total the shares are taken over. CBAM/AR5 rather than
   * CCTS/AR2-BUR3 because these recommendations are framed against CBAM
   * liability; the same facility on the CCTS basis has slightly different
   * shares, and quoting one while labelling it the other would be wrong.
   */
  basis: "CBAM_AR5";
  totalCo2e: number;
  scope1Combustion: ComponentShare;
  scope1Process: ComponentShare;
  scope2Electricity: ComponentShare;
  scope2Steam: ComponentShare;
  precursorEmbedded: ComponentShare;
  /**
   * Coal and coke only — the subset of scope1Combustion the fuel-switch rule
   * acts on. Null when the stored breakdown carries no readable fuel lines,
   * which is the honest answer for an entry with no fuel entries at all.
   */
  solidFossilFuel: (ComponentShare & { fuels: FuelContribution[] }) | null;
};

const shareOf = (co2e: number, total: number): ComponentShare => ({
  co2e,
  sharePct: total > 0 ? (co2e / total) * 100 : 0,
});

type BreakdownFuelLine = { fuelType?: unknown; label?: unknown; co2eAr5?: unknown };

/**
 * Pulls the per-fuel lines out of the stored `breakdown` JSON.
 *
 * Defensive because `breakdown` is a Json column with no schema behind it: a
 * row written by an older build, or by a future one that reshapes the key,
 * must degrade to "we can't see the fuel split" rather than throw inside a
 * recommendation request.
 */
const readFuelLines = (breakdown: unknown): FuelContribution[] | null => {
  if (typeof breakdown !== "object" || breakdown === null) return null;
  const fuels = (breakdown as { fuels?: unknown }).fuels;
  if (!Array.isArray(fuels)) return null;

  const lines: FuelContribution[] = [];
  for (const raw of fuels as BreakdownFuelLine[]) {
    if (typeof raw?.fuelType !== "string" || typeof raw?.co2eAr5 !== "number") return null;
    lines.push({
      fuelType: raw.fuelType,
      label: typeof raw.label === "string" ? raw.label : raw.fuelType,
      co2e: raw.co2eAr5,
      sharePct: 0,
    });
  }
  return lines;
};

export const buildComposition = (result: EmissionCalculationResult): EmissionsComposition => {
  const total = result.totalEmissionsCbamAr5;

  // Process emissions are the sum of three separately-stored streams:
  // calcination/oxidation CO2, aluminium PFCs and fertilizer nitric-acid N2O.
  // They are one line to a customer deciding what to act on, because none of
  // them is addressable by changing a fuel or a power contract.
  const processCo2e = result.directProcessCo2e + result.directPfcCo2eAr5 + result.directN2oProcessCo2eAr5;

  const fuelLines = readFuelLines(result.breakdown);
  const solidKeys = new Set<string>(SOLID_FOSSIL_FUEL_KEYS);
  const solidFossilFuel =
    fuelLines === null
      ? null
      : (() => {
          const matching = fuelLines
            .filter((l) => solidKeys.has(l.fuelType))
            .map((l) => ({ ...l, sharePct: total > 0 ? (l.co2e / total) * 100 : 0 }));
          const co2e = matching.reduce((sum, l) => sum + l.co2e, 0);
          return { ...shareOf(co2e, total), fuels: matching };
        })();

  return {
    basis: "CBAM_AR5",
    totalCo2e: total,
    scope1Combustion: shareOf(result.directCombustionCo2eAr5, total),
    scope1Process: shareOf(processCo2e, total),
    scope2Electricity: shareOf(result.indirectElectricityCo2e, total),
    scope2Steam: shareOf(result.indirectSteamCo2e, total),
    precursorEmbedded: shareOf(result.directPrecursorCo2e, total),
    solidFossilFuel,
  };
};

// ---------------------------------------------------------------------------
// Grid factor vs operational choice
// ---------------------------------------------------------------------------

export type GridFactorSplit = {
  scope2ElectricityCo2e: number;
  gridElectricityMwh: number;
  renewableElectricityMwh: number;
  emissionFactorUsed: number;
  nationalGridFactor: number;
  nationalGridFactorSource: string;

  /** Emissions attributable to the published national grid factor. */
  gridFactorDrivenCo2e: number;
  /**
   * Emissions attributable to this facility applying its own verified grid
   * factor instead of the national one. Negative when the facility's factor is
   * cleaner than the national average, zero when no override is in use.
   */
  facilityFactorChoiceCo2e: number;
  gridFactorDrivenSharePct: number;
  facilityFactorChoiceSharePct: number;

  /** tCO2e removed for each MWh moved off grid supply, at the factor in force. */
  co2ePerMwhDisplaced: number;
  /** Share of total electricity demand already met from renewable/captive supply, 0-100. */
  renewableSharePct: number;
  /** Emissions not incurred because that renewable share is already in place. */
  alreadyAvoidedCo2e: number;

  definitionNote: string;
  /** Why a volume-versus-intensity percentage split is deliberately not offered. */
  whyNoVolumeSplit: string;
};

/**
 * Splits Scope 2 electricity emissions into the part set by the published
 * national grid factor and the part set by this facility's own factor choice.
 *
 * The split is exact by construction: both terms are the same MWh figure times
 * a factor, and the two factors sum to the factor actually used. It cannot
 * drift, and the test asserts the identity rather than a tolerance.
 *
 * A word on what this deliberately does *not* do. The obvious reading of
 * "outside their control versus within their control" is intensity versus
 * volume — the grid's tCO2/MWh is CEA's, the MWh drawn is the plant's. But
 * emissions are the *product* of those two, and a product has no non-arbitrary
 * additive split between its factors: any percentage would depend entirely on
 * a reference point chosen here rather than published anywhere. On a platform
 * whose whole rule is that no figure is invented, quoting "62% of your Scope 2
 * is outside your control" would be the single least defensible number in the
 * product. So the engine reports the split it can derive exactly, reports the
 * displacement rate that makes the volume side actionable, and says plainly
 * why the third number does not exist.
 */
export const buildGridFactorSplit = (
  result: EmissionCalculationResult,
  activity: { gridElectricityMwh: number; renewableElectricityMwh: number },
): GridFactorSplit => {
  const nationalGridFactor = getGridEmissionFactor();
  const nationalGridFactorSource = getGridEmissionFactorSource();
  const emissionFactorUsed = result.gridEmissionFactorUsed;
  const gridMwh = activity.gridElectricityMwh;

  // Computed from MWh and factors rather than read from the stored, rounded
  // total, so the two components sum to this exactly.
  const scope2ElectricityCo2e = gridMwh * emissionFactorUsed;
  const gridFactorDrivenCo2e = gridMwh * nationalGridFactor;
  const facilityFactorChoiceCo2e = gridMwh * (emissionFactorUsed - nationalGridFactor);

  const totalElectricityMwh = gridMwh + activity.renewableElectricityMwh;

  return {
    scope2ElectricityCo2e,
    gridElectricityMwh: gridMwh,
    renewableElectricityMwh: activity.renewableElectricityMwh,
    emissionFactorUsed,
    nationalGridFactor,
    nationalGridFactorSource,
    gridFactorDrivenCo2e,
    facilityFactorChoiceCo2e,
    gridFactorDrivenSharePct: scope2ElectricityCo2e === 0 ? 0 : (gridFactorDrivenCo2e / scope2ElectricityCo2e) * 100,
    facilityFactorChoiceSharePct:
      scope2ElectricityCo2e === 0 ? 0 : (facilityFactorChoiceCo2e / scope2ElectricityCo2e) * 100,
    co2ePerMwhDisplaced: emissionFactorUsed,
    renewableSharePct: totalElectricityMwh > 0 ? (activity.renewableElectricityMwh / totalElectricityMwh) * 100 : 0,
    alreadyAvoidedCo2e: activity.renewableElectricityMwh * emissionFactorUsed,
    definitionNote:
      `Your Scope 2 electricity emissions are ${gridMwh} MWh of grid supply at ${emissionFactorUsed} tCO2e/MWh. ` +
      `Of that factor, ${nationalGridFactor} tCO2e/MWh is the published national grid figure (${nationalGridFactorSource}) — set by the national generation mix, not by this plant. ` +
      (Math.abs(emissionFactorUsed - nationalGridFactor) < 1e-9
        ? "No facility-specific factor is in use, so the whole of it is the national figure."
        : `The remaining ${(emissionFactorUsed - nationalGridFactor).toFixed(4)} tCO2e/MWh is this facility's own verified factor override.`),
    whyNoVolumeSplit:
      "The volume you draw is within your control and the grid's carbon intensity is not, but emissions are the product of the two — there is no non-arbitrary way to split a product into a percentage per factor. Rather than publish a number that depends on a reference point we chose, the actionable figure is the displacement rate: every MWh moved off grid supply removes " +
      `${emissionFactorUsed} tCO2e.`,
  };
};
