import { describe, expect, it } from "vitest";
import { previewSignificance, previewRankings, severityOf, likelihoodOf } from "../gri-scoring";

/**
 * These values are the backend's. `previewSignificance` duplicates
 * `computeImpactSignificance` in backend/src/services/griCalculation.service.ts
 * so the wizard can score a rating without a round trip, and a drift between
 * the two would show a topic as material and then have the server silently
 * exclude it. The golden numbers below are the contract that keeps them
 * aligned — if the backend formula changes, these fail first.
 */
describe("previewSignificance", () => {
  it("negative actual impact: severity is the mean of scale, scope and irremediability", () => {
    // mean(5, 5, 4) = 4.666... -> 4.67, no likelihood weighting on an actual impact
    expect(
      previewSignificance({ impactType: "NEGATIVE_ACTUAL", scale: 5, scope: 5, irremediability: 4 }),
    ).toBe(4.67);
  });

  it("positive impact ignores irremediability entirely", () => {
    // mean(3, 3) = 3.00 — irremediability is not part of a positive impact's significance
    expect(previewSignificance({ impactType: "POSITIVE_ACTUAL", scale: 3, scope: 3 })).toBe(3);
  });

  it("negative potential impact is discounted by likelihood, bounded at 40%", () => {
    // severity mean(5, 3, 5) = 4.333; weight 0.5 + 0.5*(3/5) = 0.8 -> 3.47
    expect(
      previewSignificance({
        impactType: "NEGATIVE_POTENTIAL",
        scale: 5,
        scope: 3,
        irremediability: 5,
        likelihood: 3,
      }),
    ).toBe(3.47);
  });

  it("a severe hazard at the lowest likelihood still keeps 60% of its severity", () => {
    // This is the regression that mattered: a raw likelihood/5 weight scored
    // this 1.00 and dropped a fatality-grade hazard out of the report. The
    // bounded weight floors it at 0.6, so severity still dominates.
    expect(
      previewSignificance({
        impactType: "NEGATIVE_POTENTIAL",
        scale: 5,
        scope: 5,
        irremediability: 5,
        likelihood: 1,
      }),
    ).toBe(3);
  });

  it("a potential impact with no stated likelihood is scored at full weight", () => {
    // Conservative reading — assuming it is unlikely would suppress it out of the report.
    expect(previewSignificance({ impactType: "NEGATIVE_POTENTIAL", scale: 4, scope: 4, irremediability: 4 })).toBe(4);
  });

  it("a negative impact with no irremediability drops it from the mean rather than counting it as zero", () => {
    // mean(4, 2) = 3.00, not mean(4, 2, 0) = 2.00
    expect(previewSignificance({ impactType: "NEGATIVE_ACTUAL", scale: 4, scope: 2 })).toBe(3);
  });

  it("accepts string ratings from form state without coercing them to NaN", () => {
    expect(previewSignificance({ impactType: "NEGATIVE_ACTUAL", scale: "5", scope: "5", irremediability: "4" })).toBe(4.67);
  });
});

describe("previewRankings", () => {
  const impacts = [
    { topicCode: "GRI_305", impactType: "NEGATIVE_ACTUAL", scale: 5, scope: 5, irremediability: 4 },
    // A cluster of minor impacts on the same topic must not dilute the severe one.
    { topicCode: "GRI_305", impactType: "NEGATIVE_ACTUAL", scale: 1, scope: 1, irremediability: 1 },
    { topicCode: "GRI_303", impactType: "NEGATIVE_ACTUAL", scale: 4, scope: 4, irremediability: 3 },
    { topicCode: "GRI_418", impactType: "NEGATIVE_POTENTIAL", scale: 2, scope: 1, irremediability: 1, likelihood: 1 },
  ] as Parameters<typeof previewRankings>[0];

  it("takes the maximum significance per topic, not the mean", () => {
    const ranked = previewRankings(impacts, 3);
    expect(ranked.find((r) => r.topicCode === "GRI_305")?.significanceScore).toBe(4.67);
  });

  it("sorts by significance descending", () => {
    expect(previewRankings(impacts, 3).map((r) => r.topicCode)).toEqual(["GRI_305", "GRI_303", "GRI_418"]);
  });

  it("flags only topics at or above the threshold as material", () => {
    const ranked = previewRankings(impacts, 3);
    expect(ranked.filter((r) => r.meetsThreshold).map((r) => r.topicCode)).toEqual(["GRI_305", "GRI_303"]);
  });

  it("treats a score exactly at the threshold as material", () => {
    const atThreshold = [
      { topicCode: "GRI_404", impactType: "POSITIVE_ACTUAL", scale: 3, scope: 3 },
    ] as Parameters<typeof previewRankings>[0];
    expect(previewRankings(atThreshold, 3)[0].meetsThreshold).toBe(true);
  });
});

describe("matrix plotting helpers", () => {
  it("plots an already-occurring impact at maximum likelihood", () => {
    expect(likelihoodOf({ impactType: "NEGATIVE_ACTUAL", scale: 3, scope: 3 })).toBe(5);
  });

  it("plots a potential impact at its stated likelihood", () => {
    expect(likelihoodOf({ impactType: "NEGATIVE_POTENTIAL", scale: 3, scope: 3, likelihood: 2 })).toBe(2);
  });

  it("severity excludes the likelihood weighting so the y-axis stays comparable across impact types", () => {
    expect(
      severityOf({ impactType: "NEGATIVE_POTENTIAL", scale: 5, scope: 3, irremediability: 5, likelihood: 1 }),
    ).toBeCloseTo(4.333, 3);
  });
});
