/**
 * Reference constants for the IntelloCalc public lead-generation tools
 * (Border / India / Comply). These are simplified, illustrative figures for
 * an instant estimate — distinct from the platform's verified CBAM/CCTS
 * calculation engine in `emissionFactors.ts` / `gwpTables.ts`.
 */

export const CBAM_CERTIFICATE_PRICE_EUR = 75.36;
export const CBAM_CERTIFICATE_PRICE_QUARTER = "Q1 2026";
export const EUR_TO_INR_RATE = 89.5;
export const DE_MINIMIS_THRESHOLD_TONNES = 50;

export type BorderSector =
  | "IRON_STEEL"
  | "CEMENT"
  | "ALUMINIUM"
  | "FERTILIZERS"
  | "HYDROGEN"
  | "ELECTRICITY";

export type BorderProductionRoute = "EAF" | "BF_BOF";

/** EU default Specific Embedded Emissions, per Commission Implementing Regulation (EU) 2025/2621. */
export const BORDER_SEE_VALUES: Record<string, number> = {
  STEEL_EAF: 2.28,
  STEEL_BF_BOF: 2.75,
  CEMENT: 0.87,
  ALUMINIUM: 10.49,
  FERTILIZERS: 3.57,
  HYDROGEN: 10.4,
  ELECTRICITY: 0.4,
};

export const borderSeeKey = (sector: BorderSector, productionRoute?: BorderProductionRoute) => {
  if (sector === "IRON_STEEL") {
    return productionRoute === "BF_BOF" ? "STEEL_BF_BOF" : "STEEL_EAF";
  }
  return sector;
};

export type IndiaSector =
  | "ALUMINIUM"
  | "CEMENT"
  | "IRON_STEEL"
  | "CHLOR_ALKALI"
  | "FERTILIZER"
  | "PAPER_PULP"
  | "PETROCHEMICAL"
  | "PETROLEUM_REFINERY"
  | "TEXTILE";

export type FuelTypeMix = "COAL" | "NATURAL_GAS" | "MIXED" | "OTHER";

/** tCO2/GJ, per S.O. 2825(E) 2023. */
export const FUEL_EMISSION_FACTORS: Record<FuelTypeMix, number> = {
  COAL: 0.094,
  NATURAL_GAS: 0.056,
  MIXED: 0.08,
  OTHER: 0.085,
};

/** CEA Grid Emission Factor FY2025-26, tCO2e/MWh. */
export const GRID_EMISSION_FACTOR = 0.716;

/** Indicative sector reference GHG intensity, tCO2e per tonne of production. */
export const INDIA_REFERENCE_INTENSITY: Partial<Record<IndiaSector, number>> = {
  IRON_STEEL: 2.5, // BF-BOF route — majority of India's integrated capacity
  CEMENT: 0.87,
  ALUMINIUM: 14.0,
  FERTILIZER: 3.0,
};

export type CbamGood =
  | "IRON_STEEL"
  | "CEMENT"
  | "ALUMINIUM"
  | "FERTILIZERS"
  | "HYDROGEN"
  | "ELECTRICITY"
  | "NONE";

export type EprProduct = "BATTERIES" | "PLASTIC" | "EEE" | "TYRES" | "LUBRICATING_OILS" | "NONE";
