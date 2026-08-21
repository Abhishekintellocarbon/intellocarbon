import { describe, it, expect } from "vitest";
import {
  buildSupplierScorecard,
  SUPPLIER_SCORECARD_NOTICE,
  type GriSupplierRow,
} from "../supplierScorecard.service";
import type { Supplier } from "@prisma/client";

/**
 * "80% of suppliers have an ESG disclosure on file" reads as a statement about
 * the supply chain. It is a statement about the handful of suppliers the
 * company chose to list. These tests protect the denominator travelling with
 * the number, and that nothing here presents as a rating of other companies.
 */

const supplier = (over: Partial<Supplier> = {}): Supplier =>
  ({
    id: Math.random().toString(36).slice(2),
    companyId: "c1",
    name: "Acme Components",
    sector: "Components",
    country: "India",
    hasEsgDisclosure: false,
    esgDisclosureType: null,
    riskFlag: "NOT_ASSESSED",
    riskNotes: null,
    spendSharePct: null,
    lastReviewedAt: null,
    status: "SUBMITTED",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  }) as Supplier;

describe("coverage of listed suppliers", () => {
  it("computes disclosure coverage over the listed suppliers", () => {
    const s = buildSupplierScorecard([
      supplier({ hasEsgDisclosure: true }),
      supplier({ hasEsgDisclosure: true }),
      supplier({ hasEsgDisclosure: false }),
      supplier({ hasEsgDisclosure: false }),
    ]);
    expect(s.supplierCount).toBe(4);
    expect(s.withDisclosureCount).toBe(2);
    expect(s.disclosureCoveragePct).toBe(50);
  });

  /**
   * The count must always be available alongside the percentage. 100% of two
   * suppliers is a very different claim from 100% of two hundred.
   */
  it("always reports the supplier count with the percentage", () => {
    const s = buildSupplierScorecard([supplier({ hasEsgDisclosure: true })]);
    expect(s.disclosureCoveragePct).toBe(100);
    expect(s.supplierCount).toBe(1);
  });

  it("reports null coverage rather than 0% with no suppliers listed", () => {
    const s = buildSupplierScorecard([]);
    expect(s.disclosureCoveragePct).toBeNull();
    expect(s.hasData).toBe(false);
  });

  /**
   * Spend share is what makes coverage interpretable. Without it the
   * percentage cannot be read as supply-chain-wide, and null is the honest
   * signal for that.
   */
  it("reports spend coverage only when spend shares were recorded", () => {
    const without = buildSupplierScorecard([supplier({ hasEsgDisclosure: true })]);
    expect(without.spendCoveredPct).toBeNull();

    const withSpend = buildSupplierScorecard([
      supplier({ spendSharePct: 30 }),
      supplier({ spendSharePct: 12.5 }),
    ]);
    expect(withSpend.spendCoveredPct).toBe(42.5);
  });

  it("caps spend coverage at 100 when entries sum above it", () => {
    const s = buildSupplierScorecard([supplier({ spendSharePct: 70 }), supplier({ spendSharePct: 60 })]);
    expect(s.spendCoveredPct).toBe(100);
  });
});

describe("risk flags", () => {
  it("breaks suppliers down by self-assessed risk", () => {
    const s = buildSupplierScorecard([
      supplier({ riskFlag: "HIGH" }),
      supplier({ riskFlag: "HIGH" }),
      supplier({ riskFlag: "LOW" }),
      supplier({}),
    ]);
    expect(s.riskBreakdown).toEqual({ LOW: 1, MEDIUM: 0, HIGH: 2, NOT_ASSESSED: 1 });
  });

  /**
   * The one combination worth surfacing on its own: a supplier the company
   * itself flagged high-risk and holds no disclosure for.
   */
  it("counts high-risk suppliers with no disclosure on file", () => {
    const s = buildSupplierScorecard([
      supplier({ riskFlag: "HIGH", hasEsgDisclosure: false }),
      supplier({ riskFlag: "HIGH", hasEsgDisclosure: true }),
      supplier({ riskFlag: "LOW", hasEsgDisclosure: false }),
    ]);
    expect(s.highRiskWithoutDisclosure).toBe(1);
  });

  it("defaults unassessed suppliers to NOT_ASSESSED rather than low risk", () => {
    const s = buildSupplierScorecard([supplier({})]);
    expect(s.riskBreakdown.NOT_ASSESSED).toBe(1);
    expect(s.riskBreakdown.LOW).toBe(0);
  });
});

describe("GRI 308/414 aggregates sit alongside, not merged", () => {
  const griRow = (over: Partial<GriSupplierRow> = {}): GriSupplierRow => ({
    reportingPeriod: "FY2025-26",
    env: { newSuppliersScreenedPct: 80, suppliersAssessedCount: 40, suppliersWithNegativeImpactsCount: 3 },
    social: { newSuppliersScreenedPct: 65 },
    ...over,
  });

  it("surfaces the latest period's aggregates", () => {
    const s = buildSupplierScorecard([], [griRow({ reportingPeriod: "FY2023-24" }), griRow()]);
    expect(s.gri.periodLabel).toBe("FY2025-26");
    expect(s.gri.environmentalScreenedPct).toBe(80);
    expect(s.gri.socialScreenedPct).toBe(65);
  });

  /**
   * GRI's screened percentage is of NEW suppliers in the period; the listed
   * coverage is of named key suppliers. They answer different questions and
   * must never be averaged or substituted for one another.
   */
  it("keeps GRI percentages separate from listed-supplier coverage", () => {
    const s = buildSupplierScorecard([supplier({ hasEsgDisclosure: false })], [griRow()]);
    expect(s.disclosureCoveragePct).toBe(0);
    expect(s.gri.environmentalScreenedPct).toBe(80);
  });

  it("treats an empty GRI row as no aggregate data", () => {
    const s = buildSupplierScorecard(
      [],
      [{ reportingPeriod: "FY2025-26", env: { newSuppliersScreenedPct: null, suppliersAssessedCount: null, suppliersWithNegativeImpactsCount: null }, social: null }],
    );
    expect(s.gri.hasData).toBe(false);
  });

  it("has data when only GRI aggregates exist and no suppliers are listed", () => {
    const s = buildSupplierScorecard([], [griRow()]);
    expect(s.hasData).toBe(true);
    expect(s.supplierCount).toBe(0);
  });
});

describe("nothing here rates another company", () => {
  it("states that coverage is of listed suppliers, not the supply base", () => {
    expect(SUPPLIER_SCORECARD_NOTICE).toMatch(/not of your whole supply base/i);
  });

  it("states the risk flags are the company's own and that suppliers are not verified", () => {
    expect(SUPPLIER_SCORECARD_NOTICE).toMatch(/your own\s+assessment/i);
    expect(SUPPLIER_SCORECARD_NOTICE).toMatch(/does not contact, screen, rate or verify/i);
  });

  it("states that holding a disclosure is not a judgement on its contents", () => {
    expect(SUPPLIER_SCORECARD_NOTICE).toMatch(/not a judgement on what it contains/i);
  });
});

/**
 * The per-supplier rows the dashboard renders.
 *
 * The property worth protecting is that the table is exactly the suppliers the
 * company listed — never padded to fill a grid, never carrying a state nobody
 * entered. The card draws three dots per row, and each has to come from a
 * field that actually exists on Supplier.
 */
describe("supplier rows", () => {
  it("returns exactly the listed suppliers, in outstanding-first order", () => {
    const s = buildSupplierScorecard([
      supplier({ name: "Has disclosure", hasEsgDisclosure: true, spendSharePct: 50 }),
      supplier({ name: "Missing, small", hasEsgDisclosure: false, spendSharePct: 5 }),
      supplier({ name: "Missing, large", hasEsgDisclosure: false, spendSharePct: 40 }),
    ]);

    expect(s.rows).toHaveLength(3);
    expect(s.rows.map((r) => r.name)).toEqual(["Missing, large", "Missing, small", "Has disclosure"]);
  });

  /** "Not recorded" is not "small" — an unrecorded share must not sort as zero. */
  it("sorts suppliers with no recorded spend share last within their group", () => {
    const s = buildSupplierScorecard([
      supplier({ name: "No share", hasEsgDisclosure: false, spendSharePct: null }),
      supplier({ name: "Tiny share", hasEsgDisclosure: false, spendSharePct: 1 }),
    ]);

    expect(s.rows.map((r) => r.name)).toEqual(["Tiny share", "No share"]);
  });

  it("carries only fields Supplier actually holds, and never invents a review date", () => {
    const [row] = buildSupplierScorecard([
      supplier({ name: "Acme", sector: "Logistics", country: "India", riskFlag: "HIGH" }),
    ]).rows;

    expect(row).toMatchObject({
      name: "Acme",
      sector: "Logistics",
      country: "India",
      riskFlag: "HIGH",
      hasEsgDisclosure: false,
      disclosureType: null,
      spendSharePct: null,
      lastReviewedAt: null,
    });
    // No category state: there is none on Supplier, and GRI 308/414 are
    // company-level aggregates with nothing per-supplier to attribute back.
    expect(Object.keys(row)).not.toContain("categories");
  });

  it("has no rows when nothing is listed, even where GRI aggregates exist", () => {
    const s = buildSupplierScorecard([], [{ reportingPeriod: "FY2025-26", env: { newSuppliersScreenedPct: 80, suppliersAssessedCount: 4, suppliersWithNegativeImpactsCount: 1 } }]);
    expect(s.rows).toEqual([]);
    expect(s.gri.hasData).toBe(true);
  });
});
