import { describe, it, expect } from "vitest";
import {
  buildIntensityBenchmark,
  buildBenchmarkSet,
  BENCHMARK_NOTICE,
  MIN_BENCHMARK_SAMPLE,
  UNSOURCED_METRICS,
  type NotifiedEntity,
} from "../sectorBenchmark.service";

/**
 * The failure this module exists to prevent is a fabricated benchmark. A
 * customer who sees "sector average 1.8" beside their own 2.1 will act on it,
 * and a plausible-looking number is indistinguishable on screen from a real
 * one.
 *
 * So the no-data path is tested at least as hard as the happy path: every
 * unavailable status must produce a stated reason and a null value, and no
 * benchmark value may ever appear without a citation beside it.
 */

const entity = (over: Partial<NotifiedEntity> = {}): NotifiedEntity => ({
  sector: "Iron & Steel",
  baselineIntensity: 2.0,
  status: "FINAL",
  ...over,
});

describe("the no-data path", () => {
  it("reports not available when no entity in the sector has a notified intensity", () => {
    const b = buildIntensityBenchmark("Iron & Steel", 2.1, []);
    expect(b.status).toBe("NO_SECTOR_DATA");
    expect(b.benchmarkValue).toBeNull();
    expect(b.unavailableReason).toMatch(/Benchmark not available for this sector/);
    expect(b.comparison).toBeNull();
    expect(b.differencePct).toBeNull();
  });

  it("reports not available when the sector has entities but none carry an intensity", () => {
    const b = buildIntensityBenchmark("Cement", 0.9, [
      entity({ sector: "Cement", baselineIntensity: null }),
      entity({ sector: "Cement", baselineIntensity: null }),
      entity({ sector: "Cement", baselineIntensity: null }),
    ]);
    expect(b.status).toBe("NO_SECTOR_DATA");
    expect(b.benchmarkValue).toBeNull();
  });

  it("does not borrow another sector's benchmark", () => {
    const b = buildIntensityBenchmark("Cement", 0.9, [
      entity({ sector: "Iron & Steel" }),
      entity({ sector: "Iron & Steel" }),
      entity({ sector: "Iron & Steel" }),
    ]);
    expect(b.status).toBe("NO_SECTOR_DATA");
    expect(b.benchmarkValue).toBeNull();
  });

  /**
   * A DRAFT notification is still open for comment and its numbers may move.
   * Benchmarking a real position against a provisional figure would present
   * an unsettled number as settled.
   */
  it("ignores draft notifications entirely", () => {
    const b = buildIntensityBenchmark("Iron & Steel", 2.1, [
      entity({ status: "DRAFT" }),
      entity({ status: "DRAFT" }),
      entity({ status: "DRAFT" }),
      entity({ status: "DRAFT" }),
    ]);
    expect(b.status).toBe("NO_SECTOR_DATA");
  });

  /**
   * Two entities is not a sector. Publishing it would both mislead and
   * disclose those specific companies' notified positions to a competitor.
   */
  it("refuses to publish a benchmark below the minimum sample size", () => {
    const b = buildIntensityBenchmark("Iron & Steel", 2.1, [entity(), entity()]);
    expect(b.status).toBe("SAMPLE_TOO_SMALL");
    expect(b.benchmarkValue).toBeNull();
    expect(b.sampleSize).toBe(2);
    expect(b.unavailableReason).toMatch(/too few/i);
    expect(MIN_BENCHMARK_SAMPLE).toBe(3);
  });

  it("never returns a value without a reason when unavailable", () => {
    const cases = [
      buildIntensityBenchmark("Steel", 2, []),
      buildIntensityBenchmark("Steel", 2, [entity({ sector: "Steel" })]),
      buildIntensityBenchmark("Steel", null, [
        entity({ sector: "Steel" }),
        entity({ sector: "Steel" }),
        entity({ sector: "Steel" }),
      ]),
    ];
    for (const c of cases) {
      expect(c.status).not.toBe("AVAILABLE");
      expect(c.unavailableReason).toBeTruthy();
      expect(c.comparison).toBeNull();
    }
  });
});

describe("a value never appears without its citation", () => {
  /**
   * The invariant that makes the whole module checkable: if there is a number,
   * there is a source string next to it saying where it came from.
   */
  it("pairs every benchmark value with a source", () => {
    const withData = buildIntensityBenchmark("Iron & Steel", 2.1, [entity(), entity(), entity()]);
    expect(withData.benchmarkValue).not.toBeNull();
    expect(withData.source).toBeTruthy();

    const withoutData = buildIntensityBenchmark("Iron & Steel", 2.1, []);
    expect(withoutData.benchmarkValue).toBeNull();
    expect(withoutData.source).toBeNull();
  });

  it("names the sample size and the gazette basis in the source", () => {
    const b = buildIntensityBenchmark("Iron & Steel", 2.1, [entity(), entity(), entity()]);
    expect(b.source).toMatch(/3 BEE-notified/);
    expect(b.source).toMatch(/gazetted/i);
  });
});

describe("the comparison itself", () => {
  const three = [entity({ baselineIntensity: 1.8 }), entity({ baselineIntensity: 2.0 }), entity({ baselineIntensity: 2.2 })];

  it("uses the median rather than the mean", () => {
    // A single very high outlier must not move the benchmark.
    const withOutlier = [...three, entity({ baselineIntensity: 20 }), entity({ baselineIntensity: 2.1 })];
    const b = buildIntensityBenchmark("Iron & Steel", 2.0, withOutlier);
    expect(b.benchmarkValue).toBe(2.1);
  });

  it("reports better when meaningfully below the benchmark", () => {
    const b = buildIntensityBenchmark("Iron & Steel", 1.5, three);
    expect(b.benchmarkValue).toBe(2);
    expect(b.comparison).toBe("BETTER");
    expect(b.differencePct).toBe(-25);
  });

  it("reports worse when meaningfully above", () => {
    const b = buildIntensityBenchmark("Iron & Steel", 2.6, three);
    expect(b.comparison).toBe("WORSE");
    expect(b.differencePct).toBe(30);
  });

  /**
   * Notified baselines are not precise enough to make a 2% gap meaningful.
   * Calling that "better" would invite a claim the data cannot carry.
   */
  it("reports similar within the tolerance band rather than overstating a small gap", () => {
    expect(buildIntensityBenchmark("Iron & Steel", 2.04, three).comparison).toBe("SIMILAR");
    expect(buildIntensityBenchmark("Iron & Steel", 1.96, three).comparison).toBe("SIMILAR");
  });

  it("asks for activity data rather than comparing when the company has no intensity", () => {
    const b = buildIntensityBenchmark("Iron & Steel", null, three);
    expect(b.status).toBe("NO_COMPANY_VALUE");
    expect(b.benchmarkValue).toBe(2);
    expect(b.comparison).toBeNull();
    expect(b.unavailableReason).toMatch(/production quantities/i);
  });

  it("treats a zero company intensity as no value rather than a perfect score", () => {
    expect(buildIntensityBenchmark("Iron & Steel", 0, three).status).toBe("NO_COMPANY_VALUE");
  });
});

describe("metrics with no public source are declared, not hidden", () => {
  /**
   * A missing card reads as "not built yet". A card saying no public benchmark
   * exists tells the user something true and stops the question recurring.
   */
  it("lists water and waste intensity as unsourced, each with a reason", () => {
    expect(UNSOURCED_METRICS.map((m) => m.metricKey)).toEqual(["waterIntensity", "wasteIntensity"]);
    expect(UNSOURCED_METRICS.every((m) => m.why.length > 40)).toBe(true);
  });

  it("includes them in the set alongside the sourced benchmark", () => {
    const set = buildBenchmarkSet("Iron & Steel", 2.1, [entity(), entity(), entity()]);
    expect(set.benchmarks).toHaveLength(1);
    expect(set.unsourced).toHaveLength(2);
    expect(set.notice).toBe(BENCHMARK_NOTICE);
  });

  it("states why an unciteable number is worse than none", () => {
    expect(BENCHMARK_NOTICE).toMatch(/only where a real public figure exists/i);
    expect(BENCHMARK_NOTICE).toMatch(/worse than no number/i);
  });
});
