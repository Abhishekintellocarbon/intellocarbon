import { describe, expect, it } from "vitest";
import type { WaterEntry } from "@prisma/client";
import { buildWaterFootprint, rollUpWaterFootprints } from "../waterCalculation.service";

/**
 * ISO 14046 water footprint arithmetic. Expected values are computed by hand
 * from the definitions, not read back from the implementation:
 *   consumption = withdrawal - discharge
 *   freshwater withdrawal = SUM(withdrawal x freshwaterFactor), recycled = 0
 *   intensity = consumption / production tonnes
 */

const entry = (over: Partial<WaterEntry> & Pick<WaterEntry, "sourceType" | "withdrawnM3">): WaterEntry => ({
  id: `we-${over.sourceType}-${over.withdrawnM3}`,
  activityDataId: "ad-1",
  dischargedM3: 0,
  freshwaterFactorOverride: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  ...over,
} as WaterEntry);

describe("buildWaterFootprint", () => {
  it("returns an empty, flagged-as-absent footprint when there are no entries", () => {
    const result = buildWaterFootprint([], 1000);
    expect(result.hasData).toBe(false);
    expect(result.totalWithdrawnM3).toBe(0);
    expect(result.waterIntensityM3PerTonne).toBeNull();
  });

  it("derives consumption as withdrawal minus discharge", () => {
    const result = buildWaterFootprint(
      [entry({ sourceType: "GROUNDWATER", withdrawnM3: 10_000, dischargedM3: 4_000 })],
      null,
    );
    expect(result.totalWithdrawnM3).toBe(10_000);
    expect(result.totalDischargedM3).toBe(4_000);
    expect(result.totalConsumedM3).toBe(6_000);
  });

  it("excludes recycled water from freshwater withdrawal but keeps it in the total", () => {
    const result = buildWaterFootprint(
      [
        entry({ sourceType: "MUNICIPAL", withdrawnM3: 6_000 }),
        entry({ sourceType: "RECYCLED", withdrawnM3: 4_000 }),
      ],
      null,
    );
    expect(result.totalWithdrawnM3).toBe(10_000);
    // Only the municipal 6,000 draws on the catchment.
    expect(result.freshwaterWithdrawnM3).toBe(6_000);
    expect(result.recycledSharePct).toBe(40);
  });

  it("applies a per-line freshwater factor override", () => {
    // A municipal supply that is itself 25% reclaimed: 8,000 x 0.75 = 6,000.
    const result = buildWaterFootprint(
      [entry({ sourceType: "MUNICIPAL", withdrawnM3: 8_000, freshwaterFactorOverride: 0.75 })],
      null,
    );
    expect(result.freshwaterWithdrawnM3).toBe(6_000);
    expect(result.sources[0].freshwaterFactorApplied).toBe(0.75);
  });

  it("computes intensity per tonne against the GHG production quantity", () => {
    // 6,000 consumed / 1,500 t = 4 m3/t; withdrawal 10,000 / 1,500 = 6.667.
    const result = buildWaterFootprint(
      [entry({ sourceType: "SURFACE_WATER", withdrawnM3: 10_000, dischargedM3: 4_000 })],
      1_500,
    );
    expect(result.waterIntensityM3PerTonne).toBe(4);
    expect(result.withdrawalIntensityM3PerTonne).toBe(6.667);
  });

  it("returns null intensity rather than 0 when production is missing or zero", () => {
    const noProduction = buildWaterFootprint([entry({ sourceType: "MUNICIPAL", withdrawnM3: 100 })], null);
    const zeroProduction = buildWaterFootprint([entry({ sourceType: "MUNICIPAL", withdrawnM3: 100 })], 0);
    expect(noProduction.waterIntensityM3PerTonne).toBeNull();
    expect(zeroProduction.waterIntensityM3PerTonne).toBeNull();
  });

  it("aggregates repeated sources into one breakdown row, ordered by withdrawal", () => {
    const result = buildWaterFootprint(
      [
        entry({ sourceType: "GROUNDWATER", withdrawnM3: 1_000 }),
        entry({ sourceType: "GROUNDWATER", withdrawnM3: 2_000 }),
        entry({ sourceType: "MUNICIPAL", withdrawnM3: 5_000 }),
      ],
      null,
    );
    expect(result.sources).toHaveLength(2);
    expect(result.sources[0].sourceType).toBe("MUNICIPAL");
    expect(result.sources[1].sourceType).toBe("GROUNDWATER");
    expect(result.sources[1].withdrawnM3).toBe(3_000);
    expect(result.sources[0].pctOfWithdrawal).toBe(62.5);
  });

  it("flags — and never reports negative consumption for — discharge above withdrawal", () => {
    const result = buildWaterFootprint(
      [entry({ sourceType: "MUNICIPAL", withdrawnM3: 1_000, dischargedM3: 1_500 })],
      null,
    );
    expect(result.hasDischargeExceedingWithdrawal).toBe(true);
    expect(result.totalConsumedM3).toBe(0);
  });
});

describe("rollUpWaterFootprints", () => {
  it("ignores periods with no water inventory, including in the intensity denominator", () => {
    const result = rollUpWaterFootprints([
      {
        facilityId: "f1",
        productionQuantityT: 1_000,
        waterEntries: [entry({ sourceType: "MUNICIPAL", withdrawnM3: 5_000, dischargedM3: 1_000 })],
      },
      // No water entries — its 9,000 t must not dilute the intensity.
      { facilityId: "f2", productionQuantityT: 9_000, waterEntries: [] },
    ]);

    expect(result.entriesWithWater).toBe(1);
    expect(result.facilitiesReporting).toBe(1);
    // 4,000 consumed / 1,000 t, not / 10,000 t.
    expect(result.waterIntensityM3PerTonne).toBe(4);
  });

  it("blends intensity on summed totals rather than averaging per-entry ratios", () => {
    // Facility A: 100 consumed / 10 t = 10 m3/t. Facility B: 900 / 990 t.
    // Unweighted mean would be ~5.45; the correct blend is 1,000/1,000 = 1.
    const result = rollUpWaterFootprints([
      {
        facilityId: "a",
        productionQuantityT: 10,
        waterEntries: [entry({ sourceType: "MUNICIPAL", withdrawnM3: 100 })],
      },
      {
        facilityId: "b",
        productionQuantityT: 990,
        waterEntries: [entry({ sourceType: "GROUNDWATER", withdrawnM3: 900 })],
      },
    ]);

    expect(result.waterIntensityM3PerTonne).toBe(1);
    expect(result.facilitiesReporting).toBe(2);
  });

  it("is empty when no period reported water", () => {
    const result = rollUpWaterFootprints([{ facilityId: "f1", productionQuantityT: 500, waterEntries: [] }]);
    expect(result.hasData).toBe(false);
    expect(result.entriesWithWater).toBe(0);
  });
});
