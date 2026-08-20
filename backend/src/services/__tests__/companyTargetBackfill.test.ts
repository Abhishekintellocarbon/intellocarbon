import { describe, it, expect } from "vitest";
import { resolveBackfill, isUsableCandidate } from "../companyTargetBackfill.service";

/**
 * The backfill's failure mode is not "misses a row" — it is inventing a
 * confident single target out of two filings that disagree. These pin the
 * conflict rules; the DB traversal around them is covered by running the
 * script against a throwaway database.
 */

const issb = { baselineYear: 2020, baselineEmissionsTco2e: 1000, targetYear: 2030, reductionPct: null, scopesCovered: null };
const cdp = { baselineYear: 2020, baselineEmissionsTco2e: 1000, targetYear: 2030, reductionPct: 42, scopesCovered: "Scope 1+2" };

describe("isUsableCandidate", () => {
  it("needs baseline year, baseline emissions and target year", () => {
    expect(isUsableCandidate(issb)).toBe(true);
    expect(isUsableCandidate({ ...issb, baselineYear: undefined })).toBe(false);
    expect(isUsableCandidate({ ...issb, baselineEmissionsTco2e: undefined })).toBe(false);
    expect(isUsableCandidate({ ...issb, targetYear: undefined })).toBe(false);
    expect(isUsableCandidate(null)).toBe(false);
  });

  /** ISSB never captures a reduction percentage, so requiring one would make
      the primary source permanently unusable. */
  it("does not require a reduction percentage", () => {
    expect(isUsableCandidate({ ...issb, reductionPct: null })).toBe(true);
  });

  /** A baseline of zero is a real stated figure, not a missing one. */
  it("treats zero as present", () => {
    expect(isUsableCandidate({ ...issb, baselineEmissionsTco2e: 0 })).toBe(true);
  });
});

describe("resolveBackfill", () => {
  it("writes nothing when neither source states a target", () => {
    const r = resolveBackfill(null, null);
    expect(r.chosen).toBeNull();
    expect(r.conflicts).toEqual([]);
  });

  it("uses ISSB when only ISSB has one", () => {
    expect(resolveBackfill(issb, null).chosen).toMatchObject({ source: "ISSB", targetYear: 2030 });
  });

  it("uses CDP when only CDP has one", () => {
    expect(resolveBackfill(null, cdp).chosen).toMatchObject({ source: "CDP", reductionPct: 42 });
  });

  it("reports no conflict when the two agree", () => {
    const r = resolveBackfill(issb, cdp);
    expect(r.conflicts).toEqual([]);
    expect(r.chosen?.source).toBe("ISSB");
  });

  /**
   * The core requirement: ISSB wins, and the disagreement is still reported.
   * Picking a winner silently is the outcome this must never produce.
   */
  it("prefers ISSB on conflict AND flags every disagreeing field", () => {
    const r = resolveBackfill(issb, { ...cdp, baselineYear: 2018, targetYear: 2035, baselineEmissionsTco2e: 900 });
    expect(r.chosen).toMatchObject({ source: "ISSB", baselineYear: 2020, targetYear: 2030 });
    expect(r.conflicts.map((c) => c.field).sort()).toEqual([
      "baselineEmissionsTco2e",
      "baselineYear",
      "targetYear",
    ]);
    expect(r.reason).toMatch(/flagged the conflict/i);
  });

  it("names both values on a flagged conflict so it can be checked", () => {
    const r = resolveBackfill(issb, { ...cdp, targetYear: 2050 });
    expect(r.conflicts).toEqual([{ field: "targetYear", issb: 2030, cdp: 2050 }]);
  });

  /** Display rounding must not manufacture conflicts nobody can act on. */
  it("tolerates sub-tonne differences in the baseline", () => {
    expect(resolveBackfill(issb, { ...cdp, baselineEmissionsTco2e: 1000.4 }).conflicts).toEqual([]);
  });

  it("still flags a baseline difference above the tolerance", () => {
    expect(resolveBackfill(issb, { ...cdp, baselineEmissionsTco2e: 1200 }).conflicts).toHaveLength(1);
  });

  /**
   * Gap-filling within the chosen row is not the same as merging two
   * disagreeing targets: ISSB simply has no column for these two fields.
   */
  it("fills reduction and scopes from CDP where ISSB has none", () => {
    const r = resolveBackfill(issb, cdp);
    expect(r.chosen).toMatchObject({ reductionPct: 42, scopesCovered: "Scope 1+2" });
  });

  it("does not let CDP override a reduction ISSB did state", () => {
    const r = resolveBackfill({ ...issb, reductionPct: 30 }, cdp);
    expect(r.chosen?.reductionPct).toBe(30);
  });
});
