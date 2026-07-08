/**
 * Emission factor library for the calculation engine — steel plus the five
 * additional CBAM sectors (cement, aluminium, fertilizer, hydrogen,
 * electricity).
 *
 * Values are Tier-1 defaults derived from the IPCC 2006 Guidelines for National
 * GHG Inventories (Vol. 2 Energy, Table 1.2 net calorific values and Table 2.2
 * default stationary-combustion emission factors for manufacturing industries),
 * combined with commonly cited industry figures for process and precursor
 * emissions. They are indicative starting points, not certified compliance
 * values — every figure can be overridden per data-entry line item, and totals
 * should be verified against the current CBAM Implementing Regulation default
 * values / India GHG Programme factors before regulatory submission.
 *
 * Each definition carries a `sectors` tag so the reference API and the
 * activity-data form can show only the fuels/materials/precursors relevant to
 * the company's sector instead of one flat cross-sector list.
 */

import type { Sector } from "@prisma/client";

export type FuelUnit = "TONNE" | "KILOLITRE" | "THOUSAND_NM3" | "GJ";

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
  sectors: Sector[];
}

export const FUEL_LIBRARY: Record<string, FuelDefinition> = {
  COKING_COAL: {
    key: "COKING_COAL",
    label: "Coking coal",
    unit: "TONNE",
    efCo2PerUnit: 2.667,
    efCh4PerUnit: 0.282,
    efN2oPerUnit: 0.0423,
    sectors: ["STEEL"],
  },
  PCI_COAL: {
    key: "PCI_COAL",
    label: "Coal / pet coke (PCI, kiln or boiler fuel)",
    unit: "TONNE",
    // 94.6 tCO2/TJ (IPCC 2006 default, other bituminous coal) — the same
    // Tier-1 figure requested for cement kiln coal/pet coke and thermal
    // power coal, so this one entry is reused across those sectors rather
    // than duplicated with a different NCV assumption.
    efCo2PerUnit: 2.441,
    efCh4PerUnit: 0.258,
    efN2oPerUnit: 0.0387,
    sectors: ["STEEL", "CEMENT", "ELECTRICITY"],
  },
  METALLURGICAL_COKE: {
    key: "METALLURGICAL_COKE",
    label: "Metallurgical coke",
    unit: "TONNE",
    efCo2PerUnit: 3.017,
    efCh4PerUnit: 0.282,
    efN2oPerUnit: 0.0423,
    sectors: ["STEEL"],
  },
  NATURAL_GAS: {
    key: "NATURAL_GAS",
    label: "Natural gas",
    unit: "THOUSAND_NM3",
    // 56.1 tCO2/TJ combustion EF x 48 GJ/'000 Nm3 NCV = 2.693 tCO2/'000 Nm3 —
    // the exact figure requested for cement/aluminium/fertilizer/hydrogen/
    // electricity fuel use, so shared across all sectors.
    efCo2PerUnit: 2.693,
    efCh4PerUnit: 0.048,
    efN2oPerUnit: 0.0048,
    sectors: ["STEEL", "CEMENT", "ALUMINIUM", "FERTILIZER", "HYDROGEN", "ELECTRICITY"],
  },
  HSD_DIESEL: {
    key: "HSD_DIESEL",
    label: "HSD / diesel",
    unit: "KILOLITRE",
    efCo2PerUnit: 2.677,
    efCh4PerUnit: 0.1084,
    efN2oPerUnit: 0.02167,
    sectors: ["STEEL", "CEMENT", "ALUMINIUM", "HYDROGEN"],
  },
  FURNACE_OIL: {
    key: "FURNACE_OIL",
    label: "Furnace oil",
    unit: "KILOLITRE",
    efCo2PerUnit: 3.065,
    efCh4PerUnit: 0.1188,
    efN2oPerUnit: 0.02376,
    sectors: ["STEEL"],
  },
  LPG: {
    key: "LPG",
    label: "LPG",
    unit: "TONNE",
    efCo2PerUnit: 2.9846,
    efCh4PerUnit: 0.0473,
    efN2oPerUnit: 0.00473,
    sectors: ["STEEL"],
  },
  FUEL_OIL: {
    key: "FUEL_OIL",
    label: "Fuel oil",
    unit: "TONNE",
    // 74.1 tCO2/TJ x 40.4 GJ/t NCV (IPCC residual fuel oil default) = 2.994 tCO2/t
    efCo2PerUnit: 2.994,
    efCh4PerUnit: 0.1162,
    efN2oPerUnit: 0.0232,
    sectors: ["CEMENT", "ALUMINIUM", "HYDROGEN", "ELECTRICITY"],
  },
  ALTERNATIVE_FUELS: {
    key: "ALTERNATIVE_FUELS",
    label: "Alternative fuels (RDF / tyre chips / etc.)",
    unit: "GJ",
    // IPCC default 100 tCO2/TJ = 0.1 tCO2/GJ. Non-CO2 not separately specified
    // — left at 0, overridable per line.
    efCo2PerUnit: 0.1,
    efCh4PerUnit: 0,
    efN2oPerUnit: 0,
    sectors: ["CEMENT"],
  },
  BIOMASS: {
    key: "BIOMASS",
    label: "Biomass (biogenic)",
    unit: "GJ",
    // Zero-rated for CBAM purposes — biogenic CO2 is not counted.
    efCo2PerUnit: 0,
    efCh4PerUnit: 0,
    efN2oPerUnit: 0,
    sectors: ["CEMENT", "ELECTRICITY"],
  },
};

export interface ProcessMaterialDefinition {
  key: string;
  label: string;
  /** tCO2 per tonne of material (calcination / process oxidation), CO2-only */
  efCo2PerTonne: number;
  sectors: Sector[];
}

export const PROCESS_MATERIAL_LIBRARY: Record<string, ProcessMaterialDefinition> = {
  LIMESTONE: { key: "LIMESTONE", label: "Limestone (CaCO3)", efCo2PerTonne: 0.44, sectors: ["STEEL", "CEMENT"] },
  DOLOMITE: { key: "DOLOMITE", label: "Dolomite (CaMg(CO3)2)", efCo2PerTonne: 0.477, sectors: ["STEEL"] },
  OTHER_FLUX: { key: "OTHER_FLUX", label: "Other flux / additive", efCo2PerTonne: 0.35, sectors: ["STEEL"] },
  ANODE_CARBON: {
    key: "ANODE_CARBON",
    label: "Anode carbon / petroleum coke consumed",
    efCo2PerTonne: 3.19,
    sectors: ["ALUMINIUM"],
  },
  PITCH: { key: "PITCH", label: "Pitch consumed", efCo2PerTonne: 3.04, sectors: ["ALUMINIUM"] },
  ALUMINA: { key: "ALUMINA", label: "Alumina consumed", efCo2PerTonne: 0, sectors: ["ALUMINIUM"] },
  FLY_ASH: { key: "FLY_ASH", label: "Fly ash added", efCo2PerTonne: 0, sectors: ["CEMENT"] },
  GGBS_SLAG: { key: "GGBS_SLAG", label: "Slag added", efCo2PerTonne: 0, sectors: ["CEMENT"] },
  GYPSUM: { key: "GYPSUM", label: "Gypsum added", efCo2PerTonne: 0, sectors: ["CEMENT"] },
  CO2_FOR_UREA: { key: "CO2_FOR_UREA", label: "CO2 for urea synthesis", efCo2PerTonne: 0, sectors: ["FERTILIZER"] },
};

export interface PrecursorDefinition {
  key: string;
  label: string;
  /** default tCO2e per tonne of precursor material, already GWP-blended */
  defaultEmbeddedFactor: number;
  sectors: Sector[];
}

export const PRECURSOR_LIBRARY: Record<string, PrecursorDefinition> = {
  PIG_IRON: { key: "PIG_IRON", label: "Pig iron (BF route)", defaultEmbeddedFactor: 1.9, sectors: ["STEEL"] },
  DRI_GAS: { key: "DRI_GAS", label: "DRI — natural gas route", defaultEmbeddedFactor: 0.8, sectors: ["STEEL"] },
  DRI_COAL: { key: "DRI_COAL", label: "DRI — coal route", defaultEmbeddedFactor: 2.7, sectors: ["STEEL"] },
  SCRAP: { key: "SCRAP", label: "Steel scrap", defaultEmbeddedFactor: 0.4, sectors: ["STEEL"] },
  FERRO_ALLOY: { key: "FERRO_ALLOY", label: "Ferro-alloys", defaultEmbeddedFactor: 3.5, sectors: ["STEEL"] },
  CLINKER_PURCHASED: {
    key: "CLINKER_PURCHASED",
    label: "Clinker (purchased externally)",
    defaultEmbeddedFactor: 0.87,
    sectors: ["CEMENT"],
  },
  ALUMINA_PURCHASED: {
    key: "ALUMINA_PURCHASED",
    label: "Alumina (purchased)",
    defaultEmbeddedFactor: 0.85,
    sectors: ["ALUMINIUM"],
  },
  AMMONIA_PURCHASED: {
    key: "AMMONIA_PURCHASED",
    label: "Ammonia (purchased externally)",
    defaultEmbeddedFactor: 3.57,
    sectors: ["FERTILIZER"],
  },
};

/**
 * tCO2 per MWh — India grid average emission factor; override per
 * facility/period where a verified CEA baseline figure is available.
 *
 * Mutable module state rather than a bare constant: the Super Admin
 * Emission Factor Manager (/admin/emission-factors) can update this at
 * runtime via PUT /api/admin/cea-grid-factor, which supersedes the current
 * "CEA Grid Emission Factor" EmissionFactor row (preserving history) and
 * then calls setGridEmissionFactor() so every consumer — the calculation
 * engine and the PDF report builders — picks up the new value immediately,
 * without an async DB read at every call site. Hydrated from the DB at
 * server startup by hydrateEmissionFactorCache() in emissionFactor.service.ts.
 */
let currentGridEmissionFactor = 0.716;
let currentGridEmissionFactorSource = "CEA Grid Emission Factor Report FY2025-26";

export const getGridEmissionFactor = (): number => currentGridEmissionFactor;
export const getGridEmissionFactorSource = (): string => currentGridEmissionFactorSource;

export const setGridEmissionFactor = (value: number, source: string): void => {
  currentGridEmissionFactor = value;
  currentGridEmissionFactorSource = source;
};

/** tCO2 per GJ of imported steam — indicative default for a natural-gas-fired boiler. */
export const DEFAULT_STEAM_EMISSION_FACTOR = 0.07;

/** tCO2 per '000 Nm3 of natural gas used as ammonia-synthesis feedstock (carbon embedded in the gas, tracked separately from combustion). Same conversion basis as NATURAL_GAS fuel combustion — 56.1 tCO2/TJ x 48 GJ/'000 Nm3 NCV. */
export const NATURAL_GAS_FEEDSTOCK_EMISSION_FACTOR = 2.693;

/** IPCC 2006 Guidelines Vol. 3 Ch. 3 default: 9 kg N2O per tonne nitric acid produced (uncontrolled, Ostwald process), before any abatement. */
export const N2O_DEFAULT_EF_NITRIC_ACID_TONNES_PER_TONNE = 0.009;
export const N2O_DEFAULT_EF_SOURCE = "IPCC 2006 Guidelines for National GHG Inventories, Volume 3, Chapter 3";

/** tCO2 per tonne CaCO3 — cement calcination default, same Tier-1 factor as the steel-sector LIMESTONE entry. */
export const CEMENT_CALCINATION_EMISSION_FACTOR = 0.44;
