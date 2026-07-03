import type { Sector } from "./types";

export const SECTOR_OPTIONS = [
  { value: "STEEL", label: "Iron & Steel" },
  { value: "CEMENT", label: "Cement" },
  { value: "ALUMINIUM", label: "Aluminium" },
  { value: "FERTILIZER", label: "Fertilizer" },
  { value: "HYDROGEN", label: "Hydrogen" },
  { value: "ELECTRICITY", label: "Electricity" },
  { value: "OTHER", label: "Other" },
] as const;

export const FACILITY_TYPE_OPTIONS = [
  { value: "INTEGRATED_STEEL_PLANT", label: "Integrated steel plant (BF-BOF)" },
  { value: "EAF_MINI_MILL", label: "EAF mini-mill" },
  { value: "DRI_PLANT", label: "DRI plant" },
  { value: "ROLLING_MILL", label: "Rolling mill" },
  { value: "PELLET_PLANT", label: "Pellet plant" },
  { value: "CEMENT_PLANT", label: "Cement plant" },
  { value: "ALUMINIUM_SMELTER", label: "Aluminium smelter" },
  { value: "FERTILIZER_PLANT", label: "Fertilizer plant" },
  { value: "HYDROGEN_PLANT", label: "Hydrogen plant" },
  { value: "POWER_PLANT", label: "Power plant" },
  { value: "OTHER", label: "Other" },
] as const;

/** Which facility types are offered for each sector at facility creation — mirrors backend `SECTOR_FACILITY_TYPES`. */
export const SECTOR_FACILITY_TYPE_VALUES: Record<Sector, string[]> = {
  STEEL: ["INTEGRATED_STEEL_PLANT", "EAF_MINI_MILL", "DRI_PLANT", "ROLLING_MILL", "PELLET_PLANT", "OTHER"],
  CEMENT: ["CEMENT_PLANT", "OTHER"],
  ALUMINIUM: ["ALUMINIUM_SMELTER", "OTHER"],
  FERTILIZER: ["FERTILIZER_PLANT", "OTHER"],
  HYDROGEN: ["HYDROGEN_PLANT", "OTHER"],
  ELECTRICITY: ["POWER_PLANT", "OTHER"],
  OTHER: ["OTHER"],
};

/** Flat list of every production route across all sectors — used for display-label lookups (facility list/detail pages) regardless of sector. Sector-scoped option lists for the create/edit form come from the reference API's `sectorProductionRoutes`. */
export const PRODUCTION_ROUTE_OPTIONS = [
  { value: "BF_BOF", label: "Blast Furnace – Basic Oxygen Furnace (BF-BOF)" },
  { value: "EAF", label: "Electric Arc Furnace (EAF)" },
  { value: "DRI_EAF", label: "DRI + Electric Arc Furnace" },
  { value: "CLINKER_PRODUCTION", label: "Clinker production" },
  { value: "CEMENT_GRINDING", label: "Cement grinding" },
  { value: "HALL_HEROULT", label: "Hall-Héroult electrolysis (primary aluminium)" },
  { value: "AMMONIA_SYNTHESIS", label: "Ammonia synthesis (Haber-Bosch)" },
  { value: "NITRIC_ACID", label: "Nitric acid production (Ostwald)" },
  { value: "UREA_SYNTHESIS", label: "Urea synthesis" },
  { value: "AMMONIUM_NITRATE", label: "Ammonium nitrate production" },
  { value: "SMR", label: "Steam Methane Reforming (grey hydrogen)" },
  { value: "SMR_CCS", label: "SMR with CCS (blue hydrogen)" },
  { value: "ELECTROLYSIS_GRID", label: "Electrolysis — grid electricity (yellow hydrogen)" },
  { value: "ELECTROLYSIS_RENEWABLE", label: "Electrolysis — dedicated renewable electricity (green hydrogen)" },
  { value: "BIOMASS", label: "Biomass gasification / combustion" },
  { value: "THERMAL_COAL", label: "Thermal (coal)" },
  { value: "THERMAL_GAS", label: "Thermal (gas)" },
  { value: "NUCLEAR", label: "Nuclear" },
  { value: "HYDRO", label: "Hydro" },
  { value: "WIND", label: "Wind" },
  { value: "SOLAR", label: "Solar" },
  { value: "MIXED_GRID", label: "Mixed grid" },
  { value: "OTHER", label: "Other" },
] as const;

export const HYDROGEN_ROUTE_OPTIONS = [
  { value: "SMR", label: "Steam Methane Reforming (grey hydrogen)" },
  { value: "SMR_CCS", label: "SMR with CCS (blue hydrogen)" },
  { value: "ELECTROLYSIS_GRID", label: "Electrolysis — grid electricity (yellow hydrogen)" },
  { value: "ELECTROLYSIS_RENEWABLE", label: "Electrolysis — dedicated renewable electricity (green hydrogen)" },
  { value: "BIOMASS", label: "Biomass gasification (bio-hydrogen)" },
] as const;

export const FY_START_MONTH_OPTIONS = [
  { value: "1", label: "January" },
  { value: "4", label: "April (Indian FY)" },
  { value: "7", label: "July" },
  { value: "10", label: "October" },
] as const;

export const FUEL_UNIT_LABELS: Record<string, string> = {
  TONNE: "tonnes",
  KILOLITRE: "kilolitres",
  THOUSAND_NM3: "'000 Nm³",
  GJ: "GJ",
};
