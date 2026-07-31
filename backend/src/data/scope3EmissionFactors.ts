/**
 * Reference emission factors for the Phase 1 Scope 3 calculation engine
 * (scope3Calculation.service.ts) — 5 GHG Protocol Corporate Value Chain
 * (Scope 3) categories: 1 (Purchased goods & services), 4 (Upstream
 * transportation & distribution), 6 (Business travel), 7 (Employee
 * commuting), 11 (Use of sold products).
 *
 * Two published factor sets are used, matching GHG Protocol Scope 3
 * Technical Guidance's spend-based vs. activity-based methods:
 *  - Spend-based: US EPA "Supply Chain Greenhouse Gas Emission Factors for
 *    US Industries and Commodities" v1.3 (NAICS-6, built on 2022 economic/
 *    emissions data), USEEIO-based, "Supply Chain Emissions with Margins"
 *    (SEF+MEF) column — USD-denominated, converted to INR below.
 *  - Activity-based: UK DEFRA/DESNZ "Greenhouse gas reporting: conversion
 *    factors 2025" for transport and materials, supplemented by the GLEC
 *    Framework v3.2 default values for rail/sea freight (DEFRA does not
 *    publish those modes) and CEA's India grid emission factor for
 *    electricity-consuming sold products.
 *
 * All figures are illustrative reference points for a Phase 1 build, not a
 * live feed — confirm against the current published tables (gov.uk
 * conversion factors collection; EPA's Supply Chain Factors catalog page)
 * before relying on them for external assurance or regulatory submission.
 * Every value below is already expressed in CO2e (GWP-100, IPCC AR5 basis —
 * consistent with the GHG Protocol/IFRS convention issbCalculation.service.ts
 * already uses for Scope 1/2, per that file's own comment).
 */

// Static FX assumption, same convention as EUR_TO_INR_RATE in
// intellocalcConstants.ts — approximates the INR/USD rate for the EPA
// dataset's 2022 vintage. Update periodically; not a live feed.
export const USD_TO_INR_RATE = 86;

export const EPA_SPEND_FACTOR_SOURCE =
  "US EPA Supply Chain GHG Emission Factors for US Industries and Commodities v1.3 (NAICS-6, 2022 data), Supply Chain Emissions with Margins (SEF+MEF), USD converted to INR";

export const DEFRA_SOURCE = "UK DEFRA/DESNZ Greenhouse Gas Reporting: Conversion Factors 2025";
export const GLEC_SOURCE = "Smart Freight Centre GLEC Framework v3.2 default values";
export const CEA_GRID_SOURCE = "Central Electricity Authority (India), CO2 Baseline Database, latest published version — India grid emission factor";

// --- Spend-based factors (kg CO2e per USD of 2022 spend) -------------------
// One blended factor per category — spend-based is intentionally coarser
// than activity-based (GHG Protocol's own distinction between the two
// methods), so no further breakdown by sub-type here.
export const SPEND_BASED_FACTORS_KG_CO2E_PER_USD: Record<
  "CAT1_PURCHASED_GOODS_SERVICES" | "CAT4_UPSTREAM_TRANSPORT_DISTRIBUTION" | "CAT6_BUSINESS_TRAVEL" | "CAT7_EMPLOYEE_COMMUTING" | "CAT11_USE_OF_SOLD_PRODUCTS",
  number
> = {
  // General manufacturing / fabricated goods & services average (NAICS 31-33).
  CAT1_PURCHASED_GOODS_SERVICES: 0.35,
  // Transportation & warehousing services average (NAICS 48-49).
  CAT4_UPSTREAM_TRANSPORT_DISTRIBUTION: 0.45,
  // Air + ground passenger transportation services average.
  CAT6_BUSINESS_TRAVEL: 0.4,
  // Screening-level proxy only: applies the ground passenger transportation
  // services factor to reimbursed commuting spend. GHG Protocol's preferred
  // Category 7 methods are distance-based/average-data (see the
  // activity-based factors below) — use this only where no activity data is
  // available at all.
  CAT7_EMPLOYEE_COMMUTING: 0.35,
  // Downstream use-phase proxy: applies an all-industries-average factor to
  // product sales revenue. Coarser than the activity-based method below —
  // GHG Protocol Category 11 guidance favours product-specific use-phase
  // data wherever it exists.
  CAT11_USE_OF_SOLD_PRODUCTS: 0.3,
};

// --- Category 1: Purchased goods & services (activity-based) ---------------
// DEFRA 2025 "Material use" table — kg CO2e per kg, cradle-to-gate virgin
// production, except CEMENT which reuses the EU CBAM default Specific
// Embedded Emissions value (Commission Implementing Regulation (EU)
// 2025/2621) for consistency with the rest of the platform.
export type Cat1MaterialType = "STEEL" | "ALUMINIUM" | "CEMENT" | "PLASTICS" | "PAPER_BOARD" | "GENERIC_OTHER";

export const CAT1_MATERIAL_FACTORS_KG_CO2E_PER_KG: Record<Cat1MaterialType, { factor: number; source: string }> = {
  STEEL: { factor: 1.46, source: `${DEFRA_SOURCE} — Material use, Steel (virgin)` },
  ALUMINIUM: { factor: 11.9, source: `${DEFRA_SOURCE} — Material use, Aluminium (virgin)` },
  CEMENT: { factor: 0.87, source: "EU Commission Implementing Regulation (EU) 2025/2621 — default Specific Embedded Emissions, Cement" },
  PLASTICS: { factor: 2.7, source: `${DEFRA_SOURCE} — Material use, Average plastics (virgin)` },
  PAPER_BOARD: { factor: 0.94, source: `${DEFRA_SOURCE} — Material use, Paper & board` },
  GENERIC_OTHER: { factor: 0.5, source: `${DEFRA_SOURCE} — Material use, generic/unlisted goods (conservative average)` },
};

// --- Category 4: Upstream transportation & distribution (activity-based) ---
// kg CO2e per tonne.km. Road from DEFRA 2025; rail/sea from GLEC v3.2
// (DEFRA does not publish tonne.km factors for those modes).
export type Cat4FreightMode = "ROAD_HGV" | "RAIL" | "SEA" | "AIR";

export const CAT4_FREIGHT_FACTORS_KG_CO2E_PER_TONNE_KM: Record<Cat4FreightMode, { factor: number; source: string }> = {
  ROAD_HGV: { factor: 0.127, source: `${DEFRA_SOURCE} — Freighting goods, HGV articulated (all diesel), average laden` },
  RAIL: { factor: 0.011, source: `${GLEC_SOURCE} — Rail freight, average` },
  SEA: { factor: 0.012, source: `${GLEC_SOURCE} — Deep-sea container shipping, average` },
  AIR: { factor: 0.602, source: `${DEFRA_SOURCE} — Freighting goods, air freight` },
};

// --- Category 6: Business travel (activity-based) --------------------------
// kg CO2e per passenger.km.
export type Cat6TravelMode = "CAR_AVERAGE" | "RAIL_NATIONAL" | "FLIGHT_SHORT_HAUL" | "FLIGHT_LONG_HAUL_ECONOMY" | "FLIGHT_LONG_HAUL_BUSINESS";

export const CAT6_TRAVEL_FACTORS_KG_CO2E_PER_PASSENGER_KM: Record<Cat6TravelMode, { factor: number; source: string }> = {
  CAR_AVERAGE: { factor: 0.17, source: `${DEFRA_SOURCE} — Business travel- land, average car (unknown fuel/size)` },
  RAIL_NATIONAL: { factor: 0.035, source: `${DEFRA_SOURCE} — Business travel- land, national rail` },
  FLIGHT_SHORT_HAUL: { factor: 0.156, source: `${DEFRA_SOURCE} — Business travel- air, short-haul, average class` },
  FLIGHT_LONG_HAUL_ECONOMY: { factor: 0.117, source: `${DEFRA_SOURCE} — Business travel- air, long-haul, economy class` },
  FLIGHT_LONG_HAUL_BUSINESS: { factor: 0.411, source: `${DEFRA_SOURCE} — Business travel- air, long-haul, business class` },
};

// --- Category 7: Employee commuting (activity-based) -----------------------
// kg CO2e per passenger.km — GHG Protocol's preferred distance-based method.
export type Cat7CommuteMode = "CAR_AVERAGE" | "BUS" | "RAIL_NATIONAL" | "MOTORBIKE_TWO_WHEELER" | "WALK_CYCLE";

export const CAT7_COMMUTE_FACTORS_KG_CO2E_PER_PASSENGER_KM: Record<Cat7CommuteMode, { factor: number; source: string }> = {
  CAR_AVERAGE: { factor: 0.17, source: `${DEFRA_SOURCE} — Business travel- land, average car (reused for commuting per DEFRA guidance)` },
  BUS: { factor: 0.102, source: `${DEFRA_SOURCE} — Business travel- land, local bus` },
  RAIL_NATIONAL: { factor: 0.035, source: `${DEFRA_SOURCE} — Business travel- land, national rail` },
  MOTORBIKE_TWO_WHEELER: { factor: 0.114, source: `${DEFRA_SOURCE} — Business travel- land, average motorbike` },
  WALK_CYCLE: { factor: 0, source: "Zero-emission commute mode" },
};

// --- Category 11: Use of sold products (activity-based) ---------------------
// Screening-level "units sold x lifetime energy/fuel use x source factor"
// method (GHG Protocol Scope 3 Technical Guidance, Category 11 average-data
// method), not full product-lifecycle modelling.
export type Cat11ProductType = "ELECTRICITY_CONSUMING" | "FUEL_CONSUMING";
export type Cat11FuelType = "DIESEL" | "PETROL" | "LPG";

/** kg CO2e per kWh — India grid average, consistent with GRID_EMISSION_FACTOR used elsewhere on the platform. */
export const CAT11_GRID_FACTOR_KG_CO2E_PER_KWH = { factor: 0.716, source: CEA_GRID_SOURCE };

/** kg CO2e per litre of fuel combusted (combustion + well-to-tank). */
export const CAT11_FUEL_FACTORS_KG_CO2E_PER_LITRE: Record<Cat11FuelType, { factor: number; source: string }> = {
  DIESEL: { factor: 2.68, source: `${DEFRA_SOURCE} — Fuels, diesel (average biofuel blend)` },
  PETROL: { factor: 2.07, source: `${DEFRA_SOURCE} — Fuels, petrol (average biofuel blend)` },
  LPG: { factor: 1.51, source: `${DEFRA_SOURCE} — Fuels, LPG` },
};
