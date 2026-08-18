import { describe, it, expect } from "vitest";
import {
  buildNetZeroTrajectory,
  selectTrajectoryTarget,
  TRAJECTORY_NOTICE,
} from "../netZeroTrajectory.service";
import type { CompanyTarget } from "@prisma/client";

/**
 * The chart's one hard rule: the target path may extend forward, the actual
 * series may not. Continuing the actual line past the last submitted year —
 * by trend, by assumption, by anything — turns a record into a forecast, and
 * two converging lines read as a verdict on whether the target will be met.
 */

const target = (over: Partial<CompanyTarget> = {}): CompanyTarget =>
  ({
    id: Math.random().toString(36).slice(2),
    companyId: "c1",
    kind: "ABSOLUTE",
    scopesCovered: "Scope 1+2",
    baselineYear: 2020,
    baselineEmissionsTco2e: 1000,
    targetYear: 2030,
    reductionPct: 50,
    intensityMetric: null,
    baselineIntensity: null,
    targetIntensity: null,
    isNetZero: false,
    sbtiStatus: "NOT_SUBMITTED",
    description: null,
    status: "SUBMITTED",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  }) as CompanyTarget;

describe("actuals are never projected forward", () => {
  /**
   * The load-bearing test. Every year after the last submitted one must carry
   * a null actual, however tempting a continuation would look.
   */
  it("leaves every year after the last submitted one null", () => {
    const t = buildNetZeroTrajectory([target()], [
      { year: 2020, totalTco2e: 1000 },
      { year: 2022, totalTco2e: 880 },
    ]);
    const future = t.points.filter((p) => p.year > 2022);
    expect(future.length).toBeGreaterThan(0);
    expect(future.every((p) => p.actualTco2e === null)).toBe(true);
    expect(t.latestActualYear).toBe(2022);
  });

  it("leaves gaps between reported years null rather than interpolating", () => {
    const t = buildNetZeroTrajectory([target()], [
      { year: 2020, totalTco2e: 1000 },
      { year: 2023, totalTco2e: 850 },
    ]);
    expect(t.points.find((p) => p.year === 2021)?.actualTco2e).toBeNull();
    expect(t.points.find((p) => p.year === 2022)?.actualTco2e).toBeNull();
    expect(t.points.find((p) => p.year === 2023)?.actualTco2e).toBe(850);
  });

  it("plots the path across the full span even with no actuals at all", () => {
    const t = buildNetZeroTrajectory([target()], []);
    expect(t.hasData).toBe(true);
    expect(t.points.every((p) => p.actualTco2e === null)).toBe(true);
    expect(t.points.find((p) => p.year === 2030)?.pathTco2e).toBe(500);
    expect(t.latestActualYear).toBeNull();
  });
});

describe("the path", () => {
  it("runs straight from baseline to target level", () => {
    const t = buildNetZeroTrajectory([target()], []);
    expect(t.points.find((p) => p.year === 2020)?.pathTco2e).toBe(1000);
    expect(t.points.find((p) => p.year === 2025)?.pathTco2e).toBe(750);
    expect(t.points.find((p) => p.year === 2030)?.pathTco2e).toBe(500);
  });

  it("spans baseline through target year inclusive", () => {
    const t = buildNetZeroTrajectory([target()], []);
    expect(t.points[0].year).toBe(2020);
    expect(t.points.at(-1)?.year).toBe(2030);
    expect(t.points).toHaveLength(11);
  });

  /**
   * Submitted data outside the target window must still appear — hiding a
   * reported year because it predates the baseline would drop real data from
   * the customer's own chart.
   */
  it("extends the range to cover actuals outside the target window", () => {
    const t = buildNetZeroTrajectory([target()], [
      { year: 2018, totalTco2e: 1100 },
      { year: 2032, totalTco2e: 400 },
    ]);
    expect(t.points[0].year).toBe(2018);
    expect(t.points.at(-1)?.year).toBe(2032);
    // Outside the target's own span the path has no value to state.
    expect(t.points.find((p) => p.year === 2018)?.pathTco2e).toBeNull();
    expect(t.points.find((p) => p.year === 2018)?.actualTco2e).toBe(1100);
  });

  it("holds the path at the target level beyond the target year", () => {
    const t = buildNetZeroTrajectory([target()], [{ year: 2032, totalTco2e: 400 }]);
    expect(t.points.find((p) => p.year === 2032)?.pathTco2e).toBe(500);
  });
});

describe("choosing which target to plot", () => {
  /**
   * Furthest rather than nearest, unlike the progress tracker: a trajectory is
   * about the long arc, and plotting a 2030 interim when a 2050 net-zero
   * commitment exists would cut the picture short.
   */
  it("prefers a net-zero commitment over a nearer interim target", () => {
    const chosen = selectTrajectoryTarget([
      target({ targetYear: 2030, reductionPct: 42 }),
      target({ targetYear: 2050, reductionPct: 100, isNetZero: true }),
    ]);
    expect(chosen?.targetYear).toBe(2050);
    expect(chosen?.isNetZero).toBe(true);
  });

  it("takes the furthest target when none is net zero", () => {
    const chosen = selectTrajectoryTarget([target({ targetYear: 2030 }), target({ targetYear: 2040 })]);
    expect(chosen?.targetYear).toBe(2040);
  });

  it("ignores drafts, intensity targets and targets with no reduction percentage", () => {
    expect(selectTrajectoryTarget([target({ status: "DRAFT" })])).toBeNull();
    expect(selectTrajectoryTarget([target({ kind: "INTENSITY", intensityMetric: "t/t" })])).toBeNull();
    expect(selectTrajectoryTarget([target({ reductionPct: null })])).toBeNull();
    expect(selectTrajectoryTarget([target({ baselineEmissionsTco2e: 0 })])).toBeNull();
  });

  it("labels a net-zero target differently from a percentage one", () => {
    expect(buildNetZeroTrajectory([target({ isNetZero: true, targetYear: 2050, reductionPct: 100 })], []).targetLabel).toBe(
      "Net zero by 2050",
    );
    expect(buildNetZeroTrajectory([target()], []).targetLabel).toBe("50% reduction by 2030");
  });
});

describe("nothing to plot", () => {
  it("explains that no target is set", () => {
    const t = buildNetZeroTrajectory([], [{ year: 2025, totalTco2e: 900 }]);
    expect(t.hasData).toBe(false);
    expect(t.unavailableReason).toMatch(/set a reduction target/i);
  });

  /**
   * A different message when targets exist but none can be plotted — "set a
   * target" would be wrong and confusing for someone who already has.
   */
  it("distinguishes having no target from having an unplottable one", () => {
    const t = buildNetZeroTrajectory([target({ kind: "INTENSITY", intensityMetric: "t/t" })], []);
    expect(t.hasData).toBe(false);
    expect(t.unavailableReason).toMatch(/none of your targets can be plotted/i);
  });
});

describe("the notice", () => {
  it("states the path is a commitment and the actuals are not projected", () => {
    expect(TRAJECTORY_NOTICE).toMatch(/what you have committed to/i);
    expect(TRAJECTORY_NOTICE).toMatch(/not projected forward/i);
  });

  it("states it is not a forecast of whether the target will be met", () => {
    expect(TRAJECTORY_NOTICE).toMatch(/not a forecast/i);
  });
});
