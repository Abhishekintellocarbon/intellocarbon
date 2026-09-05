import { describe, it, expect } from "vitest";
import { SOURCE_META, sourceBadgeLabel, isProjectedSource } from "../source-meta";
import {
  METRIC_UNIT_SUFFIX,
  cctsPositionLabel,
  changeTone,
  formatAtPrecision,
  formatChange,
  formatProjected,
} from "../pathway-display";
import type { PathwayMetric, RecommendationInputSource } from "../types";

/**
 * The UI's half of the Pathway Modelling contract.
 *
 * The server refuses to emit false precision and refuses to emit a projection
 * without saying what it was projected from. These tests pin the other end of
 * that: the display layer must not undo either guarantee by rounding a range to
 * a headline figure, printing more digits than it was given, or rendering a
 * projected figure so that it reads like a measured one.
 */

const ALL_SOURCES: RecommendationInputSource[] = [
  "PLATFORM_CALCULATION",
  "BILL_EXTRACTION",
  "PUBLISHED_BENCHMARK",
  "FACILITY_PROFILE",
  "PROJECTED",
];

const metric = (over: Partial<PathwayMetric> = {}): PathwayMetric => ({
  metric: "TOTAL_EMISSIONS_TCO2E",
  label: "Total emissions",
  unit: "tCO2e",
  current: 20_000,
  currentSource: "PLATFORM_CALCULATION",
  projected: { low: 18_772.6, high: 19_530.1, isPoint: false, decimals: 1, basis: "x" },
  projectedFrom: "your solar recommendation's sizing",
  changeLow: -1_227.4,
  changeHigh: -469.9,
  lowerIsBetter: true,
  unavailableReason: null,
  inputs: [],
  citations: [],
  caveats: [],
  ...over,
});

describe("provenance badges", () => {
  it("has an entry for every source, so no figure can render unlabelled", () => {
    for (const source of ALL_SOURCES) {
      expect(SOURCE_META[source]).toBeDefined();
      expect(SOURCE_META[source].label.length).toBeGreaterThan(0);
      expect(SOURCE_META[source].hint.length).toBeGreaterThan(0);
    }
    expect(Object.keys(SOURCE_META).sort()).toEqual([...ALL_SOURCES].sort());
  });

  it("styles every source differently — identical badges would defeat the point", () => {
    const classNames = ALL_SOURCES.map((s) => SOURCE_META[s].className);
    expect(new Set(classNames).size).toBe(ALL_SOURCES.length);
    const labels = ALL_SOURCES.map((s) => SOURCE_META[s].label);
    expect(new Set(labels).size).toBe(ALL_SOURCES.length);
  });

  it("marks the projected badge with a dashed border no other source uses", () => {
    // Distinguishable before the label is read, and in a printout or screenshot.
    expect(SOURCE_META.PROJECTED.className).toContain("border-dashed");
    for (const s of ALL_SOURCES.filter((x) => x !== "PROJECTED")) {
      expect(SOURCE_META[s].className).not.toContain("border-dashed");
    }
  });

  it("never renders a projected figure without saying what it was projected from", () => {
    expect(sourceBadgeLabel("PROJECTED", "your solar recommendation's sizing")).toBe(
      "Projected from your solar recommendation's sizing",
    );
    // With nothing to name it degrades to the bare label, never a dangling "Projected from".
    expect(sourceBadgeLabel("PROJECTED")).toBe("Projected");
    expect(sourceBadgeLabel("PROJECTED", "")).toBe("Projected");
  });

  it("does not let a derivedFrom string leak onto a non-projected badge", () => {
    expect(sourceBadgeLabel("PLATFORM_CALCULATION", "somewhere")).toBe("Your calculated data");
    expect(isProjectedSource("PLATFORM_CALCULATION")).toBe(false);
    expect(isProjectedSource("PROJECTED")).toBe(true);
  });
});

describe("projected value formatting", () => {
  it("prints exactly the decimals the server allowed, no more and no fewer", () => {
    expect(formatAtPrecision(41_307.638214, 0)).toBe("41,308");
    expect(formatAtPrecision(18_772.6, 1)).toBe("18,772.6");
    // A whole number at 1 dp keeps its tenth rather than being tidied away.
    expect(formatAtPrecision(22_000, 1)).toBe("22,000.0");
  });

  it("renders a range as both ends, never as a midpoint or a single headline figure", () => {
    const text = formatProjected({ low: 18_772.6, high: 19_530.1, isPoint: false, decimals: 1, basis: "" });
    expect(text).toBe("18,772.6–19,530.1");
    expect(text).toContain("–");
    // The midpoint must appear nowhere.
    expect(text).not.toContain("19,151");
  });

  it("prints one number only when the server itself says the ends coincide", () => {
    expect(formatProjected({ low: 22_000, high: 22_000, isPoint: true, decimals: 1, basis: "" })).toBe("22,000.0");
    // isPoint is the server's call, not the formatter's — equal ends without
    // the flag still render as a range rather than being silently collapsed.
    expect(formatProjected({ low: 5, high: 5, isPoint: false, decimals: 0, basis: "" })).toBe("5–5");
  });

  it("signs the change at the same precision as the projection", () => {
    expect(formatChange(metric())).toBe("−1,227.4 to −469.9");
    expect(formatChange(metric({ changeLow: 2_000, changeHigh: 2_000 }))).toBe("+2,000.0");
    expect(formatChange(metric({ changeLow: null, changeHigh: null }))).toBeNull();
  });

  it("labels every metric with a unit, so a bare number never reaches the screen", () => {
    for (const suffix of Object.values(METRIC_UNIT_SUFFIX)) {
      expect(suffix.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("change tone", () => {
  it("reads a fall as good for emissions and liability", () => {
    expect(changeTone(metric())).toBe("GOOD");
    expect(changeTone(metric({ changeLow: 500, changeHigh: 900 }))).toBe("BAD");
  });

  it("reads a fall as bad for the CCTS position, which is a surplus", () => {
    const ccts = { metric: "CCTS_POSITION_TCO2E" as const, lowerIsBetter: false };
    expect(changeTone(metric({ ...ccts, changeLow: -50, changeHigh: -10 }))).toBe("BAD");
    expect(changeTone(metric({ ...ccts, changeLow: 10, changeHigh: 50 }))).toBe("GOOD");
  });

  it("stays neutral on a range that straddles zero rather than picking a side", () => {
    expect(changeTone(metric({ changeLow: -100, changeHigh: 200 }))).toBe("NEUTRAL");
    expect(changeTone(metric({ changeLow: 0, changeHigh: 0 }))).toBe("NEUTRAL");
  });
});

describe("CCTS position wording", () => {
  it("says surplus or deficit rather than leaving the sign to be interpreted", () => {
    expect(cctsPositionLabel(200)).toBe("surplus");
    expect(cctsPositionLabel(-200)).toBe("deficit");
    expect(cctsPositionLabel(0)).toBe("exactly at target");
  });
});
