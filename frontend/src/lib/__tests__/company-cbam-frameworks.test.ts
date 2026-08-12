import { describe, it, expect } from "vitest";
import { cbamFieldsFromForm, cbamFormFromCompany, cbamFrameworksOf } from "../validations/company";

/**
 * The two CBAM switches are the form's representation of the API's
 * appliesCbam + cbamFrameworks pair, so the mapping in both directions has to
 * round-trip and has to keep the master switch derived — a company that
 * saves its settings without touching the CBAM card must come back unchanged.
 */
describe("cbamFieldsFromForm", () => {
  it("derives appliesCbam from the regime switches", () => {
    expect(cbamFieldsFromForm({ appliesEuCbam: false, appliesUkCbam: false })).toEqual({
      appliesCbam: false,
      cbamFrameworks: [],
    });
    expect(cbamFieldsFromForm({ appliesEuCbam: true, appliesUkCbam: false })).toEqual({
      appliesCbam: true,
      cbamFrameworks: ["EU_CBAM"],
    });
    expect(cbamFieldsFromForm({ appliesEuCbam: false, appliesUkCbam: true })).toEqual({
      appliesCbam: true,
      cbamFrameworks: ["UK_CBAM"],
    });
    expect(cbamFieldsFromForm({ appliesEuCbam: true, appliesUkCbam: true })).toEqual({
      appliesCbam: true,
      cbamFrameworks: ["EU_CBAM", "UK_CBAM"],
    });
  });
});

describe("cbamFrameworksOf", () => {
  it("reads a company saved before UK CBAM existed as EU CBAM", () => {
    expect(cbamFrameworksOf({ appliesCbam: true })).toEqual(["EU_CBAM"]);
    expect(cbamFrameworksOf({ appliesCbam: true, cbamFrameworks: [] })).toEqual(["EU_CBAM"]);
  });

  it("returns nothing when the CBAM module is off", () => {
    expect(cbamFrameworksOf({ appliesCbam: false, cbamFrameworks: [] })).toEqual([]);
    expect(cbamFrameworksOf({ appliesCbam: false })).toEqual([]);
  });

  it("returns the saved regimes as-is", () => {
    expect(cbamFrameworksOf({ appliesCbam: true, cbamFrameworks: ["UK_CBAM"] })).toEqual(["UK_CBAM"]);
    expect(cbamFrameworksOf({ appliesCbam: true, cbamFrameworks: ["EU_CBAM", "UK_CBAM"] })).toEqual([
      "EU_CBAM",
      "UK_CBAM",
    ]);
  });
});

describe("company -> form -> company round trip", () => {
  it("preserves every regime combination, including a legacy row", () => {
    const companies = [
      { appliesCbam: false, cbamFrameworks: [] as const },
      { appliesCbam: true, cbamFrameworks: ["EU_CBAM"] as const },
      { appliesCbam: true, cbamFrameworks: ["UK_CBAM"] as const },
      { appliesCbam: true, cbamFrameworks: ["EU_CBAM", "UK_CBAM"] as const },
    ];

    for (const company of companies) {
      const saved = cbamFieldsFromForm(cbamFormFromCompany({ ...company, cbamFrameworks: [...company.cbamFrameworks] }));
      expect(saved.cbamFrameworks).toEqual([...company.cbamFrameworks]);
      expect(saved.appliesCbam).toBe(company.appliesCbam);
    }
  });

  it("resolves a legacy row to EU CBAM on first save rather than dropping it", () => {
    expect(cbamFieldsFromForm(cbamFormFromCompany({ appliesCbam: true }))).toEqual({
      appliesCbam: true,
      cbamFrameworks: ["EU_CBAM"],
    });
  });
});
