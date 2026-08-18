import { describe, it, expect } from "vitest";
import { buildRecCoverage, REC_TRACKING_NOTICE, type ActivityElectricityRow, type RecRow } from "../recCoverage.service";

/**
 * A coverage percentage is a claim: "this share of our grid electricity is
 * backed by renewable certificates". Three ways to inflate it exist, and each
 * is guarded here — counting certificates against a year their vintage does
 * not match, measuring against total electricity so already-renewable supply
 * pads the denominator, and hiding over-procurement behind a 100% cap.
 */

const rec = (vintageYear: number, quantityMwh: number): RecRow => ({ vintageYear, quantityMwh });

const activity = (year: number, grid: number, direct = 0): ActivityElectricityRow => ({
  // June of the given year — comfortably inside that April-March financial year.
  periodStart: new Date(Date.UTC(year, 5, 1)),
  gridElectricityMwh: grid,
  renewableElectricityMwh: direct,
});

describe("coverage against grid electricity", () => {
  it("computes coverage as matched certificates over grid draw", () => {
    const c = buildRecCoverage([rec(2025, 400)], [activity(2025, 1000)]);
    expect(c.latest?.coveragePct).toBe(40);
    expect(c.latest?.gridElectricityMwh).toBe(1000);
    expect(c.latest?.recsMatchedMwh).toBe(400);
  });

  /**
   * The load-bearing exclusion. Electricity already reported as renewable
   * carries its attribute; including it in the denominator would let
   * on-site solar make the certificate coverage look better than it is, and
   * applying certificates to it would claim the same MWh twice.
   */
  it("excludes already-renewable electricity from the denominator", () => {
    const c = buildRecCoverage([rec(2025, 500)], [activity(2025, 500, 500)]);
    expect(c.latest?.gridElectricityMwh).toBe(500);
    expect(c.latest?.directRenewableMwh).toBe(500);
    expect(c.latest?.totalElectricityMwh).toBe(1000);
    // 500 certificates against 500 MWh of grid draw is full coverage — not 50%.
    expect(c.latest?.coveragePct).toBe(100);
  });

  /**
   * A facility running entirely on its own renewable generation needs no
   * certificates. Reporting 0% would read as a procurement failure.
   */
  it("reports null rather than 0% when there is no grid draw at all", () => {
    const c = buildRecCoverage([], [activity(2025, 0, 800)]);
    expect(c.latest?.coveragePct).toBeNull();
    expect(c.latest?.overCovered).toBe(false);
  });

  it("sums grid and direct across facilities within a year", () => {
    const c = buildRecCoverage([rec(2025, 300)], [activity(2025, 400), activity(2025, 200, 100)]);
    expect(c.latest?.gridElectricityMwh).toBe(600);
    expect(c.latest?.directRenewableMwh).toBe(100);
    expect(c.latest?.coveragePct).toBe(50);
  });
});

describe("vintage matching", () => {
  /**
   * Summing every certificate ever bought against one year's consumption is
   * the easiest way to report coverage a company cannot support.
   */
  it("counts only certificates whose vintage matches the consumption year", () => {
    const c = buildRecCoverage([rec(2023, 900), rec(2025, 100)], [activity(2025, 1000)]);
    expect(c.latest?.recsMatchedMwh).toBe(100);
    expect(c.latest?.coveragePct).toBe(10);
  });

  it("matches each year independently across a multi-year ledger", () => {
    const c = buildRecCoverage(
      [rec(2024, 500), rec(2025, 250)],
      [activity(2024, 1000), activity(2025, 1000)],
    );
    expect(c.periods.map((p) => p.coveragePct)).toEqual([50, 25]);
  });

  /**
   * Certificates for a year with no reported consumption are not necessarily
   * wrong — but they cannot support a claim here, so they are surfaced rather
   * than absorbed into a total.
   */
  it("reports certificates matching no consumption year as unmatched", () => {
    const c = buildRecCoverage([rec(2019, 700), rec(2025, 100)], [activity(2025, 1000)]);
    expect(c.unmatchedRecs).toEqual([{ vintageYear: 2019, quantityMwh: 700 }]);
    expect(c.unmatchedMwh).toBe(700);
    // The unmatched block is still counted in the ledger total the user sees.
    expect(c.totalRecsMwh).toBe(800);
  });

  it("never lets unmatched certificates raise any period's coverage", () => {
    const c = buildRecCoverage([rec(2019, 5000)], [activity(2025, 1000)]);
    expect(c.latest?.coveragePct).toBe(0);
    expect(c.unmatchedMwh).toBe(5000);
  });
});

describe("over-procurement is surfaced, not hidden", () => {
  /**
   * Holding more certificates than grid draw is real — over-procurement, or
   * certificates bought against a facility not reporting here. Capping at 100%
   * would hide the other reading, which is double counting.
   */
  it("reports coverage above 100% and flags it", () => {
    const c = buildRecCoverage([rec(2025, 1500)], [activity(2025, 1000)]);
    expect(c.latest?.coveragePct).toBe(150);
    expect(c.latest?.overCovered).toBe(true);
  });

  it("does not flag exact coverage as over-covered", () => {
    const c = buildRecCoverage([rec(2025, 1000)], [activity(2025, 1000)]);
    expect(c.latest?.coveragePct).toBe(100);
    expect(c.latest?.overCovered).toBe(false);
  });
});

describe("empty and partial states", () => {
  it("reports no data when there are neither certificates nor electricity", () => {
    const c = buildRecCoverage([], []);
    expect(c.hasData).toBe(false);
    expect(c.latest).toBeNull();
  });

  it("still reports periods when electricity exists but no certificates do", () => {
    const c = buildRecCoverage([], [activity(2025, 1000)]);
    expect(c.hasData).toBe(true);
    expect(c.latest?.coveragePct).toBe(0);
    expect(c.totalRecsMwh).toBe(0);
  });

  it("reports certificates held even with no electricity reported at all", () => {
    const c = buildRecCoverage([rec(2025, 300)], []);
    expect(c.hasData).toBe(true);
    expect(c.periods).toEqual([]);
    expect(c.unmatchedMwh).toBe(300);
  });

  it("skips activity rows with no period start", () => {
    const c = buildRecCoverage(
      [rec(2025, 100)],
      [{ periodStart: null, gridElectricityMwh: 999, renewableElectricityMwh: 0 }],
    );
    expect(c.periods).toEqual([]);
  });

  it("orders periods chronologically and takes the last as latest", () => {
    const c = buildRecCoverage([], [activity(2025, 10), activity(2023, 10), activity(2024, 10)]);
    expect(c.periods.map((p) => p.year)).toEqual([2023, 2024, 2025]);
    expect(c.latest?.year).toBe(2025);
  });
});

describe("the tracking notice", () => {
  it("disclaims verification and states the denominator", () => {
    expect(REC_TRACKING_NOTICE).toMatch(/does not verify/i);
    expect(REC_TRACKING_NOTICE).toMatch(/grid electricity only/i);
  });
});
