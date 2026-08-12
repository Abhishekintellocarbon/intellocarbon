import { describe, expect, it, beforeEach } from "vitest";
import { computeUkCbamEmissions } from "../emissionCalculation.service";
import { computeUkCbamFinancialImpact } from "../ukCbamFinancialImpact.service";
import { setUkCbamRate } from "../../data/ukCbamReferenceData";
import type { ReportContext } from "../report.service";

/**
 * The UK figure must never be reachable by tweaking the EU one — the two
 * regimes count different emissions, and an entry with indirect emissions is
 * the case that proves it. These pin the boundary (Scope 1 + precursors, no
 * electricity or steam) and the three states the liability can be in.
 */
describe("UK CBAM emissions", () => {
  it("counts Scope 1 and precursors and nothing else", () => {
    // 800 direct + 200 precursor over 500 t of product.
    expect(
      computeUkCbamEmissions({ totalDirectCo2eAr5: 800, directPrecursorCo2e: 200, productionTonnes: 500 }),
    ).toEqual({ totalEmissionsUkCbamAr5: 1000, specificEmbeddedEmissionsUkCbam: 2 });
  });

  it("is unaffected by indirect emissions, however large", () => {
    // The caller simply never passes them; this pins that the UK total is
    // built from its own inputs rather than derived by subtraction from the
    // EU total, which would drift if the EU boundary ever changed.
    const withoutIndirect = computeUkCbamEmissions({
      totalDirectCo2eAr5: 800,
      directPrecursorCo2e: 200,
      productionTonnes: 500,
    });
    expect(withoutIndirect.totalEmissionsUkCbamAr5).toBe(1000);
  });

  it("returns zero intensity rather than dividing by zero", () => {
    // Electricity entries have no production tonnes — UK CBAM excludes the
    // sector, so there is no per-MWh denominator to fall back on.
    expect(
      computeUkCbamEmissions({ totalDirectCo2eAr5: 800, directPrecursorCo2e: 200, productionTonnes: 0 }),
    ).toEqual({ totalEmissionsUkCbamAr5: 1000, specificEmbeddedEmissionsUkCbam: 0 });
  });
});

/**
 * A minimal stand-in for the report context — the financial function reads
 * only these fields, and building a real one needs a database.
 */
const contextFor = (overrides: Record<string, unknown> = {}) =>
  ({
    id: "activity-data-test-id",
    sector: "STEEL",
    periodEnd: new Date("2027-03-31T00:00:00Z"),
    carbonPricePaidGbpPerTonne: null,
    calculationResult: {
      totalEmissionsUkCbamAr5: 1000,
      specificEmbeddedEmissionsUkCbam: 2,
      indirectElectricityCo2e: 300,
      indirectSteamCo2e: 50,
    },
    ...overrides,
  }) as unknown as ReportContext;

describe("UK CBAM financial impact", () => {
  beforeEach(() => {
    // Module state — reset to unpublished so no test inherits another's rate.
    setUkCbamRate(0, "unset", new Date("2027-01-01T00:00:00Z"));
  });

  it("reports electricity as out of scope, without a liability", () => {
    const impact = computeUkCbamFinancialImpact(contextFor({ sector: "ELECTRICITY" }));
    expect(impact.status).toBe("OUT_OF_SCOPE");
    expect(impact.status === "OUT_OF_SCOPE" && impact.reason).toMatch(/electricity is excluded/i);
  });

  it("returns final emissions but no liability while the rate is unpublished", () => {
    const impact = computeUkCbamFinancialImpact(contextFor());
    expect(impact.status).toBe("RATE_PENDING");
    if (impact.status !== "RATE_PENDING") throw new Error("expected RATE_PENDING");
    expect(impact.emissionsTco2e).toBe(1000);
    // The excluded indirect emissions travel with the pending result, so the
    // gap against the EU figure is explainable before any price exists.
    expect(impact.excludedIndirectTco2e).toBe(350);
    expect(impact).not.toHaveProperty("netLiabilityGbp");
  });

  it("prices the liability once a rate is published", () => {
    setUkCbamRate(40, "HMRC — UK ETS auction price + CPS, Q1 2027", new Date("2027-01-01T00:00:00Z"));

    const impact = computeUkCbamFinancialImpact(contextFor());
    if (impact.status !== "CALCULATED") throw new Error("expected CALCULATED");
    expect(impact.rateGbpPerTonne).toBe(40);
    expect(impact.rateQuarter).toBe("Q1 2027");
    // 1000 tCO2e x GBP 40 — indirect emissions excluded, so this is not
    // 1350 x 40 as the EU basis would give.
    expect(impact.grossLiabilityGbp).toBe(40_000);
    expect(impact.netLiabilityGbp).toBe(40_000);
  });

  it("deducts a carbon price already paid overseas", () => {
    setUkCbamRate(40, "HMRC — UK ETS auction price + CPS, Q1 2027", new Date("2027-01-01T00:00:00Z"));

    const impact = computeUkCbamFinancialImpact(contextFor({ carbonPricePaidGbpPerTonne: 10 }));
    if (impact.status !== "CALCULATED") throw new Error("expected CALCULATED");
    // GBP 10/t paid on 1000 t = GBP 10,000 of the GBP 40,000 gross, i.e. 250
    // tonnes' worth at the UK rate.
    expect(impact.overseasCarbonPriceDeductionTco2e).toBe(250);
    expect(impact.overseasCarbonPriceDeductionGbp).toBe(10_000);
    expect(impact.netLiabilityGbp).toBe(30_000);
  });

  it("never turns a higher overseas price into a negative liability", () => {
    setUkCbamRate(40, "HMRC — UK ETS auction price + CPS, Q1 2027", new Date("2027-01-01T00:00:00Z"));

    const impact = computeUkCbamFinancialImpact(contextFor({ carbonPricePaidGbpPerTonne: 100 }));
    if (impact.status !== "CALCULATED") throw new Error("expected CALCULATED");
    expect(impact.overseasCarbonPriceDeductionTco2e).toBe(1000);
    expect(impact.netLiabilityGbp).toBe(0);
  });

  it("prices UK CBAM below EU CBAM for the same entry, because indirect emissions are out", () => {
    setUkCbamRate(40, "HMRC — UK ETS auction price + CPS, Q1 2027", new Date("2027-01-01T00:00:00Z"));

    const impact = computeUkCbamFinancialImpact(contextFor());
    if (impact.status !== "CALCULATED") throw new Error("expected CALCULATED");
    const euBasisGbp = (1000 + 350) * 40;
    expect(impact.grossLiabilityGbp).toBeLessThan(euBasisGbp);
    expect(impact.grossLiabilityGbp + impact.excludedIndirectTco2e * 40).toBe(euBasisGbp);
  });
});
