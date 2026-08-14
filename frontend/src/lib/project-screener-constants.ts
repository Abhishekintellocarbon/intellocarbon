/**
 * Options for the Project Eligibility Screener.
 *
 * Kept in its own module rather than added to intellocalc-constants.ts: the
 * screener is not an IntelloCalc tool, it screens a different subject (a
 * credit-generating project, not an entity's compliance position), and mixing
 * the two option sets would be the first step towards them being presented as
 * one product.
 */

export const PROJECT_TYPE_OPTIONS = [
  { value: "RENEWABLE_ENERGY", label: "Renewable energy (solar, wind, hydro, hybrid)" },
  { value: "FORESTRY_AFFORESTATION", label: "Forestry / afforestation / reforestation" },
  { value: "BIOCHAR", label: "Biochar" },
  { value: "BIOGAS_LANDFILL_GAS", label: "Biogas / landfill gas capture" },
  { value: "ENHANCED_ROCK_WEATHERING", label: "Enhanced rock weathering" },
  { value: "INDUSTRIAL_ENERGY_EFFICIENCY", label: "Industrial energy efficiency" },
  { value: "OTHER", label: "Other / not listed" },
] as const;

/**
 * Scale as bands rather than a number.
 *
 * The screening question scale actually answers is whether a project can carry
 * its own validation and verification cost or should be looking at a grouped
 * approach — which is a banded question. Asking for an exact capacity would
 * invite the reader to expect an exact answer back, and the units differ by
 * project type anyway (MW, hectares, tonnes per year), so one numeric field
 * could not have meant the same thing across the list above.
 */
export const SCALE_BAND_OPTIONS = [
  { value: "MICRO", label: "Micro — e.g. under 1 MW, under 50 ha, or under 1,000 t/yr" },
  { value: "SMALL", label: "Small — e.g. 1–10 MW, 50–500 ha, or 1,000–10,000 t/yr" },
  { value: "MEDIUM", label: "Medium — e.g. 10–50 MW, 500–5,000 ha, or 10,000–100,000 t/yr" },
  { value: "LARGE", label: "Large — e.g. above 50 MW, above 5,000 ha, or above 100,000 t/yr" },
] as const;

export const PROJECT_STAGE_OPTIONS = [
  { value: "CONCEPT", label: "Concept — not yet designed" },
  { value: "PLANNING", label: "Planning — designed, not yet built" },
  { value: "UNDER_CONSTRUCTION", label: "Under construction" },
  { value: "OPERATIONAL", label: "Operational" },
] as const;

/** States and union territories of India, alphabetically. */
export const INDIAN_STATE_OPTIONS = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
] as const;

export const SCREENER_DISCLAIMER =
  "This is an indicative screening tool only. Actual project eligibility depends on detailed methodology-specific assessment by the relevant registry.";
