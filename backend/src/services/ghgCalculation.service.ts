/**
 * Pure calculation engine for GHG Runner engagements — no Prisma access, so
 * it can be called identically from the create/update service (to freeze
 * totals at save time) and from the PDF report builder (to re-derive the
 * same per-row breakdown for display).
 *
 * Scope 1 "library" rows reuse FUEL_LIBRARY from data/emissionFactors.ts —
 * the same fuel definitions the Indian CBAM/CCTS product uses — but the
 * CH4/N2O contributions are converted to CO2e using whichever jurisdiction's
 * GWP table applies to this engagement (see data/ghgJurisdictions.ts), never
 * a hardcoded scheme. Scope 1 "custom" rows and every Scope 2 row use an
 * admin-entered blended tCO2e factor instead, each with its own mandatory
 * source citation.
 */
import { FUEL_LIBRARY } from "../data/emissionFactors";
import { GHG_JURISDICTIONS, type GhgJurisdictionKey } from "../data/ghgJurisdictions";

const round = (value: number, decimals = 3): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

export interface Scope1Entry {
  id: string;
  /** A FUEL_LIBRARY key, or "CUSTOM". */
  sourceType: string;
  label: string;
  quantity: number;
  unit: string;
  isCustom: boolean;
  /** tCO2e per unit — required when isCustom is true, ignored otherwise. */
  customFactorValue?: number;
  source: string;
}

export interface Scope1EntryResult extends Scope1Entry {
  co2eTonnes: number;
  factorApplied: string;
}

export interface Scope2Entry {
  id: string;
  label: string;
  quantityValue: number;
  quantityUnit: "kWh" | "MWh";
  /** tCO2e per quantityUnit — always manually entered, never defaulted (e.g. never India's CEA factor). */
  gridFactorValue: number;
  source: string;
}

export interface Scope2EntryResult extends Scope2Entry {
  co2eTonnes: number;
}

/** Schema-ready, UI-disabled — see GhgEngagement.scope3Entries. Never enters totalTco2e. */
export interface Scope3Entry {
  id: string;
  scope3Category: number;
  description: string;
  quantity: number;
  factor: number;
  source: string;
}

export const calculateScope1Entry = (entry: Scope1Entry, jurisdiction: GhgJurisdictionKey): Scope1EntryResult => {
  const gwp = GHG_JURISDICTIONS[jurisdiction].gwp;

  if (entry.isCustom) {
    const factor = entry.customFactorValue ?? 0;
    return {
      ...entry,
      co2eTonnes: round(entry.quantity * factor),
      factorApplied: `${factor} tCO2e/${entry.unit} (custom factor)`,
    };
  }

  const fuel = FUEL_LIBRARY[entry.sourceType];
  if (!fuel) {
    return { ...entry, co2eTonnes: 0, factorApplied: "Unrecognised fuel type" };
  }

  const co2Tonnes = entry.quantity * fuel.efCo2PerUnit;
  const ch4Tonnes = (entry.quantity * fuel.efCh4PerUnit) / 1000;
  const n2oTonnes = (entry.quantity * fuel.efN2oPerUnit) / 1000;
  const co2eTonnes = co2Tonnes * gwp.co2 + ch4Tonnes * gwp.ch4 + n2oTonnes * gwp.n2o;

  return {
    ...entry,
    co2eTonnes: round(co2eTonnes),
    factorApplied: `${fuel.efCo2PerUnit} tCO2/${fuel.unit} CO2 · ${fuel.efCh4PerUnit} kg CH4/${fuel.unit} · ${fuel.efN2oPerUnit} kg N2O/${fuel.unit} (GWP-${gwp.scheme})`,
  };
};

export const calculateScope2Entry = (entry: Scope2Entry): Scope2EntryResult => ({
  ...entry,
  co2eTonnes: round(entry.quantityValue * entry.gridFactorValue),
});

export interface GhgCalculationResult {
  jurisdiction: GhgJurisdictionKey;
  gwpScheme: string;
  gwpSource: string;
  scope1Results: Scope1EntryResult[];
  scope2Results: Scope2EntryResult[];
  scope1TotalTco2e: number;
  scope2TotalTco2e: number;
  totalTco2e: number;
}

export const calculateGhgEngagement = (
  scope1Entries: Scope1Entry[],
  scope2Entries: Scope2Entry[],
  jurisdiction: GhgJurisdictionKey,
): GhgCalculationResult => {
  const config = GHG_JURISDICTIONS[jurisdiction];
  const scope1Results = scope1Entries.map((entry) => calculateScope1Entry(entry, jurisdiction));
  const scope2Results = scope2Entries.map(calculateScope2Entry);

  const scope1TotalTco2e = round(scope1Results.reduce((sum, r) => sum + r.co2eTonnes, 0));
  const scope2TotalTco2e = round(scope2Results.reduce((sum, r) => sum + r.co2eTonnes, 0));

  return {
    jurisdiction,
    gwpScheme: config.gwp.scheme,
    gwpSource: config.gwpSource,
    scope1Results,
    scope2Results,
    scope1TotalTco2e,
    scope2TotalTco2e,
    totalTco2e: round(scope1TotalTco2e + scope2TotalTco2e),
  };
};
