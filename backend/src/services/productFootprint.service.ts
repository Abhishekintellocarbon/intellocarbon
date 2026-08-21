/**
 * Indicative per-SKU carbon footprint, by volume allocation.
 *
 * ===========================================================================
 * WHAT THIS IS NOT.
 *
 * Not an LCA. A life cycle assessment traces a product from raw material
 * extraction through manufacture, distribution, use and end of life. This
 * divides one facility's own Scope 1 and 2 by production share, so it excludes
 * the embodied emissions of every input bought in, all transport, the use
 * phase and end of life — for most products the majority of the real
 * footprint. The number here is smaller than a cradle-to-grave figure, often
 * by a lot, and the two must never be compared.
 *
 * Not a declarable figure. It is not suitable for a customer product
 * declaration, an Environmental Product Declaration, or a CBAM submission,
 * each of which has its own prescribed method.
 *
 * THE BIGGER WEAKNESS IS THE ALLOCATION, NOT THE BOUNDARY.
 *
 * Splitting emissions by production volume assumes every SKU is equally
 * emissions-intensive per unit. That is usually false: a complex or
 * thin-gauge product can take several times the energy per tonne of a simple
 * one, so volume allocation understates the first and overstates the second,
 * and the error is largest for exactly the specialised products a customer is
 * most likely to ask about. ISO 14067 and the GHG Protocol Product Standard
 * both prefer physical causality where it can be established.
 *
 * This is stated on the output rather than buried, because a per-unit figure
 * in kgCO2e looks precise and invites being quoted.
 * ===========================================================================
 */

export interface SkuInput {
  id: string;
  name: string;
  skuCode: string | null;
  productionQuantity: number;
  unit: string;
}

export interface SkuFootprint {
  skuId: string;
  name: string;
  skuCode: string | null;
  productionQuantity: number;
  unit: string;
  /** Share of the allocated production this SKU represents, 0-100. */
  allocationSharePct: number;
  allocatedTco2e: number;
  /** kgCO2e per unit of `unit`. Indicative — see the module notes. */
  perUnitKgCo2e: number;
}

export interface ProductFootprintAllocation {
  hasData: boolean;
  periodLabel: string | null;
  /** Facility Scope 1 + 2 being allocated. */
  facilityEmissionsTco2e: number;
  /** Sum of the SKU quantities. */
  allocatedQuantity: number;
  /** The facility's own reported production, where it can be compared. */
  facilityProductionQuantity: number | null;
  /**
   * Share of the facility's reported production the listed SKUs account for.
   * Null when the facility's production is not comparable — different units,
   * or none reported.
   */
  productionCoveragePct: number | null;
  skus: SkuFootprint[];
  unavailableReason: string | null;
}

const round = (value: number, decimals = 3) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const EMPTY: ProductFootprintAllocation = {
  hasData: false,
  periodLabel: null,
  facilityEmissionsTco2e: 0,
  allocatedQuantity: 0,
  facilityProductionQuantity: null,
  productionCoveragePct: null,
  skus: [],
  unavailableReason: null,
};

/**
 * Allocates facility emissions across SKUs by share of listed production.
 *
 * The denominator is the sum of the SKUs listed, not the facility's total
 * output. That means the shares always sum to 100% of what was listed, and
 * `productionCoveragePct` separately reports how much of the facility's actual
 * production those SKUs represent. Allocating against total production instead
 * would leave an unexplained remainder and quietly shrink every per-unit
 * figure in proportion to how much of the product mix had been entered.
 */
export const buildProductFootprint = (
  periodLabel: string | null,
  facilityEmissionsTco2e: number,
  skus: SkuInput[],
  facilityProductionQuantity: number | null,
  facilityProductionUnit: string | null = "tonnes",
): ProductFootprintAllocation => {
  if (skus.length === 0) {
    return { ...EMPTY, periodLabel, unavailableReason: "Add the products this facility makes to allocate its emissions across them." };
  }

  const usable = skus.filter((s) => s.productionQuantity > 0);
  if (usable.length === 0) {
    return { ...EMPTY, periodLabel, unavailableReason: "Every listed product reports zero output for this period, so there is nothing to allocate against." };
  }

  if (facilityEmissionsTco2e <= 0) {
    return {
      ...EMPTY,
      periodLabel,
      unavailableReason: "No calculated Scope 1 or 2 emissions for this facility and period yet — submit activity data and the allocation appears here.",
    };
  }

  const totalQuantity = usable.reduce((sum, s) => sum + s.productionQuantity, 0);

  const allocated: SkuFootprint[] = usable
    .map((sku) => {
      const share = sku.productionQuantity / totalQuantity;
      const allocatedTco2e = facilityEmissionsTco2e * share;
      return {
        skuId: sku.id,
        name: sku.name,
        skuCode: sku.skuCode,
        productionQuantity: sku.productionQuantity,
        unit: sku.unit,
        allocationSharePct: round(share * 100, 1),
        allocatedTco2e: round(allocatedTco2e, 2),
        // tCO2e -> kgCO2e per unit.
        perUnitKgCo2e: round((allocatedTco2e * 1000) / sku.productionQuantity, 2),
      };
    })
    .sort((a, b) => b.allocatedTco2e - a.allocatedTco2e);

  // Coverage is only meaningful when the SKUs are measured in the same unit as
  // the facility's reported production. Comparing 400 units against 12,000
  // tonnes would produce a coverage figure that means nothing.
  const unitsAgree =
    facilityProductionUnit != null && usable.every((s) => s.unit.toLowerCase() === facilityProductionUnit.toLowerCase());
  const productionCoveragePct =
    unitsAgree && facilityProductionQuantity != null && facilityProductionQuantity > 0
      ? round((totalQuantity / facilityProductionQuantity) * 100, 1)
      : null;

  return {
    hasData: true,
    periodLabel,
    facilityEmissionsTco2e: round(facilityEmissionsTco2e, 2),
    allocatedQuantity: round(totalQuantity, 3),
    facilityProductionQuantity,
    productionCoveragePct,
    skus: allocated,
    unavailableReason: null,
  };
};

export const PRODUCT_FOOTPRINT_METHOD = "Volume allocation of facility Scope 1 and 2 emissions";

/** Rendered with every per-unit figure. Asserted on substance by tests. */
export const PRODUCT_FOOTPRINT_NOTICE =
  "Indicative only. This divides this facility's own Scope 1 and 2 emissions across its products by share of " +
  "output — it is not a life cycle assessment. It excludes the emissions embodied in everything you buy in, all " +
  "transport, the use phase and end of life, which for most products is the majority of the real footprint. " +
  "Volume allocation also assumes every product is equally emissions-intensive per unit, so a complex or " +
  "energy-heavy line is understated and a simple one overstated. Do not use these figures for a customer product " +
  "declaration, an EPD or a CBAM submission.";

// ---------------------------------------------------------------------------
// Company-level rollup
// ---------------------------------------------------------------------------

export interface CompanySkuFootprint extends SkuFootprint {
  facilityId: string;
  facilityName: string;
}

export interface CompanyProductFootprint {
  hasData: boolean;
  periodLabel: string | null;
  /** Sum of what was allocated at each site. A sum of tonnes is meaningful; a sum of per-unit figures is not. */
  totalAllocatedTco2e: number;
  skuCount: number;
  /** Sites that produced an allocation, and sites that listed products at all. */
  facilitiesAllocated: number;
  facilitiesWithSkus: number;
  rows: CompanySkuFootprint[];
  unavailableReason: string | null;
}

/**
 * The same allocation as buildProductFootprint, run per facility and then
 * listed together for the company view.
 *
 * Deliberately NOT an aggregation. Allocation is only defined inside a
 * facility — it divides that site's own Scope 1 and 2 across that site's
 * output — so the rollup runs the calculation once per site and concatenates
 * the results. Nothing is averaged across sites and nothing is merged.
 *
 * In particular, the same product made at two facilities stays as two rows.
 * Merging them would need a weighted mean of two per-unit figures derived from
 * two different emissions bases, which would read as one measured number for
 * the product while being an average of two indicative ones. Two rows, each
 * naming its site, states what is actually known.
 *
 * `allocationSharePct` on each row therefore remains a share of its own
 * facility, not of the company — the caller has to label it as such, because
 * the column does not sum to 100 across a multi-site table.
 */
export const buildCompanyProductFootprint = (
  periodLabel: string | null,
  perFacility: {
    facilityId: string;
    facilityName: string;
    allocation: ProductFootprintAllocation;
  }[],
): CompanyProductFootprint => {
  const withSkus = perFacility.filter((f) => f.allocation.skus.length > 0 || f.allocation.unavailableReason != null);
  const allocated = perFacility.filter((f) => f.allocation.hasData);

  const rows: CompanySkuFootprint[] = allocated
    .flatMap((f) => f.allocation.skus.map((sku) => ({ ...sku, facilityId: f.facilityId, facilityName: f.facilityName })))
    .sort((a, b) => b.allocatedTco2e - a.allocatedTco2e);

  if (rows.length === 0) {
    return {
      hasData: false,
      periodLabel,
      totalAllocatedTco2e: 0,
      skuCount: 0,
      facilitiesAllocated: 0,
      facilitiesWithSkus: withSkus.length,
      rows: [],
      // The single most common blocker, surfaced verbatim rather than
      // rewritten, so the company view and the facility view give the same
      // reason for the same gap. Only when every site agrees on it — otherwise
      // there is no one reason to state.
      unavailableReason:
        withSkus.length > 0 && new Set(withSkus.map((f) => f.allocation.unavailableReason)).size === 1
          ? withSkus[0]!.allocation.unavailableReason
          : null,
    };
  }

  return {
    hasData: true,
    periodLabel,
    totalAllocatedTco2e: round(rows.reduce((sum, r) => sum + r.allocatedTco2e, 0), 2),
    skuCount: rows.length,
    facilitiesAllocated: allocated.length,
    facilitiesWithSkus: withSkus.length,
    rows,
    unavailableReason: null,
  };
};
