import { describe, it, expect } from "vitest";
import {
  emptyRisk,
  emptyTarget,
  emptyBreakdown,
  isRiskComplete,
  isTargetComplete,
  isBreakdownComplete,
  riskIncompleteReason,
  targetIncompleteReason,
  breakdownIncompleteReason,
} from "../cdp-rows";

/**
 * These rules decide which repeating-block rows the form sends to the API.
 * They mirror the refinements on cdpRiskSchema / cdpTargetSchema /
 * cdpBreakdownSchema in backend/src/validators/cdp.validators.ts.
 *
 * The failure mode worth protecting against is a client rule that is MORE
 * permissive than the server's: a row passes the filter, the server rejects
 * the request, and the whole autosave fails — taking every other unsaved
 * answer on the page with it. So each case below pairs a rule the server
 * enforces with the row the client must therefore hold back.
 */

describe("risk and opportunity rows", () => {
  it("holds back a row with no type or description", () => {
    const row = emptyRisk("RISK");
    expect(isRiskComplete(row)).toBe(false);
    expect(riskIncompleteReason(row)).toMatch(/add a type/i);

    expect(riskIncompleteReason({ ...row, riskType: "Transition — policy and legal" })).toMatch(/description/i);
  });

  it("accepts a row once type and description are present", () => {
    const row = { ...emptyRisk("RISK"), riskType: "Physical — acute", description: "Flooding at the works" };
    expect(isRiskComplete(row)).toBe(true);
    expect(riskIncompleteReason(row)).toBeNull();
  });

  // Matches cdpRiskSchema's range refinement — the server rejects this, so the
  // client must not send it.
  it("holds back a financial range whose minimum exceeds its maximum", () => {
    const row = {
      ...emptyRisk("RISK"),
      riskType: "Market",
      description: "Input cost volatility",
      financialImpactMin: "900",
      financialImpactMax: "100",
    };
    expect(isRiskComplete(row)).toBe(false);
    expect(riskIncompleteReason(row)).toMatch(/cannot exceed the maximum/i);
  });

  it("accepts a range with only one bound, as CDP does", () => {
    const row = {
      ...emptyRisk("OPPORTUNITY"),
      riskType: "Market",
      description: "Low-carbon premium",
      financialImpactMin: "2000000",
    };
    expect(isRiskComplete(row)).toBe(true);
  });
});

describe("target rows", () => {
  const base = { ...emptyTarget(), scopesCovered: "Scope 1 + 2", baseYear: "2020", targetYear: "2030" };

  it("holds back a target missing scopes, base year or target year", () => {
    expect(targetIncompleteReason(emptyTarget())).toMatch(/scopes/i);
    expect(targetIncompleteReason({ ...emptyTarget(), scopesCovered: "Scope 1" })).toMatch(/base year and a target year/i);
  });

  it("accepts a complete absolute target", () => {
    expect(isTargetComplete(base)).toBe(true);
  });

  // Matches cdpTargetSchema's ordering refinement.
  it("holds back a target year at or before the base year", () => {
    expect(isTargetComplete({ ...base, targetYear: "2020" })).toBe(false);
    expect(targetIncompleteReason({ ...base, targetYear: "2019" })).toMatch(/after the base year/i);
  });

  /**
   * Matches cdpTargetSchema's intensity refinement. "A 30% reduction" per what?
   * An intensity target with no denominator is uninterpretable, and CDP would
   * reject it.
   */
  it("holds back an intensity target with no denominator", () => {
    const intensity = { ...base, kind: "INTENSITY" };
    expect(isTargetComplete(intensity)).toBe(false);
    expect(targetIncompleteReason(intensity)).toMatch(/metric it is stated per/i);

    expect(isTargetComplete({ ...intensity, intensityMetric: "tCO2e per tonne of crude steel" })).toBe(true);
  });

  it("does not require a denominator on an absolute target", () => {
    expect(isTargetComplete({ ...base, kind: "ABSOLUTE", intensityMetric: "" })).toBe(true);
  });
});

describe("emissions breakdown rows", () => {
  it("holds back a row with no label or no figure", () => {
    expect(breakdownIncompleteReason(emptyBreakdown())).toMatch(/name the gas/i);
    expect(breakdownIncompleteReason({ ...emptyBreakdown(), label: "CO2" })).toMatch(/tCO2e figure/i);
  });

  it("accepts a labelled row with a numeric figure", () => {
    expect(isBreakdownComplete({ ...emptyBreakdown(), label: "CO2", emissionsTco2e: "3820" })).toBe(true);
  });

  /**
   * A half-typed number must never be coerced — Number("12e") is NaN, and
   * sending it would fail the request rather than saving a wrong value.
   */
  it("holds back a figure that is not a number", () => {
    const row = { ...emptyBreakdown(), label: "CH4", emissionsTco2e: "12e" };
    expect(isBreakdownComplete(row)).toBe(false);
    expect(breakdownIncompleteReason(row)).toMatch(/as a number/i);
  });

  it("accepts zero as a figure — an explicit zero is an answer", () => {
    expect(isBreakdownComplete({ ...emptyBreakdown(), label: "SF6", emissionsTco2e: "0" })).toBe(true);
  });
});

describe("the complete and reason helpers agree", () => {
  /**
   * isRiskComplete and friends are derived from the reason functions rather
   * than written twice, so the hint shown on a row and the decision to filter
   * it out can never disagree. This pins that.
   */
  it("treats a null reason as complete and a reason as incomplete", () => {
    const rows = [
      emptyRisk("RISK"),
      { ...emptyRisk("RISK"), riskType: "A type", description: "A description" },
    ];
    for (const row of rows) {
      expect(isRiskComplete(row)).toBe(riskIncompleteReason(row) === null);
    }
  });
});
