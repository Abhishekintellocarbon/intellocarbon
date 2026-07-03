export const BORDER_SECTOR_OPTIONS = [
  { value: "IRON_STEEL", label: "Iron and Steel" },
  { value: "CEMENT", label: "Cement" },
  { value: "ALUMINIUM", label: "Aluminium" },
  { value: "FERTILIZERS", label: "Fertilizers" },
  { value: "HYDROGEN", label: "Hydrogen" },
  { value: "ELECTRICITY", label: "Electricity" },
] as const;

export const BORDER_PRODUCTION_ROUTE_OPTIONS = [
  { value: "EAF", label: "Electric Arc Furnace (EAF)" },
  { value: "BF_BOF", label: "Blast Furnace Basic Oxygen Furnace (BF-BOF)" },
] as const;

export const INDIA_SECTOR_OPTIONS = [
  { value: "ALUMINIUM", label: "Aluminium" },
  { value: "CEMENT", label: "Cement" },
  { value: "IRON_STEEL", label: "Iron and Steel" },
  { value: "CHLOR_ALKALI", label: "Chlor-Alkali" },
  { value: "FERTILIZER", label: "Fertilizer" },
  { value: "PAPER_PULP", label: "Paper and Pulp" },
  { value: "PETROCHEMICAL", label: "Petrochemical" },
  { value: "PETROLEUM_REFINERY", label: "Petroleum Refinery" },
  { value: "TEXTILE", label: "Textile" },
] as const;

export const FUEL_TYPE_MIX_OPTIONS = [
  { value: "COAL", label: "Primarily coal" },
  { value: "NATURAL_GAS", label: "Primarily natural gas" },
  { value: "MIXED", label: "Mixed coal and gas" },
  { value: "OTHER", label: "Other" },
] as const;

export const CBAM_GOOD_OPTIONS = [
  { value: "IRON_STEEL", label: "Iron and Steel (CN codes 7206-7229)" },
  { value: "CEMENT", label: "Cement (CN code 2523)" },
  { value: "ALUMINIUM", label: "Aluminium (CN codes 7601-7616)" },
  { value: "FERTILIZERS", label: "Fertilizers (CN codes 2808-3105)" },
  { value: "HYDROGEN", label: "Hydrogen (CN code 2804)" },
  { value: "ELECTRICITY", label: "Electricity (CN code 2716)" },
  { value: "NONE", label: "None of the above" },
] as const;

export const EU_EXPORT_VOLUME_OPTIONS = [
  { value: "BELOW_50", label: "Below 50 tonnes" },
  { value: "RANGE_50_500", label: "50 to 500 tonnes" },
  { value: "RANGE_500_5000", label: "500 to 5,000 tonnes" },
  { value: "ABOVE_5000", label: "Above 5,000 tonnes" },
] as const;

export const CCTS_STATUS_OPTIONS = [
  { value: "NOTIFIED", label: "Yes, we received BEE notification" },
  { value: "MAYBE", label: "We think we might be" },
  { value: "NOT_COVERED", label: "No, we are not covered" },
  { value: "NOT_SURE", label: "Not sure" },
] as const;

export const EPR_PRODUCT_OPTIONS = [
  { value: "BATTERIES", label: "Batteries (lithium ion, lead acid, etc.)" },
  { value: "PLASTIC", label: "Plastic packaging or products" },
  { value: "EEE", label: "Electronic and electrical equipment" },
  { value: "TYRES", label: "Tyres" },
  { value: "LUBRICATING_OILS", label: "Lubricating oils" },
  { value: "NONE", label: "None of the above" },
] as const;

export const fmtNum = (n: number, digits = 2) => n.toLocaleString("en-IN", { maximumFractionDigits: digits });
export const fmtEur = (n: number) => `€${fmtNum(n)}`;
export const fmtInr = (n: number) => `₹${fmtNum(n)}`;
