import { describe, it, expect } from "vitest";
import {
  UK_CBAM_DEFERRED_EMISSIONS,
  UK_CBAM_EXCLUDED_SECTORS,
  UK_CBAM_INCLUDED_EMISSION_SCOPES,
  UK_CBAM_REGISTRATION_THRESHOLD_GBP,
  UK_CBAM_REGISTRATION_THRESHOLD_WINDOW_MONTHS,
  UK_CBAM_SECTORS,
  isUkCbamEmissionScopeInScope,
  isUkCbamSector,
  ukCbamEmissionScopesFor,
  ukCbamIncludesIndirectEmissions,
} from "../ukCbamReferenceData";

/**
 * UK CBAM's boundary differs from the EU's in two ways that are easy to lose
 * once calculation code is layered on top: electricity is out of scope as a
 * *sector*, and Scope 2 is out of scope as an *emissions category* until 2029.
 * These pin both, and pin that the included/deferred lists cannot drift apart
 * (they are derived from one record — see UK_CBAM_EMISSION_SCOPE_START_YEAR).
 */
describe("UK CBAM sector scope", () => {
  it("covers aluminium, cement, fertiliser, hydrogen and iron & steel", () => {
    expect([...UK_CBAM_SECTORS].sort()).toEqual(["ALUMINIUM", "CEMENT", "FERTILIZER", "HYDROGEN", "STEEL"]);
  });

  it("excludes electricity, unlike EU CBAM", () => {
    expect(UK_CBAM_EXCLUDED_SECTORS).toEqual(["ELECTRICITY"]);
    expect(isUkCbamSector("ELECTRICITY")).toBe(false);
    expect(isUkCbamSector("STEEL")).toBe(true);
  });
});

describe("UK CBAM registration threshold", () => {
  it("is £50,000 over a rolling 12-month period", () => {
    expect(UK_CBAM_REGISTRATION_THRESHOLD_GBP).toBe(50_000);
    expect(UK_CBAM_REGISTRATION_THRESHOLD_WINDOW_MONTHS).toBe(12);
  });
});

describe("UK CBAM emissions scope", () => {
  it("covers Scope 1 and select precursors only at the 2027 launch — not Scope 2", () => {
    expect([...UK_CBAM_INCLUDED_EMISSION_SCOPES].sort()).toEqual(["SCOPE_1", "SELECT_PRECURSORS"]);
    expect(UK_CBAM_INCLUDED_EMISSION_SCOPES).not.toContain("SCOPE_2");
  });

  it("defers Scope 2 — indirect, electricity-related — to 2029", () => {
    expect(UK_CBAM_DEFERRED_EMISSIONS.fromYear).toBe(2029);
    expect(UK_CBAM_DEFERRED_EMISSIONS.scopes).toEqual(["SCOPE_2"]);
  });

  it("never counts a scope as both included at launch and deferred", () => {
    for (const scope of UK_CBAM_DEFERRED_EMISSIONS.scopes) {
      expect(UK_CBAM_INCLUDED_EMISSION_SCOPES).not.toContain(scope);
    }
  });

  it("holds Scope 2 out of the scope set until 2029, then admits it", () => {
    expect(ukCbamEmissionScopesFor(2027)).not.toContain("SCOPE_2");
    expect(ukCbamEmissionScopesFor(2028)).not.toContain("SCOPE_2");
    expect([...ukCbamEmissionScopesFor(2029)].sort()).toEqual(["SCOPE_1", "SCOPE_2", "SELECT_PRECURSORS"]);
  });

  it("keeps Scope 1 and precursors in scope in every period from launch", () => {
    for (const year of [2027, 2028, 2029, 2030]) {
      expect(isUkCbamEmissionScopeInScope("SCOPE_1", year)).toBe(true);
      expect(isUkCbamEmissionScopeInScope("SELECT_PRECURSORS", year)).toBe(true);
    }
  });

  it("reports indirect emissions as out of scope before 2029 and in scope from 2029", () => {
    expect(ukCbamIncludesIndirectEmissions(2026)).toBe(false);
    expect(ukCbamIncludesIndirectEmissions(2027)).toBe(false);
    expect(ukCbamIncludesIndirectEmissions(2028)).toBe(false);
    expect(ukCbamIncludesIndirectEmissions(2029)).toBe(true);
    expect(ukCbamIncludesIndirectEmissions(2030)).toBe(true);
  });

  it("agrees with isUkCbamEmissionScopeInScope on the Scope 2 question", () => {
    for (const year of [2026, 2027, 2028, 2029, 2030]) {
      expect(ukCbamIncludesIndirectEmissions(year)).toBe(isUkCbamEmissionScopeInScope("SCOPE_2", year));
    }
  });
});
