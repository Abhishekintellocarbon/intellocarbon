import { describe, it, expect } from "vitest";
import {
  buildCompanyProductFootprint,
  buildProductFootprint,
  PRODUCT_FOOTPRINT_NOTICE,
  type SkuInput,
} from "../productFootprint.service";

/**
 * A per-unit kgCO2e figure looks precise and invites being quoted — into a
 * tender, a customer declaration, a product page. It is an allocation of one
 * facility's own emissions, not a life cycle assessment, and volume allocation
 * additionally assumes every product is equally emissions-intensive per unit.
 *
 * These tests cover the arithmetic, and the two places the presentation could
 * mislead: coverage of the product mix, and unit mismatches.
 */

const sku = (id: string, quantity: number, unit = "tonnes"): SkuInput => ({
  id,
  name: `Product ${id}`,
  skuCode: null,
  productionQuantity: quantity,
  unit,
});

describe("allocation arithmetic", () => {
  it("splits emissions by share of listed output", () => {
    const a = buildProductFootprint("FY2025-26", 1000, [sku("a", 750), sku("b", 250)], 1000);
    const first = a.skus.find((s) => s.skuId === "a")!;
    const second = a.skus.find((s) => s.skuId === "b")!;
    expect(first.allocationSharePct).toBe(75);
    expect(first.allocatedTco2e).toBe(750);
    expect(second.allocatedTco2e).toBe(250);
  });

  it("converts the per-unit figure to kgCO2e", () => {
    // 750 tCO2e over 750 t = 1 tCO2e/t = 1000 kg/t
    const a = buildProductFootprint("FY2025-26", 1000, [sku("a", 750), sku("b", 250)], 1000);
    expect(a.skus.find((s) => s.skuId === "a")!.perUnitKgCo2e).toBe(1000);
  });

  it("orders SKUs by allocated emissions, largest first", () => {
    const a = buildProductFootprint("FY2025-26", 100, [sku("small", 10), sku("big", 90)], 100);
    expect(a.skus.map((s) => s.skuId)).toEqual(["big", "small"]);
  });

  it("allocates the full emissions total across the listed SKUs", () => {
    const a = buildProductFootprint("FY2025-26", 900, [sku("a", 1), sku("b", 1), sku("c", 1)], 3);
    const sum = a.skus.reduce((t, s) => t + s.allocatedTco2e, 0);
    expect(Math.round(sum)).toBe(900);
    expect(a.skus.every((s) => s.allocationSharePct > 33.2 && s.allocationSharePct < 33.4)).toBe(true);
  });

  it("ignores SKUs reporting zero output rather than dividing by zero", () => {
    const a = buildProductFootprint("FY2025-26", 100, [sku("a", 100), sku("zero", 0)], 100);
    expect(a.skus).toHaveLength(1);
    expect(a.skus[0].allocationSharePct).toBe(100);
  });
});

describe("coverage of the product mix", () => {
  /**
   * The denominator is the SKUs listed, not the facility's total output. If it
   * were total output, entering half the product mix would silently halve
   * every per-unit figure — the numbers would look reasonable and all be
   * wrong. Instead shares always sum over what was listed, and coverage is
   * reported separately.
   */
  it("allocates over listed output and reports coverage separately", () => {
    const a = buildProductFootprint("FY2025-26", 1000, [sku("a", 300), sku("b", 300)], 1200);
    // Shares sum to 100% of the 600 t listed...
    expect(a.skus.reduce((t, s) => t + s.allocationSharePct, 0)).toBe(100);
    // ...and the per-unit figure is not diluted by the unlisted 600 t.
    expect(a.skus[0].perUnitKgCo2e).toBe(round3(1000 * 0.5 * 1000 / 300));
    // Coverage says how much of the facility's output this describes.
    expect(a.productionCoveragePct).toBe(50);
  });

  it("reports full coverage when the SKUs account for all output", () => {
    const a = buildProductFootprint("FY2025-26", 500, [sku("a", 400), sku("b", 600)], 1000);
    expect(a.productionCoveragePct).toBe(100);
  });

  /**
   * Comparing 400 units against 12,000 tonnes would produce a coverage figure
   * that means nothing. Null is the honest answer.
   */
  it("reports no coverage when SKU units differ from the facility's", () => {
    const a = buildProductFootprint("FY2025-26", 500, [sku("a", 400, "units")], 12000, "tonnes");
    expect(a.productionCoveragePct).toBeNull();
    // The allocation itself is still valid — only the comparison is not.
    expect(a.skus[0].allocationSharePct).toBe(100);
  });

  it("reports no coverage when SKUs are in mixed units", () => {
    const a = buildProductFootprint("FY2025-26", 500, [sku("a", 100, "tonnes"), sku("b", 100, "units")], 200, "tonnes");
    expect(a.productionCoveragePct).toBeNull();
  });

  it("reports no coverage when the facility reports no production", () => {
    const a = buildProductFootprint("FY2025-26", 500, [sku("a", 100)], null);
    expect(a.productionCoveragePct).toBeNull();
  });
});

describe("nothing to allocate", () => {
  it("asks for products when none are listed", () => {
    const a = buildProductFootprint("FY2025-26", 1000, [], 1000);
    expect(a.hasData).toBe(false);
    expect(a.unavailableReason).toMatch(/add the products/i);
  });

  it("explains when every product reports zero output", () => {
    const a = buildProductFootprint("FY2025-26", 1000, [sku("a", 0)], 1000);
    expect(a.hasData).toBe(false);
    expect(a.unavailableReason).toMatch(/zero output/i);
  });

  /**
   * Without emissions there is nothing to divide. Reporting zero per unit
   * would read as a carbon-free product rather than as missing activity data.
   */
  it("explains when the facility has no calculated emissions rather than reporting zero", () => {
    const a = buildProductFootprint("FY2025-26", 0, [sku("a", 100)], 100);
    expect(a.hasData).toBe(false);
    expect(a.skus).toEqual([]);
    expect(a.unavailableReason).toMatch(/submit activity data/i);
  });
});

describe("the notice does the work the number cannot", () => {
  it("says it is not a life cycle assessment", () => {
    expect(PRODUCT_FOOTPRINT_NOTICE).toMatch(/not a life cycle assessment/i);
  });

  /**
   * The boundary caveat alone is not enough — a reader could assume the number
   * is simply a gate-to-gate figure and otherwise sound. The allocation
   * assumption is the bigger error source and has to be stated too.
   */
  it("names the volume-allocation assumption and which way it errs", () => {
    expect(PRODUCT_FOOTPRINT_NOTICE).toMatch(/equally emissions-intensive per unit/i);
    expect(PRODUCT_FOOTPRINT_NOTICE).toMatch(/understated/i);
    expect(PRODUCT_FOOTPRINT_NOTICE).toMatch(/overstated/i);
  });

  it("names what the boundary excludes", () => {
    expect(PRODUCT_FOOTPRINT_NOTICE).toMatch(/transport/i);
    expect(PRODUCT_FOOTPRINT_NOTICE).toMatch(/use phase/i);
    expect(PRODUCT_FOOTPRINT_NOTICE).toMatch(/end of life/i);
  });

  it("names the uses it must not be put to", () => {
    expect(PRODUCT_FOOTPRINT_NOTICE).toMatch(/EPD/);
    expect(PRODUCT_FOOTPRINT_NOTICE).toMatch(/CBAM submission/i);
  });
});

function round3(n: number) {
  return Math.round(n * 100) / 100;
}

/**
 * The company-level rollup.
 *
 * Allocation is only defined inside a facility — it divides one site's Scope 1
 * and 2 across that site's output. Every property below exists to stop the
 * rollup quietly becoming an aggregation, which is the one way this view could
 * turn indicative per-site figures into a confident company-wide number that
 * nothing computed.
 */
describe("buildCompanyProductFootprint", () => {
  const alloc = (emissions: number, skus: { id: string; name: string; qty: number }[]) =>
    buildProductFootprint(
      "FY2025-26",
      emissions,
      skus.map((s) => ({ id: s.id, name: s.name, skuCode: null, productionQuantity: s.qty, unit: "tonnes" })),
      null,
      "tonnes",
    );

  const twoSites = () =>
    buildCompanyProductFootprint("FY2025-26", [
      {
        facilityId: "f1",
        facilityName: "Chakan Works",
        allocation: alloc(1000, [{ id: "a", name: "Rebar 12mm", qty: 500 }]),
      },
      {
        facilityId: "f2",
        facilityName: "Pune Works",
        // Same product, half the emissions for the same output — so a merged
        // per-unit figure would be neither site's number.
        allocation: alloc(500, [{ id: "b", name: "Rebar 12mm", qty: 500 }]),
      },
    ]);

  it("keeps the same product at two facilities as two rows, each naming its site", () => {
    const result = twoSites();
    expect(result.rows).toHaveLength(2);
    expect(result.rows.map((r) => r.facilityName).sort()).toEqual(["Chakan Works", "Pune Works"]);
    // Not averaged into a single 1.5 t/t figure.
    expect(result.rows.map((r) => r.perUnitKgCo2e).sort((a, b) => a - b)).toEqual([1000, 2000]);
  });

  it("sums tonnes across sites but never per-unit figures", () => {
    const result = twoSites();
    expect(result.totalAllocatedTco2e).toBe(1500);
    expect(result).not.toHaveProperty("perUnitKgCo2e");
  });

  it("counts sites that produced an allocation, not products", () => {
    const result = twoSites();
    expect(result.facilitiesAllocated).toBe(2);
    expect(result.skuCount).toBe(2);
  });

  /**
   * Shares are computed against each site's own output, so they sum to 100 per
   * site and to 100 * siteCount down the table. The card heads the column
   * "Share of site" for exactly this reason; this pins the arithmetic the
   * label describes.
   */
  it("leaves each row's share relative to its own facility", () => {
    const result = twoSites();
    expect(result.rows.every((r) => r.allocationSharePct === 100)).toBe(true);
  });

  it("reports no data, and no invented reason, when no site has an allocation", () => {
    const result = buildCompanyProductFootprint(null, []);
    expect(result.hasData).toBe(false);
    expect(result.rows).toEqual([]);
    expect(result.totalAllocatedTco2e).toBe(0);
    expect(result.unavailableReason).toBeNull();
  });

  /**
   * One shared reason is worth surfacing; two different ones are not, because
   * there is then no single thing for the reader to go and fix.
   */
  it("passes through a blocker only when every site gives the same one", () => {
    const noSkus = alloc(1000, []);
    const same = buildCompanyProductFootprint("FY2025-26", [
      { facilityId: "f1", facilityName: "A", allocation: noSkus },
      { facilityId: "f2", facilityName: "B", allocation: noSkus },
    ]);
    expect(same.unavailableReason).toBe(noSkus.unavailableReason);
    expect(same.unavailableReason).not.toBeNull();

    const differing = buildCompanyProductFootprint("FY2025-26", [
      { facilityId: "f1", facilityName: "A", allocation: noSkus },
      // Products listed, but no emissions to divide — a different blocker.
      { facilityId: "f2", facilityName: "B", allocation: alloc(0, [{ id: "a", name: "Rebar", qty: 10 }]) },
    ]);
    expect(differing.unavailableReason).toBeNull();
    expect(differing.facilitiesWithSkus).toBe(2);
  });
});
