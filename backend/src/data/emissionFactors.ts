/**
 * Emission factor library for the steel-sector calculation engine.
 *
 * Values are Tier-1 defaults derived from the IPCC 2006 Guidelines for National
 * GHG Inventories (Vol. 2 Energy, Table 1.2 net calorific values and Table 2.2
 * default stationary-combustion emission factors for manufacturing industries),
 * combined with commonly cited industry figures for process and precursor
 * emissions. They are indicative starting points, not certified compliance
 * values — every figure can be overridden per data-entry line item, and totals
 * should be verified against the current CBAM Implementing Regulation default
 * values / India GHG Programme factors before regulatory submission.
 */

export type FuelUnit = "TONNE" | "KILOLITRE" | "THOUSAND_NM3";

export interface FuelDefinition {
  key: string;
  label: string;
  unit: FuelUnit;
  /** tCO2 per unit */
  efCo2PerUnit: number;
  /** kg CH4 per unit */
  efCh4PerUnit: number;
  /** kg N2O per unit */
  efN2oPerUnit: number;
}

export const FUEL_LIBRARY: Record<string, FuelDefinition> = {
  COKING_COAL: {
    key: "COKING_COAL",
    label: "Coking coal",
    unit: "TONNE",
    efCo2PerUnit: 2.667,
    efCh4PerUnit: 0.282,
    efN2oPerUnit: 0.0423,
  },
  PCI_COAL: {
    key: "PCI_COAL",
    label: "PCI / non-coking coal",
    unit: "TONNE",
    efCo2PerUnit: 2.441,
    efCh4PerUnit: 0.258,
    efN2oPerUnit: 0.0387,
  },
  METALLURGICAL_COKE: {
    key: "METALLURGICAL_COKE",
    label: "Metallurgical coke",
    unit: "TONNE",
    efCo2PerUnit: 3.017,
    efCh4PerUnit: 0.282,
    efN2oPerUnit: 0.0423,
  },
  NATURAL_GAS: {
    key: "NATURAL_GAS",
    label: "Natural gas",
    unit: "THOUSAND_NM3",
    efCo2PerUnit: 2.693,
    efCh4PerUnit: 0.048,
    efN2oPerUnit: 0.0048,
  },
  HSD_DIESEL: {
    key: "HSD_DIESEL",
    label: "HSD / diesel",
    unit: "KILOLITRE",
    efCo2PerUnit: 2.677,
    efCh4PerUnit: 0.1084,
    efN2oPerUnit: 0.02167,
  },
  FURNACE_OIL: {
    key: "FURNACE_OIL",
    label: "Furnace oil",
    unit: "KILOLITRE",
    efCo2PerUnit: 3.065,
    efCh4PerUnit: 0.1188,
    efN2oPerUnit: 0.02376,
  },
  LPG: {
    key: "LPG",
    label: "LPG",
    unit: "TONNE",
    efCo2PerUnit: 2.9846,
    efCh4PerUnit: 0.0473,
    efN2oPerUnit: 0.00473,
  },
};

export interface ProcessMaterialDefinition {
  key: string;
  label: string;
  /** tCO2 per tonne of material (calcination), CO2-only */
  efCo2PerTonne: number;
}

export const PROCESS_MATERIAL_LIBRARY: Record<string, ProcessMaterialDefinition> = {
  LIMESTONE: { key: "LIMESTONE", label: "Limestone (CaCO3)", efCo2PerTonne: 0.44 },
  DOLOMITE: { key: "DOLOMITE", label: "Dolomite (CaMg(CO3)2)", efCo2PerTonne: 0.477 },
  OTHER_FLUX: { key: "OTHER_FLUX", label: "Other flux / additive", efCo2PerTonne: 0.35 },
};

export interface PrecursorDefinition {
  key: string;
  label: string;
  /** default tCO2e per tonne of precursor material, already GWP-blended */
  defaultEmbeddedFactor: number;
}

export const PRECURSOR_LIBRARY: Record<string, PrecursorDefinition> = {
  PIG_IRON: { key: "PIG_IRON", label: "Pig iron (BF route)", defaultEmbeddedFactor: 1.9 },
  DRI_GAS: { key: "DRI_GAS", label: "DRI — natural gas route", defaultEmbeddedFactor: 0.8 },
  DRI_COAL: { key: "DRI_COAL", label: "DRI — coal route", defaultEmbeddedFactor: 2.7 },
  SCRAP: { key: "SCRAP", label: "Steel scrap", defaultEmbeddedFactor: 0.4 },
  FERRO_ALLOY: { key: "FERRO_ALLOY", label: "Ferro-alloys", defaultEmbeddedFactor: 3.5 },
};

/** tCO2 per MWh — India grid average emission factor; override per facility/period where a verified CEA baseline figure is available. */
export const DEFAULT_GRID_EMISSION_FACTOR = 0.716;
export const DEFAULT_GRID_EMISSION_FACTOR_SOURCE = "CEA Grid Emission Factor Report FY2025-26";

/** tCO2 per GJ of imported steam — indicative default for a natural-gas-fired boiler. */
export const DEFAULT_STEAM_EMISSION_FACTOR = 0.07;
