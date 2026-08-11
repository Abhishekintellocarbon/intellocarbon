/**
 * Water source library for the ISO 14046 water footprint engine — the water
 * counterpart to FUEL_LIBRARY in emissionFactors.ts, and deliberately the same
 * shape: a keyed Record of definitions, each carrying the coefficient the
 * calculation engine multiplies and the citation it comes from.
 *
 * ISO 14046 draws its central distinction between *withdrawal* (water removed
 * from a catchment), *discharge* (water returned to it) and *consumption* (the
 * difference — water that does not come back, through evaporation, product
 * incorporation or transfer to another catchment). Those three are volumes,
 * measured per source, and are captured on WaterEntry rather than derived from
 * a factor.
 *
 * What IS a factor here is `freshwaterFactor`: the share of a source's
 * withdrawal that draws on the freshwater catchment. It is 1 for every primary
 * abstraction (municipal supply, groundwater, surface water) and 0 for water
 * that has already been used and reclaimed on site. This is the standard
 * methodological convention — recycled/reused water is excluded from
 * freshwater withdrawal under ISO 14046's inventory rules, and the same
 * exclusion appears in BRSR Core's water disclosure and CDP Water Security —
 * not a measured coefficient, which is why it takes only the values 0 and 1
 * and why `source` cites a methodology rather than a measurement.
 *
 * Deliberately NOT modelled here: AWARE-style scarcity characterisation
 * factors, which would turn the inventory into a *water scarcity footprint*.
 * Those are region-specific published values we do not hold, and the platform's
 * no-assumed-values rule means inventing plausible-looking ones is worse than
 * omitting the metric. The type below has room for one to be added per source
 * later, against a real citation, without touching the calculation engine.
 */

export type WaterSourceCategory = "FRESHWATER" | "RECLAIMED";

export interface WaterSourceDefinition {
  key: string;
  label: string;
  category: WaterSourceCategory;
  /**
   * Fraction of withdrawal from this source that counts as freshwater
   * abstraction — 1 for primary sources, 0 for reclaimed. Overridable per
   * entry line (see WaterEntry.freshwaterFactorOverride) for the real case of
   * a municipal supply that is itself partly recycled water.
   */
  freshwaterFactor: number;
  /** Why this factor is what it is — surfaced in the UI and on reports. */
  source: string;
  /** Shown under the source in the data-entry form. */
  description: string;
}

const ISO_14046_INVENTORY =
  "ISO 14046:2014 — water footprint inventory: withdrawal from the freshwater catchment, net of reclaimed water reused on site";

export const WATER_SOURCE_LIBRARY: Record<string, WaterSourceDefinition> = {
  MUNICIPAL: {
    key: "MUNICIPAL",
    label: "Municipal / third-party supply",
    category: "FRESHWATER",
    freshwaterFactor: 1,
    source: ISO_14046_INVENTORY,
    description: "Piped supply from a municipal corporation, water board, or industrial estate operator.",
  },
  GROUNDWATER: {
    key: "GROUNDWATER",
    label: "Groundwater (borewell / tubewell)",
    category: "FRESHWATER",
    freshwaterFactor: 1,
    source: ISO_14046_INVENTORY,
    description: "Abstracted on site from an aquifer, whether or not metered by the CGWA permit.",
  },
  SURFACE_WATER: {
    key: "SURFACE_WATER",
    label: "Surface water (river / canal / lake)",
    category: "FRESHWATER",
    freshwaterFactor: 1,
    source: ISO_14046_INVENTORY,
    description: "Drawn directly from a river, canal, reservoir, lake, or pond.",
  },
  RECYCLED: {
    key: "RECYCLED",
    label: "Recycled / reclaimed water",
    category: "RECLAIMED",
    freshwaterFactor: 0,
    source: ISO_14046_INVENTORY,
    description:
      "Treated effluent reused on site, or reclaimed water bought from a treatment plant. Counted in total withdrawal but excluded from freshwater withdrawal.",
  },
};

export const WATER_SOURCE_KEYS = Object.keys(WATER_SOURCE_LIBRARY);

/** Unit every water volume on the platform is stored and reported in. */
export const WATER_VOLUME_UNIT = "m3";

/**
 * BRSR Core Attribute 2 stores the same physical quantity in kilolitres
 * (BrsrCoreReport.waterWithdrawnKl / waterDischargedKl). 1 KL is exactly
 * 1 m³, so the two are directly comparable with no conversion factor — this
 * constant exists to make that explicit at the one place a future
 * reconciliation between the two would sit, rather than leaving a reader to
 * assume it.
 */
export const M3_PER_KILOLITRE = 1;
