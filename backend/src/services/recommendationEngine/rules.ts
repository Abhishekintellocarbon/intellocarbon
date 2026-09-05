/**
 * The rule set.
 *
 * Each rule is a pure function from already-derived facts to a card or null.
 * No database, no clock, no randomness, no network — so a rule's output is
 * fully determined by its inputs and a test can pin it exactly. Adding a rule
 * means adding a function here and listing it in index.ts; nothing else in the
 * engine needs to know it exists.
 *
 * Two conventions hold throughout:
 *   - a rule that lacks the data to size an impact still returns a card, with
 *     `impact: null` and a caveat naming what is missing. Silence would leave a
 *     customer thinking the lever does not apply to them.
 *   - every number in `explanation` also appears in `inputs` with a source.
 */
import {
  SOLAR_SPECIFIC_YIELD_KWH_PER_KWP_YEAR,
  SOLAR_OFFSET_DESIGN_RANGE,
  FUEL_CO2_PER_TJ,
  FUEL_SWITCH_QUOTED_SUBSTITUTION_SHARE,
  resolveOpenAccessProfile,
  type Citation,
  type ResolvedOpenAccess,
} from "../../data/decarbonizationBenchmarks";
import { sizeSolarSystem } from "./solarSizing";
import type { EmissionsComposition, GridFactorSplit } from "./composition";
import type { RecommendationCard } from "./types";

/**
 * Trigger thresholds.
 *
 * These are engine tuning — the point at which a lever is worth a customer's
 * attention — not claims about the world, which is why they live here and not
 * in the benchmarks file. Nothing downstream treats them as published figures.
 */
export const HIGH_ELECTRICITY_SHARE_PCT = 20;
export const HIGH_SOLID_FUEL_SHARE_PCT = 20;

const pct = (n: number, dp = 1) => Number(n.toFixed(dp));
const fmt = (n: number, dp = 0) => n.toLocaleString("en-IN", { minimumFractionDigits: dp, maximumFractionDigits: dp });

const needsReview = (citations: Citation[]) => citations.some((c) => c.verification === "NEEDS_COMPLIANCE_REVIEW");

export type SanctionedLoad = {
  value: number;
  /** As printed on the bill — KVA, KW or HP. Never converted; see the caveat this generates. */
  unit: string;
  discomName: string | null;
  tariffCode: string | null;
  /** State the billing utility supplies, per the Phase 1 discom registry. */
  state: string | null;
};

export type StateMismatchFact = {
  billState: string;
  facilityState: string;
  discomName: string | null;
  message: string;
};

export type SolarRuleFacts = {
  composition: EmissionsComposition;
  grid: GridFactorSplit;
  /** The state whose open-access rules apply — the bill's discom where known, else the facility's. */
  openAccessState: string | null;
  openAccessStateSource: "BILL_DISCOM" | "FACILITY_PROFILE" | "NONE";
  /** Non-null when the bill's state and the registered state disagree. */
  stateMismatch: StateMismatchFact | null;
  /** Null when no uploaded bill yielded one, or when two bills disagreed. */
  sanctionedLoad: SanctionedLoad | null;
  /** Reason sanctionedLoad is null, for the caveat text. */
  sanctionedLoadAbsenceReason: string | null;
  /** Grid MWh scaled to a full year from the reporting period. Null when the period length is unknown. */
  annualisedGridMwh: number | null;
  reportingPeriodDays: number | null;
};

/**
 * Rooftop / open-access solar self-generation.
 *
 * Fires on a high Scope 2 electricity share. Sizing needs three things — annual
 * consumption, a published specific yield, and the sanctioned load that caps
 * the connection — and if the sanctioned load is missing the card still ships
 * with the eligibility position and the state's rules, but the sizing section
 * is omitted entirely rather than filled with a default load.
 */
export const solarSelfGenerationRule = (facts: SolarRuleFacts): RecommendationCard | null => {
  const electricitySharePct = facts.composition.scope2Electricity.sharePct;
  if (electricitySharePct < HIGH_ELECTRICITY_SHARE_PCT) return null;

  const openAccess: ResolvedOpenAccess = resolveOpenAccessProfile(facts.openAccessState);
  const citations: Citation[] = [openAccess.citation];
  // A state mismatch leads the caveats. It is the one thing on this card that
  // can make every figure below it apply to the wrong regime, so it is not
  // buried behind two paragraphs of tariff detail.
  const caveats: string[] = facts.stateMismatch ? [facts.stateMismatch.message, openAccess.notes] : [openAccess.notes];

  const inputs: RecommendationCard["inputs"] = [
    {
      label: "Scope 2 electricity share of total emissions",
      value: `${pct(electricitySharePct)}%`,
      source: "PLATFORM_CALCULATION",
    },
    {
      label: "Grid electricity this reporting period",
      value: `${fmt(facts.grid.gridElectricityMwh, 2)} MWh`,
      source: "PLATFORM_CALCULATION",
    },
    {
      label: "Grid emission factor applied",
      value: `${facts.grid.emissionFactorUsed} tCO2e/MWh`,
      source: "PLATFORM_CALCULATION",
    },
    {
      label: `Open-access eligibility threshold${openAccess.stateSpecific ? ` (${openAccess.stateName})` : " (national floor)"}`,
      value: `${fmt(openAccess.openAccessMinimumLoadKw)} kW`,
      source: "PUBLISHED_BENCHMARK",
    },
  ];

  // Which state these rules were read for, and where that state came from.
  // Without this the reader cannot tell whether the regime shown follows their
  // bill or their address — which is exactly what a mismatch turns on.
  if (facts.openAccessState) {
    inputs.push({
      label: "Open-access rules shown for",
      value:
        facts.openAccessStateSource === "BILL_DISCOM"
          ? `${facts.openAccessState} (from the utility on your bill)`
          : `${facts.openAccessState} (from this facility's registered state)`,
      source: facts.openAccessStateSource === "BILL_DISCOM" ? "BILL_EXTRACTION" : "FACILITY_PROFILE",
    });
  }

  let explanation =
    `Grid electricity accounts for ${pct(electricitySharePct)}% of this facility's total CBAM-basis emissions — ` +
    `${fmt(facts.grid.scope2ElectricityCo2e, 1)} tCO2e from ${fmt(facts.grid.gridElectricityMwh, 2)} MWh drawn at ` +
    `${facts.grid.emissionFactorUsed} tCO2e/MWh. Self-generation displaces that supply one MWh at a time, so every ` +
    `MWh generated on site or procured through renewable open access removes ${facts.grid.emissionFactorUsed} tCO2e.`;

  let impact: RecommendationCard["impact"] = null;

  if (facts.sanctionedLoad && facts.annualisedGridMwh !== null && facts.annualisedGridMwh > 0) {
    const load = facts.sanctionedLoad;
    citations.push(SOLAR_SPECIFIC_YIELD_KWH_PER_KWP_YEAR.citation);

    // The sizing itself lives in solarSizing.ts, shared with Pathway Modelling,
    // so the capacity this card recommends and the capacity that feature
    // projects forward can never be two different systems.
    const sizing = sizeSolarSystem({
      annualisedGridMwh: facts.annualisedGridMwh,
      sanctionedLoadValue: load.value,
      emissionFactorUsed: facts.grid.emissionFactorUsed,
    });
    const { yieldLow, yieldHigh, lowKwp, highKwp, cappedByLoad } = sizing;

    // Both the saving and the total are put on the same annual basis, so the
    // percentage is a like-for-like share and not a period-length artefact.
    const annualisationFactor = facts.annualisedGridMwh / (facts.grid.gridElectricityMwh || facts.annualisedGridMwh);
    const annualisedTotalCo2e = facts.composition.totalCo2e * annualisationFactor;

    const savedLow = sizing.savedLowCo2e;
    const savedHigh = sizing.savedHighCo2e;

    inputs.push(
      {
        label: "Sanctioned load",
        value: `${fmt(load.value, 0)} ${load.unit}${load.discomName ? ` (${load.discomName})` : ""}`,
        source: "BILL_EXTRACTION",
      },
      {
        label: "Annualised grid consumption",
        value: `${fmt(facts.annualisedGridMwh, 0)} MWh/year`,
        source: "PLATFORM_CALCULATION",
      },
      {
        label: "Solar specific yield assumed",
        value: `${fmt(yieldLow)}–${fmt(yieldHigh)} kWh/kWp/year`,
        source: "PUBLISHED_BENCHMARK",
      },
      {
        label: "Indicative system size",
        value: `${fmt(lowKwp)}–${fmt(highKwp)} kWp`,
        source: "PUBLISHED_BENCHMARK",
      },
    );

    explanation +=
      ` Sized to offset ${pct(SOLAR_OFFSET_DESIGN_RANGE.low * 100, 0)}%–${pct(SOLAR_OFFSET_DESIGN_RANGE.high * 100, 0)}% of ` +
      `${fmt(facts.annualisedGridMwh, 0)} MWh of annualised grid consumption, at a published Indian specific yield of ` +
      `${fmt(yieldLow)}–${fmt(yieldHigh)} kWh/kWp/year, that is an indicative ${fmt(lowKwp)}–${fmt(highKwp)} kWp system` +
      (cappedByLoad ? `, capped by the ${fmt(load.value)} ${load.unit} sanctioned load on the bill.` : ".") +
      ` At ${fmt(openAccess.openAccessMinimumLoadKw)} kW, this facility's sanctioned load of ${fmt(load.value)} ${load.unit} ` +
      (load.value >= openAccess.openAccessMinimumLoadKw
        ? "is at or above the open-access threshold, so renewable open access is available as an alternative or a complement to on-site generation."
        : "is below the open-access threshold, so on-site generation behind the meter is the applicable route.");

    if (cappedByLoad) {
      caveats.push(
        `The indicative size is capped at the sanctioned load of ${fmt(load.value)} ${load.unit} read from the bill. A larger system would require a load enhancement from ${load.discomName ?? "the distribution utility"}.`,
      );
    }
    if (load.unit.toUpperCase() !== "KW") {
      caveats.push(
        `The sanctioned load is stated in ${load.unit}, not kW. The size cap above compares kWp against that figure directly, which is conservative — real power in kW never exceeds apparent power in ${load.unit} — but the true headroom depends on the power factor, which the bill does not print.`,
      );
    }
    caveats.push(
      "Indicative sizing only. Actual capacity depends on available shadow-free roof or land area, structural loading and the sanctioned-load headroom at the time of application — none of which this platform holds.",
    );

    impact = {
      metric: "Reduction in total CBAM-basis emissions",
      unit: "PERCENT_OF_TOTAL_EMISSIONS",
      low: pct(annualisedTotalCo2e > 0 ? (savedLow / annualisedTotalCo2e) * 100 : 0),
      high: pct(annualisedTotalCo2e > 0 ? (savedHigh / annualisedTotalCo2e) * 100 : 0),
      basis:
        `Range spans a ${pct(SOLAR_OFFSET_DESIGN_RANGE.low * 100, 0)}% offset at ${fmt(yieldHigh)} kWh/kWp/year through a ` +
        `${pct(SOLAR_OFFSET_DESIGN_RANGE.high * 100, 0)}% offset at ${fmt(yieldLow)} kWh/kWp/year, equivalent to ` +
        `${fmt(savedLow, 1)}–${fmt(savedHigh, 1)} tCO2e per year avoided at the grid factor in force. ` +
        "Not a project calculation — it assumes the sized capacity is built and performs at the published yield.",
    };
  } else {
    // Requirement: skip the sizing maths rather than guess a load.
    explanation +=
      " Sizing a system needs the sanctioned load from an electricity bill, and none is available for this facility, so no system size or impact range is shown here.";
    caveats.push(
      facts.sanctionedLoadAbsenceReason ??
        "No sanctioned load is available. Upload an electricity bill against this reporting period and IntelloAdvisor will read the sanctioned load off it, after which this recommendation will include an indicative system size and impact range.",
    );
    if (facts.annualisedGridMwh === null) {
      caveats.push("The reporting period length could not be determined, so annual consumption could not be derived.");
    }
  }

  return {
    id: "SOLAR_SELF_GENERATION",
    category: "SCOPE_2_ELECTRICITY",
    title:
      facts.sanctionedLoad && impact
        ? "Displace grid electricity with solar self-generation"
        : "Displace grid electricity with solar self-generation (sizing needs a bill)",
    explanation,
    inputs,
    impact,
    citations,
    caveats,
    requiresComplianceReview: needsReview(citations),
  };
};

export type FuelSwitchFacts = {
  composition: EmissionsComposition;
};

/**
 * Directional fuel-switching note for a coal- or coke-heavy profile.
 *
 * Deliberately names no product, supplier or project. It states the share of
 * the facility's own emissions that comes from solid fossil fuel, and what the
 * two standard levers do to that share on an energy-equivalent basis, using
 * emission factors from the same IPCC tables the platform's fuel library is
 * built on.
 */
export const fuelSwitchRule = (facts: FuelSwitchFacts): RecommendationCard | null => {
  const solid = facts.composition.solidFossilFuel;
  if (!solid || solid.sharePct < HIGH_SOLID_FUEL_SHARE_PCT) return null;

  const coal = FUEL_CO2_PER_TJ.bituminousCoal;
  const gas = FUEL_CO2_PER_TJ.naturalGas;
  const biomass = FUEL_CO2_PER_TJ.biomass;

  // Energy-for-energy substitution: one TJ of coal replaced by one TJ of the
  // alternative. Per-tonne factors cannot be compared across fuels.
  const gasReductionFraction = (coal.value - gas.value) / coal.value;
  // biomass.value is the RED II-certified case. The uncertified case is
  // biomass.uncertifiedValue, which exceeds coal — so it is not an upper bound
  // on a *reduction* and is surfaced as a stated condition and caveat rather
  // than folded into this range.
  const biomassReductionFraction = (coal.value - biomass.value) / coal.value;

  const share = FUEL_SWITCH_QUOTED_SUBSTITUTION_SHARE;
  const impactLow = solid.sharePct * share * gasReductionFraction;
  const impactHigh = solid.sharePct * share * biomassReductionFraction;

  const citations: Citation[] = [coal.citation, gas.citation, biomass.citation];
  const fuelList = solid.fuels.map((f) => `${f.label} (${pct(f.sharePct)}%)`).join(", ");

  return {
    id: "SOLID_FUEL_SWITCHING",
    category: "SCOPE_1_COMBUSTION",
    title: "Coal and coke combustion is the largest lever in your direct emissions",
    explanation:
      `${pct(solid.sharePct)}% of this facility's total CBAM-basis emissions come from burning coal or coke` +
      (fuelList ? ` — ${fuelList}` : "") +
      `. On an energy-equivalent basis, natural gas emits ${gas.value} tCO2/TJ against ${coal.value} tCO2/TJ for bituminous coal, ` +
      `a ${pct(gasReductionFraction * 100)}% reduction for the energy substituted. Biomass is zero-rated in CBAM ` +
      `embedded-emissions accounting only where it ${biomass.zeroRatingCondition} — on that condition it removes the ` +
      `substituted share entirely. Biomass that does not meet it is accounted as fossil at ${biomass.uncertifiedValue} tCO2/TJ, ` +
      `above coal on an energy basis, so uncertified blending removes nothing and can raise the number. Fuel switching and biomass blending are ` +
      `the common directional levers for this emissions profile. This is an informational note, not a recommendation of any ` +
      `specific fuel supply, technology or vendor, and it does not assess whether either lever is technically feasible at this plant.`,
    inputs: [
      { label: "Coal / coke share of total emissions", value: `${pct(solid.sharePct)}%`, source: "PLATFORM_CALCULATION" },
      { label: "Coal / coke emissions", value: `${fmt(solid.co2e, 1)} tCO2e`, source: "PLATFORM_CALCULATION" },
      { label: "Bituminous coal CO2 factor", value: `${coal.value} tCO2/TJ`, source: "PUBLISHED_BENCHMARK" },
      { label: "Natural gas CO2 factor", value: `${gas.value} tCO2/TJ`, source: "PUBLISHED_BENCHMARK" },
      {
        label: "Biomass CO2 factor — RED II certified",
        value: `${biomass.value} tCO2/TJ`,
        source: "PUBLISHED_BENCHMARK",
      },
      {
        label: "Biomass CO2 factor — uncertified (treated as fossil)",
        value: `${biomass.uncertifiedValue} tCO2/TJ`,
        source: "PUBLISHED_BENCHMARK",
      },
    ],
    impact: {
      metric: "Reduction in total CBAM-basis emissions",
      unit: "PERCENT_OF_TOTAL_EMISSIONS",
      low: pct(impactLow),
      high: pct(impactHigh),
      basis:
        `Quoted per ${pct(share * 100, 0)}% of coal/coke energy substituted: the low end is natural gas ` +
        `(${pct(gasReductionFraction * 100)}% less CO2 per TJ), the high end is biomass that qualifies for CBAM zero-rating — it ` +
        `${biomass.zeroRatingCondition}. Biomass that does not qualify is accounted as fossil and contributes no reduction, so the ` +
        `high end is conditional on certification rather than on the fuel choice alone. The effect is linear in the ` +
        `substitution share, so ${pct(share * 200, 0)}% substituted is twice these figures. The substitution level is a commercial ` +
        `decision, not a published benchmark, which is why it is stated rather than assumed.`,
    },
    citations,
    caveats: [
      "The reduction percentages are CO2-only ratios from the IPCC energy tables, applied to a CO2e line that also carries small CH4 and N2O contributions. For coal these non-CO2 gases are a low single-digit share, so the natural-gas figure is approximate and slightly conservative.",
      "Energy-equivalent substitution assumes the replacement fuel delivers the same useful heat. It takes no view on burner or kiln compatibility, fuel availability, gas pipeline connectivity or the cost of either fuel.",
      `Biomass zero-rating is conditional, not automatic. It applies only where the fuel ${biomass.zeroRatingCondition}. Without that evidence the biomass is accounted as fossil at its full emission factor (${biomass.uncertifiedValue} tCO2/TJ), the high end of the range above does not hold, and blending can increase the CBAM number rather than reduce it. This platform does not currently hold biomass certification evidence, so it cannot tell you which case a given consignment falls into.`,
    ],
    requiresComplianceReview: needsReview(citations),
  };
};

/**
 * Always-on structural card: what part of the Scope 2 number is set by the
 * published grid factor, and what is set by this facility.
 */
export const liabilityStructureRule = (facts: {
  composition: EmissionsComposition;
  grid: GridFactorSplit;
}): RecommendationCard => {
  const { grid, composition } = facts;

  const citations: Citation[] = [
    {
      publisher: "Central Electricity Authority",
      document: grid.nationalGridFactorSource,
      reference: `India grid average emission factor, ${grid.nationalGridFactor} tCO2e/MWh`,
      asOf: grid.nationalGridFactorSource,
      verification: "VERIFIED_AGAINST_PRIMARY_SOURCE",
    },
  ];

  return {
    id: "LIABILITY_STRUCTURE",
    category: "LIABILITY_STRUCTURE",
    title: "What sets your Scope 2 number, and what you can move",
    explanation:
      `${grid.definitionNote} ${grid.whyNoVolumeSplit}` +
      (grid.renewableElectricityMwh > 0
        ? ` ${fmt(grid.renewableElectricityMwh, 2)} MWh — ${pct(grid.renewableSharePct)}% of this facility's electricity — is already renewable or captive, avoiding ${fmt(grid.alreadyAvoidedCo2e, 1)} tCO2e at the factor in force.`
        : " No renewable or captive electricity is currently reported for this facility, so the whole of its electricity demand is grid-supplied.") +
      ` Across all sources, grid electricity is ${pct(composition.scope2Electricity.sharePct)}% of total emissions; direct combustion is ` +
      `${pct(composition.scope1Combustion.sharePct)}%, process emissions ${pct(composition.scope1Process.sharePct)}%, and embedded ` +
      `precursor emissions ${pct(composition.precursorEmbedded.sharePct)}%.`,
    inputs: [
      { label: "Scope 2 electricity emissions", value: `${fmt(grid.scope2ElectricityCo2e, 1)} tCO2e`, source: "PLATFORM_CALCULATION" },
      { label: "Set by the national grid factor", value: `${fmt(grid.gridFactorDrivenCo2e, 1)} tCO2e (${pct(grid.gridFactorDrivenSharePct)}%)`, source: "PLATFORM_CALCULATION" },
      { label: "Set by this facility's own factor override", value: `${fmt(grid.facilityFactorChoiceCo2e, 1)} tCO2e (${pct(grid.facilityFactorChoiceSharePct)}%)`, source: "PLATFORM_CALCULATION" },
      { label: "National grid emission factor", value: `${grid.nationalGridFactor} tCO2e/MWh`, source: "PUBLISHED_BENCHMARK" },
      { label: "Removed per MWh displaced", value: `${grid.co2ePerMwhDisplaced} tCO2e/MWh`, source: "PLATFORM_CALCULATION" },
    ],
    impact: null,
    citations,
    caveats: [
      "This card describes the structure of the existing number. It proposes no action and therefore carries no impact range.",
      "The national grid factor is maintained in the Emission Factor Manager and supersedes with history. A recommendation generated today cites the factor in force today.",
    ],
    requiresComplianceReview: needsReview(citations),
  };
};
