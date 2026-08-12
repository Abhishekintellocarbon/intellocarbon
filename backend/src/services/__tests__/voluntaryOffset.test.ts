import { describe, expect, it } from "vitest";
import type { VoluntaryOffsetPurchase } from "@prisma/client";
import { summariseOffsets, OFFSET_CATEGORIES } from "../voluntaryOffset.service";
import { buildOffsetsSummary, type IssbOverviewSummary } from "../esgOverview.service";

/**
 * The offsets rollup is the one place this module does arithmetic, and both
 * the facility section and the ESG Overview card read it — so the DRAFT
 * exclusion and the per-category split are pinned here.
 */

const purchase = (
  over: Partial<VoluntaryOffsetPurchase> &
    Pick<VoluntaryOffsetPurchase, "tonnageTco2e" | "category" | "status">,
): VoluntaryOffsetPurchase =>
  ({
    id: `p-${Math.round(over.tonnageTco2e)}-${over.category}-${over.status}`,
    companyId: "c1",
    facilityId: "f1",
    registry: "VERRA",
    creditSerialNumber: "VCS-1234-5678",
    vintageYear: 2024,
    purchaseDate: new Date("2026-01-15T00:00:00.000Z"),
    notes: null,
    createdAt: new Date("2026-01-15T00:00:00.000Z"),
    updatedAt: new Date("2026-01-15T00:00:00.000Z"),
    ...over,
  }) as VoluntaryOffsetPurchase;

describe("summariseOffsets", () => {
  it("is zeroed, with every category present, when there are no purchases", () => {
    const totals = summariseOffsets([]);
    expect(totals.totalTonnage).toBe(0);
    expect(totals.purchaseCount).toBe(0);
    // All four keys exist so the UI can render a complete breakdown from an
    // empty state without special-casing missing categories.
    expect(Object.keys(totals.byCategory).sort()).toEqual([...OFFSET_CATEGORIES].sort());
  });

  it("counts SUBMITTED purchases only — a draft is not yet a claim", () => {
    const totals = summariseOffsets([
      purchase({ tonnageTco2e: 1_000, category: "REMOVAL_NATURE", status: "SUBMITTED" }),
      purchase({ tonnageTco2e: 500, category: "REMOVAL_NATURE", status: "DRAFT" }),
    ]);
    expect(totals.totalTonnage).toBe(1_000);
    expect(totals.purchaseCount).toBe(1);
    expect(totals.byCategory.REMOVAL_NATURE).toBe(1_000);
  });

  it("splits tonnage across the four categories and sums to the total", () => {
    const totals = summariseOffsets([
      purchase({ tonnageTco2e: 1_200.5, category: "AVOIDANCE_NATURE", status: "SUBMITTED" }),
      purchase({ tonnageTco2e: 800, category: "AVOIDANCE_ENGINEERED", status: "SUBMITTED" }),
      purchase({ tonnageTco2e: 450.25, category: "REMOVAL_NATURE", status: "SUBMITTED" }),
      purchase({ tonnageTco2e: 99.25, category: "REMOVAL_ENGINEERED", status: "SUBMITTED" }),
    ]);

    expect(totals.byCategory.AVOIDANCE_NATURE).toBe(1_200.5);
    expect(totals.byCategory.AVOIDANCE_ENGINEERED).toBe(800);
    expect(totals.byCategory.REMOVAL_NATURE).toBe(450.25);
    expect(totals.byCategory.REMOVAL_ENGINEERED).toBe(99.25);
    expect(totals.totalTonnage).toBe(2_550);
    const summed = OFFSET_CATEGORIES.reduce((s, c) => s + totals.byCategory[c], 0);
    expect(summed).toBeCloseTo(totals.totalTonnage, 6);
  });

  it("accumulates repeated purchases in the same category", () => {
    const totals = summariseOffsets([
      purchase({ tonnageTco2e: 300, category: "REMOVAL_ENGINEERED", status: "SUBMITTED" }),
      purchase({ tonnageTco2e: 700, category: "REMOVAL_ENGINEERED", status: "SUBMITTED" }),
    ]);
    expect(totals.byCategory.REMOVAL_ENGINEERED).toBe(1_000);
    expect(totals.purchaseCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// ESG Overview comparison against gross emissions
// ---------------------------------------------------------------------------

const issb = (over: Partial<IssbOverviewSummary> = {}): IssbOverviewSummary => ({
  hasReports: true,
  periodLabel: "FY2025-26",
  facilitiesReporting: 1,
  scope1Tco2e: 8_000,
  scope2Tco2e: 2_000,
  scope3Tco2e: null,
  totalTco2e: 10_000,
  nearestTargetYear: null,
  baselineYear: null,
  baselineEmissionsTco2e: null,
  changeFromBaselinePct: null,
  ...over,
});

describe("buildOffsetsSummary", () => {
  const rows = [
    { facilityId: "f1", status: "SUBMITTED" },
    { facilityId: "f2", status: "SUBMITTED" },
    { facilityId: "f3", status: "DRAFT" },
  ];

  it("subtracts offsets from the ISSB gross total and reports coverage", () => {
    const totals = summariseOffsets([
      purchase({ tonnageTco2e: 2_500, category: "REMOVAL_NATURE", status: "SUBMITTED" }),
    ]);
    const summary = buildOffsetsSummary(rows, totals, issb());

    expect(summary.grossEmissionsTco2e).toBe(10_000);
    expect(summary.netAfterOffsetsTco2e).toBe(7_500);
    expect(summary.offsetCoveragePct).toBe(25);
    // Named so the UI can say where the figure came from — this module never
    // computes emissions itself.
    expect(summary.grossEmissionsSource).toContain("ISSB");
  });

  it("counts only facilities with a submitted purchase", () => {
    const summary = buildOffsetsSummary(rows, summariseOffsets([]), issb());
    expect(summary.facilitiesReporting).toBe(2);
  });

  it("leaves the comparison null when no ISSB disclosure exists", () => {
    const totals = summariseOffsets([
      purchase({ tonnageTco2e: 1_000, category: "REMOVAL_NATURE", status: "SUBMITTED" }),
    ]);
    const summary = buildOffsetsSummary(rows, totals, issb({ hasReports: false, totalTco2e: 0 }));

    // Not 0 — there is nothing to compare against, and a zero residual would
    // read as "fully offset".
    expect(summary.grossEmissionsTco2e).toBeNull();
    expect(summary.netAfterOffsetsTco2e).toBeNull();
    expect(summary.offsetCoveragePct).toBeNull();
    expect(summary.totalTonnage).toBe(1_000);
  });

  it("can report a negative residual when offsets exceed gross emissions", () => {
    const totals = summariseOffsets([
      purchase({ tonnageTco2e: 12_000, category: "REMOVAL_ENGINEERED", status: "SUBMITTED" }),
    ]);
    const summary = buildOffsetsSummary(rows, totals, issb());
    // Deliberately not clamped: over-purchasing is a real position, and hiding
    // it would misreport the log.
    expect(summary.netAfterOffsetsTco2e).toBe(-2_000);
    expect(summary.offsetCoveragePct).toBe(120);
  });
});
