import { describe, it, expect } from "vitest";
import {
  buildEnergyMixTrend,
  ENERGY_MIX_SOURCE_NOTES,
  type ActivityEnergyRow,
  type BrsrEnergyRow,
} from "../energyMix.service";

/**
 * The renewable share is only interpretable against its denominator. BRSR
 * Core covers total energy including on-site fuel; activity data covers
 * purchased electricity and steam only, which for an industrial facility
 * excludes the larger number. A share on the second basis is systematically
 * higher for the same company in the same year.
 *
 * So these tests protect the same properties as the circularity ones: which
 * source won, that the two are never mixed within a trend, and that a
 * narrower basis is labelled as such.
 */

const brsr = (reportingPeriod: string, renewable: number | null, nonRenewable: number | null): BrsrEnergyRow => ({
  reportingPeriod,
  renewableEnergyConsumptionGj: renewable,
  nonRenewableEnergyConsumptionGj: nonRenewable,
});

const activity = (
  periodStart: Date | null,
  gridElectricityMwh: number,
  renewableElectricityMwh: number,
  steamImportedGj = 0,
): ActivityEnergyRow => ({ periodStart, gridElectricityMwh, renewableElectricityMwh, steamImportedGj });

describe("BRSR source", () => {
  it("builds a trend ordered by period with a renewable share per point", () => {
    const t = buildEnergyMixTrend([brsr("FY2024-25", 100, 900), brsr("FY2025-26", 300, 700)], []);
    expect(t.source).toBe("BRSR_CORE");
    expect(t.electricityOnly).toBe(false);
    expect(t.points.map((p) => p.periodLabel)).toEqual(["FY2024-25", "FY2025-26"]);
    expect(t.points.map((p) => p.renewablePct)).toEqual([10, 30]);
  });

  it("sums every facility within a period", () => {
    const t = buildEnergyMixTrend([brsr("FY2025-26", 100, 100), brsr("FY2025-26", 100, 700)], []);
    expect(t.points).toHaveLength(1);
    expect(t.points[0].totalGj).toBe(1000);
    expect(t.points[0].renewablePct).toBe(20);
  });

  /**
   * One half of the split gives a share of an unknown total. Counting a row
   * with a renewable figure but no non-renewable figure would report 100%
   * renewable.
   */
  it("ignores rows carrying only one half of the split", () => {
    const t = buildEnergyMixTrend([brsr("FY2025-26", 500, null), brsr("FY2025-26", null, 500)], []);
    expect(t.hasData).toBe(false);
  });

  it("reports the change in percentage points against the previous period", () => {
    const t = buildEnergyMixTrend([brsr("FY2024-25", 100, 900), brsr("FY2025-26", 250, 750)], []);
    expect(t.latestRenewablePct).toBe(25);
    expect(t.changePoints).toBe(15);
  });

  it("has no change figure with a single period", () => {
    const t = buildEnergyMixTrend([brsr("FY2025-26", 100, 900)], []);
    expect(t.latestRenewablePct).toBe(10);
    expect(t.changePoints).toBeNull();
  });
});

describe("activity-data fallback", () => {
  it("falls back when no BRSR split exists, and flags the narrower basis", () => {
    // 100 MWh renewable, 300 MWh grid -> 360 GJ vs 1080 GJ -> 25%
    const t = buildEnergyMixTrend([], [activity(new Date(Date.UTC(2025, 5, 1)), 300, 100)]);
    expect(t.source).toBe("ACTIVITY_DATA");
    expect(t.electricityOnly).toBe(true);
    expect(t.points[0].renewablePct).toBe(25);
    expect(t.points[0].totalGj).toBe(1440);
  });

  it("converts MWh to GJ at 3.6 and counts imported steam as non-renewable", () => {
    const t = buildEnergyMixTrend([], [activity(new Date(Date.UTC(2025, 5, 1)), 0, 10, 36)]);
    // 10 MWh renewable = 36 GJ; steam 36 GJ non-renewable -> 50%
    expect(t.points[0].renewableGj).toBe(36);
    expect(t.points[0].nonRenewableGj).toBe(36);
    expect(t.points[0].renewablePct).toBe(50);
  });

  it("groups activity rows into financial years", () => {
    const t = buildEnergyMixTrend(
      [],
      [
        activity(new Date(Date.UTC(2024, 5, 1)), 100, 0), // FY2024-25
        activity(new Date(Date.UTC(2025, 1, 1)), 100, 0), // Feb 2025 -> still FY2024-25
        activity(new Date(Date.UTC(2025, 5, 1)), 0, 100), // FY2025-26
      ],
    );
    expect(t.points.map((p) => p.periodLabel)).toEqual(["FY2024-25", "FY2025-26"]);
    expect(t.points.map((p) => p.renewablePct)).toEqual([0, 100]);
  });

  it("skips activity rows with no period start", () => {
    const t = buildEnergyMixTrend([], [activity(null, 100, 100)]);
    expect(t.hasData).toBe(false);
  });

  /**
   * Grid electricity carries no contractual renewable attribute here. Treating
   * any of it as renewable would be a claim on the company's behalf that only
   * a certificate can support — which is what the REC ledger is for.
   */
  it("treats grid electricity as non-renewable", () => {
    const t = buildEnergyMixTrend([], [activity(new Date(Date.UTC(2025, 5, 1)), 1000, 0)]);
    expect(t.points[0].renewablePct).toBe(0);
    expect(t.hasData).toBe(true);
  });
});

describe("the two sources are never mixed", () => {
  /**
   * The load-bearing property. A trend that switched basis partway would bend
   * because the denominator changed, not because anything happened at the
   * company — and it would bend upward, which is the flattering direction.
   */
  it("uses BRSR for every point when BRSR data exists at all, ignoring activity data", () => {
    const t = buildEnergyMixTrend(
      [brsr("FY2025-26", 100, 900)],
      [activity(new Date(Date.UTC(2024, 5, 1)), 0, 500)],
    );
    expect(t.source).toBe("BRSR_CORE");
    expect(t.points).toHaveLength(1);
    expect(t.points[0].periodLabel).toBe("FY2025-26");
    expect(t.electricityOnly).toBe(false);
  });

  it("never emits points from both sources in one trend", () => {
    const t = buildEnergyMixTrend(
      [brsr("FY2024-25", 100, 900), brsr("FY2025-26", 200, 800)],
      [activity(new Date(Date.UTC(2023, 5, 1)), 100, 100)],
    );
    expect(t.points).toHaveLength(2);
    expect(t.points.every((p) => p.periodLabel.startsWith("FY202"))).toBe(true);
    expect(t.points.some((p) => p.periodLabel === "FY2023-24")).toBe(false);
  });
});

describe("no data and zero-total periods", () => {
  it("reports no data rather than a zero share when nothing is reported", () => {
    const t = buildEnergyMixTrend([], []);
    expect(t.hasData).toBe(false);
    expect(t.latestRenewablePct).toBeNull();
    expect(t.points).toEqual([]);
  });

  /**
   * A zero-energy period would otherwise plot at 0%, reading as renewables
   * having been switched off rather than as a period with no energy reported.
   */
  it("drops periods whose energy total is zero rather than plotting them at 0%", () => {
    const t = buildEnergyMixTrend([brsr("FY2024-25", 0, 0), brsr("FY2025-26", 100, 900)], []);
    expect(t.points.map((p) => p.periodLabel)).toEqual(["FY2025-26"]);
    expect(t.changePoints).toBeNull();
  });
});

describe("the source note travels with the share", () => {
  it("says BRSR covers total energy including on-site fuel", () => {
    expect(ENERGY_MIX_SOURCE_NOTES.BRSR_CORE).toMatch(/on-site fuel combustion/i);
  });

  /**
   * The activity-data note must say what is missing and that it is usually the
   * larger share — otherwise a reader has no way to judge how flattering the
   * number is.
   */
  it("names what the activity-data basis excludes and that it is usually larger", () => {
    expect(ENERGY_MIX_SOURCE_NOTES.ACTIVITY_DATA).toMatch(/diesel, furnace oil, natural gas/i);
    expect(ENERGY_MIX_SOURCE_NOTES.ACTIVITY_DATA).toMatch(/larger share/i);
  });
});
