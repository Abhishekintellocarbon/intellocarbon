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
  { value: "OTHER", label: "Other" },
] as const;

export const PRODUCTION_ROUTE_OPTIONS = [
  { value: "BF_BOF", label: "Blast Furnace – Basic Oxygen Furnace (BF-BOF)" },
  { value: "EAF", label: "Electric Arc Furnace (EAF)" },
  { value: "DRI_EAF", label: "DRI + Electric Arc Furnace" },
  { value: "OTHER", label: "Other" },
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
};
