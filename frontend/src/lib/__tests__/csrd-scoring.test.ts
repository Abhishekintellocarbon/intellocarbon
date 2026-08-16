import { describe, expect, it } from "vitest";
import { previewImpactScore, previewFinancialScore, previewScores } from "../csrd-scoring";

/**
 * These values are the backend's. The preview duplicates computeImpactScore /
 * computeFinancialScore in csrdCalculation.service.ts so the wizard can score
 * a rating without a round trip, and a drift between the two would show a
 * standard as material and then have the server silently exclude it.
 */
describe("previewImpactScore", () => {
  it("scores a negative impact on severity — scale, scope and irremediability", () => {
    expect(previewImpactScore({ kind: "IMPACT", impactType: "NEGATIVE_ACTUAL", scale: 5, scope: 5, irremediability: 4 })).toBe(4.67);
  });

  it("excludes irremediability from a positive impact", () => {
    expect(previewImpactScore({ kind: "IMPACT", impactType: "POSITIVE_ACTUAL", scale: 3, scope: 3, irremediability: 5 })).toBe(3);
  });

  it("weights a potential impact by likelihood, bounded at 40%", () => {
    expect(
      previewImpactScore({ kind: "IMPACT", impactType: "NEGATIVE_POTENTIAL", scale: 5, scope: 3, irremediability: 5, impactLikelihood: 3 }),
    ).toBe(3.47);
  });

  it("keeps a maximally severe but unlikely impact at 60% of its severity", () => {
    expect(
      previewImpactScore({ kind: "IMPACT", impactType: "NEGATIVE_POTENTIAL", scale: 5, scope: 5, irremediability: 5, impactLikelihood: 1 }),
    ).toBe(3);
  });

  // The axis-independence contract: an entry not scored on this axis returns
  // null, not zero. Zero would drag a standard's maximum down and could make a
  // financially material standard look immaterial.
  it("returns null for a financial-only entry", () => {
    expect(previewImpactScore({ kind: "FINANCIAL", magnitude: 5 })).toBeNull();
  });

  it("returns null when the impact attributes are incomplete", () => {
    expect(previewImpactScore({ kind: "BOTH", impactType: "NEGATIVE_ACTUAL", scale: 5 })).toBeNull();
  });

  it("accepts string ratings from form state", () => {
    expect(previewImpactScore({ kind: "IMPACT", impactType: "NEGATIVE_ACTUAL", scale: "5", scope: "5", irremediability: "4" })).toBe(4.67);
  });
});

describe("previewFinancialScore", () => {
  it("is magnitude weighted by likelihood", () => {
    // 4 x (0.5 + 0.5*(4/5)) = 4 x 0.9 = 3.6
    expect(previewFinancialScore({ kind: "FINANCIAL", magnitude: 4, financialLikelihood: 4 })).toBe(3.6);
  });

  it("uses full weight when no likelihood is stated", () => {
    expect(previewFinancialScore({ kind: "FINANCIAL", magnitude: 4 })).toBe(4);
  });

  it("floors the likelihood discount at 60%, so a severe exposure survives low probability", () => {
    expect(previewFinancialScore({ kind: "FINANCIAL", magnitude: 5, financialLikelihood: 1 })).toBe(3);
  });

  it("returns null for an impact-only entry", () => {
    expect(previewFinancialScore({ kind: "IMPACT", impactType: "NEGATIVE_ACTUAL", scale: 5, scope: 5 })).toBeNull();
  });
});

describe("previewScores", () => {
  const iros = [
    { standardCode: "ESRS_E1", kind: "IMPACT", impactType: "NEGATIVE_ACTUAL", scale: 5, scope: 5, irremediability: 4 },
    // A cluster of minor matters on the same standard must not dilute the severe one.
    { standardCode: "ESRS_E1", kind: "IMPACT", impactType: "NEGATIVE_ACTUAL", scale: 1, scope: 1, irremediability: 1 },
    { standardCode: "ESRS_G1", kind: "FINANCIAL", magnitude: 4, financialLikelihood: 4 },
    { standardCode: "ESRS_S4", kind: "BOTH", impactType: "NEGATIVE_POTENTIAL", scale: 2, scope: 1, irremediability: 1, impactLikelihood: 1, magnitude: 1, financialLikelihood: 1 },
  ] as Parameters<typeof previewScores>[0];

  it("takes the maximum per axis, not the mean", () => {
    expect(previewScores(iros, 3, 3).find((s) => s.standardCode === "ESRS_E1")?.impactScore).toBe(4.67);
  });

  it("makes a standard material on impact alone", () => {
    const e1 = previewScores(iros, 3, 3).find((s) => s.standardCode === "ESRS_E1")!;
    expect(e1.isMaterial).toBe(true);
    expect(e1.impactMaterial).toBe(true);
    expect(e1.financialMaterial).toBe(false);
    expect(e1.financialScore).toBeNull();
  });

  // The case a single-axis design silently drops.
  it("makes a standard material on financial grounds alone", () => {
    const g1 = previewScores(iros, 3, 3).find((s) => s.standardCode === "ESRS_G1")!;
    expect(g1.isMaterial).toBe(true);
    expect(g1.financialMaterial).toBe(true);
    expect(g1.impactMaterial).toBe(false);
    expect(g1.impactScore).toBeNull();
  });

  it("excludes a standard below both thresholds", () => {
    expect(previewScores(iros, 3, 3).find((s) => s.standardCode === "ESRS_S4")?.isMaterial).toBe(false);
  });

  it("honours the two thresholds independently", () => {
    // Raising only the financial threshold drops G1 while leaving E1 material.
    const strictFinancial = previewScores(iros, 3, 4.5);
    expect(strictFinancial.find((s) => s.standardCode === "ESRS_G1")?.isMaterial).toBe(false);
    expect(strictFinancial.find((s) => s.standardCode === "ESRS_E1")?.isMaterial).toBe(true);
  });

  it("orders by the stronger axis, ties broken deterministically", () => {
    const first = previewScores(iros, 3, 3).map((s) => s.standardCode);
    const second = previewScores([...iros].reverse() as typeof iros, 3, 3).map((s) => s.standardCode);
    expect(first).toEqual(second);
    expect(first[0]).toBe("ESRS_E1");
  });
});
