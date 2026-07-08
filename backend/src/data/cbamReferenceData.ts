/**
 * Reference data for the CBAM Communication Package PDF (see
 * `services/cbamReport/`) and for the sector/facility/production-route
 * pickers shown at facility creation. These follow the same convention as
 * `emissionFactors.ts` / `gwpTables.ts`: real published figures where known,
 * an explicit source citation, and a clear "illustrative / confirm before
 * submission" label wherever the exact figure depends on inputs this platform
 * doesn't capture (the precise CN code, the Commission's most recent quarterly
 * publication, etc). Nothing here is presented as a certified compliance value.
 */

import type { FacilityType, Sector } from "@prisma/client";

export interface CbamCertificatePriceReference {
  pricePerTonneEur: number;
  quarterLabel: string;
  asOfDate: string;
  source: string;
}

const quarterLabelFor = (date: Date): string => `Q${Math.floor(date.getUTCMonth() / 3) + 1} ${date.getUTCFullYear()}`;

/**
 * Official CBAM certificate reference price.
 *
 * Under Regulation (EU) 2023/956 Article 21, the Commission calculates and
 * publishes a CBAM certificate price during the transitional period ahead of
 * the definitive regime — certificate *sales* only open from February 2027,
 * but the Commission has been publishing a quarterly reference price since
 * Q1 2026 (EUR 75.36, published 7 Apr 2026). This is that published figure,
 * updated each quarter from the Commission's price page — not an estimate.
 *
 * Mutable module state rather than a bare constant: the Super Admin
 * Emission Factor Manager (/admin/emission-factors) can update this at
 * runtime via PUT /api/admin/cbam-certificate-price, which supersedes the
 * current "CBAM Certificate Price" EmissionFactor row (preserving history)
 * and then calls setCbamCertificatePrice() so every consumer picks up the
 * new value immediately. quarterLabel/asOfDate are derived from the row's
 * validFrom rather than entered separately. Hydrated from the DB at server
 * startup by hydrateEmissionFactorCache() in emissionFactor.service.ts.
 */
let currentCertificatePrice: CbamCertificatePriceReference = {
  pricePerTonneEur: 75.28,
  quarterLabel: "Q2 2026",
  asOfDate: "2026-07-06",
  source:
    "European Commission — https://taxation-customs.ec.europa.eu/carbon-border-adjustment-mechanism/price-cbam-certificates_en",
};

export const getCbamCertificatePrice = (): CbamCertificatePriceReference => currentCertificatePrice;

export const setCbamCertificatePrice = (value: number, source: string, validFrom: Date): void => {
  currentCertificatePrice = {
    pricePerTonneEur: value,
    quarterLabel: quarterLabelFor(validFrom),
    asOfDate: validFrom.toISOString().slice(0, 10),
    source,
  };
};

export interface EuDefaultSeeReference {
  valueTco2ePerTonne: number;
  source: string;
}

const CBAM_DEFAULT_SOURCE =
  "Illustrative default — confirm against Commission Implementing Regulation (EU) 2025/2621 default value for the declared CN code before relying on this for a regulatory submission.";

/**
 * Illustrative EU default Specific Embedded Emissions (SEE) values, standing
 * in for the CN-code-specific default values the Commission publishes under
 * its CBAM default-values implementing act (Commission Implementing
 * Regulation (EU) 2025/2621). Steel is keyed by production route (route
 * drives embedded emissions far more than product for steel); the other
 * sectors are keyed by a sector-level or product-level default per the
 * platform's build brief.
 */
export const EU_DEFAULT_SEE_BY_ROUTE: Record<string, EuDefaultSeeReference> = {
  BF_BOF: { valueTco2ePerTonne: 2.05, source: CBAM_DEFAULT_SOURCE },
  DRI_EAF: { valueTco2ePerTonne: 1.35, source: CBAM_DEFAULT_SOURCE },
  EAF: { valueTco2ePerTonne: 0.45, source: CBAM_DEFAULT_SOURCE },
  OTHER: { valueTco2ePerTonne: 1.9, source: CBAM_DEFAULT_SOURCE },
};

export const EU_DEFAULT_SEE_CEMENT: EuDefaultSeeReference = {
  valueTco2ePerTonne: 0.87,
  source: `Portland cement / clinker / other hydraulic cement default. ${CBAM_DEFAULT_SOURCE}`,
};

export const EU_DEFAULT_SEE_ALUMINIUM: EuDefaultSeeReference = {
  valueTco2ePerTonne: 10.49,
  source: `Unwrought primary aluminium (Hall-Héroult electrolysis) default. ${CBAM_DEFAULT_SOURCE}`,
};

export const EU_DEFAULT_SEE_HYDROGEN: EuDefaultSeeReference = {
  valueTco2ePerTonne: 10.4,
  source: `Hydrogen — Steam Methane Reforming (SMR) route without CCS default. Blue/green/electrolysis routes carry substantially lower actual SEE; this figure is a grey-hydrogen baseline for comparison only. ${CBAM_DEFAULT_SOURCE}`,
};

export const EU_DEFAULT_SEE_BY_FERTILIZER_PRODUCT: Record<string, EuDefaultSeeReference> = {
  AMMONIA: { valueTco2ePerTonne: 3.57, source: CBAM_DEFAULT_SOURCE },
  NITRIC_ACID: { valueTco2ePerTonne: 1.87, source: CBAM_DEFAULT_SOURCE },
  UREA: { valueTco2ePerTonne: 2.67, source: CBAM_DEFAULT_SOURCE },
  AMMONIUM_NITRATE: { valueTco2ePerTonne: 1.57, source: CBAM_DEFAULT_SOURCE },
  MIXED_FERTILIZER: { valueTco2ePerTonne: 2.09, source: CBAM_DEFAULT_SOURCE },
};

const normalizeProductKey = (value: string) => value.trim().toUpperCase().replace(/[\s-]+/g, "_");

/**
 * Resolve the EU default SEE reference for a given sector/route/product
 * combination. Steel remains route-driven; cement/aluminium/hydrogen use a
 * single sector-level default; fertilizer is product-driven (matched against
 * `productCategory` on a best-effort normalised basis, falling back to a
 * blended "other fertilizer" figure); electricity has no per-tonne default
 * (CBAM SEE for electricity is per MWh) so callers should special-case it.
 */
export const getEuDefaultSee = (
  sector: Sector,
  productionRoute: string,
  productCategory?: string,
): EuDefaultSeeReference => {
  if (sector === "CEMENT") return EU_DEFAULT_SEE_CEMENT;
  if (sector === "ALUMINIUM") return EU_DEFAULT_SEE_ALUMINIUM;
  if (sector === "HYDROGEN") return EU_DEFAULT_SEE_HYDROGEN;
  if (sector === "ELECTRICITY") {
    return {
      valueTco2ePerTonne: 0,
      source:
        "CBAM does not publish a default SEE for electricity — the Commission's implementing act requires actual emissions per MWh exported to the EU. This figure is per MWh, not per tonne; see the Electricity section of this report for the actual computed value.",
    };
  }
  if (sector === "FERTILIZER") {
    const key = productCategory ? normalizeProductKey(productCategory) : "";
    return (
      EU_DEFAULT_SEE_BY_FERTILIZER_PRODUCT[key] ?? {
        valueTco2ePerTonne: 2.354,
        source: `No exact product match for "${productCategory ?? "unspecified"}" — showing the average of the five gazetted fertilizer product defaults (ammonia, nitric acid, urea, ammonium nitrate, mixed fertilizers). ${CBAM_DEFAULT_SOURCE}`,
      }
    );
  }
  return EU_DEFAULT_SEE_BY_ROUTE[productionRoute] ?? EU_DEFAULT_SEE_BY_ROUTE.OTHER;
};

/** Human-readable CBAM activity / Annex I goods-category label, derived from sector + production route — not a stored field. */
export const getCbamActivity = (sector: Sector, productionRoute: string): string => {
  switch (sector) {
    case "STEEL": {
      const labels: Record<string, string> = {
        BF_BOF: "Iron and steel — Basic Oxygen Furnace (integrated BF-BOF) steelmaking",
        EAF: "Iron and steel — Electric Arc Furnace (EAF) steelmaking",
        DRI_EAF: "Iron and steel — Direct Reduced Iron + Electric Arc Furnace steelmaking",
        OTHER: "Iron and steel production",
      };
      return labels[productionRoute] ?? labels.OTHER;
    }
    case "CEMENT":
      return "Cement — clinker production and/or cement grinding";
    case "ALUMINIUM":
      return "Aluminium — primary unwrought aluminium (Hall-Héroult electrolysis)";
    case "FERTILIZER":
      return "Fertilizers — ammonia / nitric acid / urea / ammonium nitrate / mixed fertilizer production";
    case "HYDROGEN":
      return "Hydrogen production";
    case "ELECTRICITY":
      return "Electricity — generation and export to the EU customs territory";
    default:
      return "CBAM goods production";
  }
};

export const CN_CODES_BY_SECTOR: Record<Sector, { code: string; label: string }[]> = {
  STEEL: [],
  CEMENT: [
    { code: "2523 10 00", label: "Clinker" },
    { code: "2523 21 00", label: "White Portland cement" },
    { code: "2523 29 00", label: "Other Portland cement" },
    { code: "2523 30 00", label: "Aluminous cement" },
    { code: "2523 90 00", label: "Other hydraulic cement" },
  ],
  ALUMINIUM: [
    { code: "7601 10 00", label: "Unwrought aluminium, not alloyed" },
    { code: "7601 20", label: "Unwrought aluminium alloys" },
    { code: "7603", label: "Aluminium powders and flakes" },
    { code: "7604", label: "Aluminium bars, rods and profiles" },
    { code: "7605", label: "Aluminium wire" },
    { code: "7606", label: "Aluminium plates, sheets and strip" },
    { code: "7607", label: "Aluminium foil" },
    { code: "7608", label: "Aluminium tubes and pipes" },
    { code: "7609 00 00", label: "Aluminium tube and pipe fittings" },
    { code: "7610", label: "Aluminium structures" },
    { code: "7611 00 00", label: "Aluminium reservoirs and tanks" },
    { code: "7612", label: "Aluminium casks, drums and cans" },
    { code: "7613 00 00", label: "Aluminium containers for compressed gas" },
    { code: "7614", label: "Stranded wire, cables and the like" },
    { code: "7616", label: "Other articles of aluminium" },
  ],
  FERTILIZER: [
    { code: "2808 00 00", label: "Nitric acid" },
    { code: "2814", label: "Ammonia, anhydrous or in aqueous solution" },
    { code: "2834 21 00", label: "Potassium nitrate" },
    { code: "3102", label: "Mineral or chemical nitrogenous fertilizers" },
    { code: "3102 10", label: "Urea" },
    { code: "3102 21 00", label: "Ammonium sulphate" },
    { code: "3102 30", label: "Ammonium nitrate" },
    { code: "3102 40", label: "Mixtures of ammonium nitrate with calcium carbonate" },
    { code: "3102 50", label: "Sodium nitrate" },
    { code: "3102 60", label: "Double salts and mixtures of calcium/ammonium nitrate" },
    { code: "3102 80", label: "Mixtures of urea and ammonium nitrate" },
    { code: "3102 90", label: "Other nitrogenous fertilizers" },
    { code: "3105", label: "Mineral fertilizers with two or three fertilizing elements" },
  ],
  HYDROGEN: [{ code: "2804 10 00", label: "Hydrogen" }],
  ELECTRICITY: [{ code: "2716 00 00", label: "Electrical energy" }],
  OTHER: [],
};

export const SECTOR_FACILITY_TYPES: Record<Sector, FacilityType[]> = {
  STEEL: ["INTEGRATED_STEEL_PLANT", "EAF_MINI_MILL", "DRI_PLANT", "ROLLING_MILL", "PELLET_PLANT", "OTHER"],
  CEMENT: ["CEMENT_PLANT", "OTHER"],
  ALUMINIUM: ["ALUMINIUM_SMELTER", "OTHER"],
  FERTILIZER: ["FERTILIZER_PLANT", "OTHER"],
  HYDROGEN: ["HYDROGEN_PLANT", "OTHER"],
  ELECTRICITY: ["POWER_PLANT", "OTHER"],
  OTHER: ["OTHER"],
};

export const SECTOR_PRODUCTION_ROUTES: Record<Sector, { value: string; label: string }[]> = {
  STEEL: [
    { value: "BF_BOF", label: "Blast Furnace – Basic Oxygen Furnace (BF-BOF)" },
    { value: "EAF", label: "Electric Arc Furnace (EAF)" },
    { value: "DRI_EAF", label: "DRI + Electric Arc Furnace" },
    { value: "OTHER", label: "Other" },
  ],
  CEMENT: [
    { value: "CLINKER_PRODUCTION", label: "Clinker production" },
    { value: "CEMENT_GRINDING", label: "Cement grinding" },
    { value: "OTHER", label: "Other" },
  ],
  ALUMINIUM: [
    { value: "HALL_HEROULT", label: "Hall-Héroult electrolysis (primary aluminium)" },
    { value: "OTHER", label: "Other" },
  ],
  FERTILIZER: [
    { value: "AMMONIA_SYNTHESIS", label: "Ammonia synthesis (Haber-Bosch)" },
    { value: "NITRIC_ACID", label: "Nitric acid production (Ostwald)" },
    { value: "UREA_SYNTHESIS", label: "Urea synthesis" },
    { value: "AMMONIUM_NITRATE", label: "Ammonium nitrate production" },
    { value: "OTHER", label: "Other" },
  ],
  HYDROGEN: [
    { value: "SMR", label: "Steam Methane Reforming (grey hydrogen)" },
    { value: "SMR_CCS", label: "SMR with CCS (blue hydrogen)" },
    { value: "ELECTROLYSIS_GRID", label: "Electrolysis — grid electricity (yellow hydrogen)" },
    { value: "ELECTROLYSIS_RENEWABLE", label: "Electrolysis — dedicated renewable electricity (green hydrogen)" },
    { value: "BIOMASS", label: "Biomass gasification (bio-hydrogen)" },
  ],
  ELECTRICITY: [
    { value: "THERMAL_COAL", label: "Thermal (coal)" },
    { value: "THERMAL_GAS", label: "Thermal (gas)" },
    { value: "NUCLEAR", label: "Nuclear" },
    { value: "HYDRO", label: "Hydro" },
    { value: "WIND", label: "Wind" },
    { value: "SOLAR", label: "Solar" },
    { value: "BIOMASS", label: "Biomass" },
    { value: "MIXED_GRID", label: "Mixed grid" },
  ],
  OTHER: [{ value: "OTHER", label: "Other" }],
};

export const FERTILIZER_PRODUCT_OPTIONS = [
  { value: "Ammonia", label: "Ammonia" },
  { value: "Nitric Acid", label: "Nitric acid" },
  { value: "Urea", label: "Urea" },
  { value: "Ammonium Nitrate", label: "Ammonium nitrate" },
  { value: "Mixed Fertilizer", label: "Mixed fertilizer" },
];
