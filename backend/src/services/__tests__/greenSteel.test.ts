import { describe, it, expect } from "vitest";
import {
  rateGreenSteel,
  isGreenSteelApplicable,
  GREEN_STEEL_THRESHOLD_TCO2E_PER_T,
  GREEN_STEEL_BANDS,
  GREEN_STEEL_CERTIFICATION_NOTICE,
} from "../greenSteel.service";

/**
 * The band cut-offs come from Ministry of Steel Gazette Notification 763(E)
 * of 12 December 2024, confirmed against NISST's published notification page.
 *
 * The failure that matters is over-rating: telling a producer its steel is
 * four-star when the notification puts it at three would travel outward as a
 * claim to a buyer, and Intellocarbon does not certify any of this. So the
 * boundary cases are pinned harder than the comfortable middles.
 */

describe("green steel bands", () => {
  it("uses the notified threshold of 2.2 tCO2e per tonne", () => {
    expect(GREEN_STEEL_THRESHOLD_TCO2E_PER_T).toBe(2.2);
  });

  it("uses the notified cut-offs of 1.6, 2.0 and 2.2", () => {
    expect(GREEN_STEEL_BANDS.map((b) => b.upperExclusive)).toEqual([1.6, 2.0, 2.2]);
  });

  it("rates comfortably inside each band", () => {
    expect(rateGreenSteel(1.2).stars).toBe(5);
    expect(rateGreenSteel(1.8).stars).toBe(4);
    expect(rateGreenSteel(2.1).stars).toBe(3);
  });

  it("does not rate steel at or above the threshold", () => {
    expect(rateGreenSteel(2.5).stars).toBeNull();
    expect(rateGreenSteel(2.5).qualifiesAsGreen).toBe(false);
  });

  /**
   * "Not rated" is a different statement from "zero stars" and has to stay
   * null all the way out — a 0 would render as a star count in any UI that
   * treats the field as a number.
   */
  it("reports not-rated as null rather than zero stars", () => {
    const r = rateGreenSteel(3.0);
    expect(r.stars).toBeNull();
    expect(r.stars).not.toBe(0);
  });
});

describe("green steel band boundaries", () => {
  /**
   * The notification words five-star as "< 1.6", so 1.6 exactly is four-star.
   */
  it("puts exactly 1.6 in the four-star band, not five", () => {
    expect(rateGreenSteel(1.6).stars).toBe(4);
    expect(rateGreenSteel(1.5999).stars).toBe(5);
  });

  /**
   * 2.0 is named by both middle bands ("between 1.6 and 2.0" and "between 2.0
   * and 2.2"). Ties resolve downward — the conservative reading.
   */
  it("resolves the ambiguous 2.0 boundary downward to three-star", () => {
    expect(rateGreenSteel(2.0).stars).toBe(3);
    expect(rateGreenSteel(1.9999).stars).toBe(4);
  });

  /**
   * Green steel is defined as "less than 2.2", so 2.2 exactly is not green.
   */
  it("treats exactly 2.2 as not green", () => {
    expect(rateGreenSteel(2.2).stars).toBeNull();
    expect(rateGreenSteel(2.2).qualifiesAsGreen).toBe(false);
    expect(rateGreenSteel(2.1999).stars).toBe(3);
  });

  it("never awards a higher star than the value earns, across the range", () => {
    for (let v = 0; v <= 3; v = Math.round((v + 0.01) * 100) / 100) {
      const { stars } = rateGreenSteel(v);
      if (v < 1.6) expect(stars).toBe(5);
      else if (v < 2.0) expect(stars).toBe(4);
      else if (v < 2.2) expect(stars).toBe(3);
      else expect(stars).toBeNull();
    }
  });
});

describe("percent below threshold", () => {
  /**
   * Reported for progress tracking only. The bands are absolute intensities,
   * so this number must never be what decides the rating — 27.3% below the
   * threshold is five-star here only because 1.6 is, not because of the
   * percentage.
   */
  it("is computed against 2.2 and does not drive the band", () => {
    const r = rateGreenSteel(1.1);
    expect(r.percentBelowThreshold).toBe(50);
    expect(r.stars).toBe(5);
  });

  it("goes negative above the threshold rather than clamping", () => {
    expect(rateGreenSteel(3.3).percentBelowThreshold).toBe(-50);
  });

  it("is zero exactly at the threshold", () => {
    expect(rateGreenSteel(2.2).percentBelowThreshold).toBe(0);
  });
});

describe("sector applicability", () => {
  /**
   * The explicit non-steel case. The taxonomy covers steel; an intensity
   * compared against 2.2 for any other sector is a meaningless number, so the
   * module must not apply rather than applying and showing nothing.
   */
  it("applies to steel", () => {
    expect(isGreenSteelApplicable({ sector: "STEEL" })).toBe(true);
  });

  it("does not apply to any other sector", () => {
    for (const sector of ["CEMENT", "ALUMINIUM", "FERTILIZER", "HYDROGEN", "ELECTRICITY", "OTHER"] as const) {
      expect(isGreenSteelApplicable({ sector })).toBe(false);
    }
  });
});

describe("certification wording", () => {
  /**
   * Intellocarbon does not certify. The notice names NISST and says plainly
   * that this is preparation — if this string drifts, every surface that
   * reuses it drifts with it, which is why they all read it from here.
   */
  it("names NISST and disclaims certifying", () => {
    expect(GREEN_STEEL_CERTIFICATION_NOTICE).toMatch(/NISST/);
    expect(GREEN_STEEL_CERTIFICATION_NOTICE).toMatch(/does not itself certify/i);
  });

  it("never describes the output as a certificate", () => {
    expect(GREEN_STEEL_CERTIFICATION_NOTICE).not.toMatch(/\bwe certify\b/i);
    expect(rateGreenSteel(1.2).summary).not.toMatch(/certifi/i);
  });

  /** The summary states where the calculation landed, not what the steel is. */
  it("words the rating as a calculated band, not a status", () => {
    expect(rateGreenSteel(1.2).summary).toMatch(/falls in the 5-star band/);
  });
});
