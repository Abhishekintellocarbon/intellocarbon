import { describe, it, expect } from "vitest";
import { companySchema } from "../company.validators";

/**
 * appliesCbam (module on/off) and cbamFrameworks (which regimes) have to
 * agree, and the normalisation that keeps them in step sits in the schema so
 * every caller gets it. These pin the four cases that matter: the legacy
 * payload that predates UK CBAM, the contradiction that must be rejected
 * rather than guessed at, turning the module off, and picking both regimes.
 */
const base = {
  name: "Bharat Steel Works",
  sector: "STEEL" as const,
};

const parse = (input: Record<string, unknown>) => companySchema.parse({ ...base, ...input });

describe("company CBAM framework normalisation", () => {
  it("reads a pre-UK-CBAM payload as EU CBAM", () => {
    // No cbamFrameworks at all — what every client sent before this field
    // existed, and what the backfill migration assumed for existing rows.
    expect(parse({ appliesCbam: true }).cbamFrameworks).toEqual(["EU_CBAM"]);
  });

  it("keeps an explicit single regime", () => {
    expect(parse({ appliesCbam: true, cbamFrameworks: ["UK_CBAM"] }).cbamFrameworks).toEqual(["UK_CBAM"]);
  });

  it("keeps both regimes when a company is in scope for each", () => {
    expect(parse({ appliesCbam: true, cbamFrameworks: ["EU_CBAM", "UK_CBAM"] }).cbamFrameworks).toEqual([
      "EU_CBAM",
      "UK_CBAM",
    ]);
  });

  it("de-duplicates a repeated regime", () => {
    expect(parse({ appliesCbam: true, cbamFrameworks: ["EU_CBAM", "EU_CBAM"] }).cbamFrameworks).toEqual(["EU_CBAM"]);
  });

  it("clears the regimes when the CBAM module is off", () => {
    // Stale regimes must not survive the module being switched off, or
    // re-enabling it would silently restore an old selection.
    expect(parse({ appliesCbam: false, cbamFrameworks: ["EU_CBAM"] }).cbamFrameworks).toEqual([]);
    expect(parse({ appliesCbam: false }).cbamFrameworks).toEqual([]);
  });

  it("rejects CBAM-applies-to-nothing rather than guessing which side is right", () => {
    const result = companySchema.safeParse({ ...base, appliesCbam: true, cbamFrameworks: [] });
    expect(result.success).toBe(false);
    expect(result.success === false && result.error.issues[0].message).toMatch(/at least one CBAM regime/);
  });

  it("rejects a regime outside the enum", () => {
    expect(companySchema.safeParse({ ...base, appliesCbam: true, cbamFrameworks: ["US_CBAM"] }).success).toBe(false);
  });

  it("never leaves appliesCbam and cbamFrameworks disagreeing", () => {
    for (const input of [
      { appliesCbam: true },
      { appliesCbam: true, cbamFrameworks: ["UK_CBAM"] },
      { appliesCbam: false },
      { appliesCbam: false, cbamFrameworks: ["EU_CBAM", "UK_CBAM"] },
      {},
    ]) {
      const parsed = parse(input);
      expect(parsed.appliesCbam).toBe(parsed.cbamFrameworks.length > 0);
    }
  });
});
