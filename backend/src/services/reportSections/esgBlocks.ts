/**
 * The Phase 2 ESG datasets, rendered for PDFs.
 *
 * One block per dataset, shared by every report that has a genuine place for
 * it, so GRI, BRSR, CSRD and CDP cannot end up describing the same waste or
 * energy figures differently. Each block:
 *
 *   - draws nothing at all when the company has entered no data for it, apart
 *     from the honest one-line absence its own service already words. Reports
 *     here never manufacture a section to fill a page.
 *   - prints the source note its service defines rather than a note written
 *     here, because those notes are what stop a figure being read against the
 *     wrong denominator (a BRSR-sourced renewable share and an
 *     activity-data-sourced one are not the same number).
 *   - carries the platform's standing disclaimers verbatim. Certificates,
 *     supplier risk flags and SBTi positions are the client's own records and
 *     no report may present them as verified.
 */
import type { PageBuilder } from "../cbamReport/layout";
import { MARGIN_X, CONTENT_WIDTH, MUTED, TEAL, fmt, fmtInt } from "../cbamReport/theme";
import { donutChart, percentBars, stackedBarTrend, CHART_SLATE, CHART_AMBER, CHART_BLUE, CHART_RED } from "../cbamReport/charts";
import {
  CIRCULARITY_SOURCE_LABELS,
  CIRCULARITY_SOURCE_NOTES,
  type CircularityRollup,
} from "../wasteCircularity.service";
import { ENERGY_MIX_SOURCE_LABELS, ENERGY_MIX_SOURCE_NOTES, type EnergyMixTrend } from "../energyMix.service";
import { REC_TRACKING_NOTICE, type RecCoverage } from "../recCoverage.service";
import { SUPPLIER_RISK_LABELS, SUPPLIER_SCORECARD_NOTICE, type SupplierScorecard } from "../supplierScorecard.service";
import { GOVERNANCE_DISCLOSURE_NOTICE, type GovernanceSummary } from "../governanceSummary.service";
import { PRODUCT_FOOTPRINT_METHOD, PRODUCT_FOOTPRINT_NOTICE, type ProductFootprintAllocation } from "../productFootprint.service";

// ---------------------------------------------------------------------------
// Waste and circularity
// ---------------------------------------------------------------------------

/**
 * The circularity rate and the diverted/disposed split.
 *
 * Complements a GRI 306 or BRSR Attribute 3 disclosure rather than repeating
 * it: those state the tonnages, this states the rate they imply and the
 * definition behind it. Where the rate is derived from BRSR's "recovered"
 * figure the service's own note says why that is close to, but not the same
 * as, GRI's "diverted from disposal" — printed here rather than paraphrased.
 */
export function drawCircularityBlock(pb: PageBuilder, circularity: CircularityRollup) {
  if (!circularity.hasData) {
    pb.paragraph(
      "No waste figures have been entered for this facility, so no circularity rate is reported.",
      { size: 9.5, color: MUTED },
    );
    return;
  }

  pb.summaryBox(
    "Circularity",
    [
      ["Waste generated", `${fmt(circularity.generatedTonnes, 2)} t`],
      ["Diverted from disposal", `${fmt(circularity.divertedTonnes, 2)} t`],
      ["Directed to disposal", `${fmt(circularity.disposalTonnes, 2)} t`],
      ...(circularity.hazardousTonnes != null
        ? ([["Of which hazardous", `${fmt(circularity.hazardousTonnes, 2)} t`]] as [string, string][])
        : []),
      [
        "Circularity rate",
        circularity.circularityRatePct != null ? `${fmt(circularity.circularityRatePct, 1)}%` : "Not calculable",
      ],
    ],
    { tone: "teal" },
  );

  if (circularity.generatedTonnes > 0) {
    pb.ensureSpace(180);
    pb.y = donutChart(pb.doc, {
      x: MARGIN_X,
      y: pb.y,
      diameter: 116,
      unit: "t",
      centerLabel: "Generated",
      segments: [
        { label: "Diverted from disposal", value: circularity.divertedTonnes, color: TEAL },
        { label: "Directed to disposal", value: circularity.disposalTonnes, color: CHART_SLATE },
      ],
    });
  }

  if (circularity.source) {
    pb.note(`Source: ${CIRCULARITY_SOURCE_LABELS[circularity.source]}. ${CIRCULARITY_SOURCE_NOTES[circularity.source]}`);
  }
  if (circularity.approximated) {
    pb.note(
      "This rate is approximated from the source above rather than computed from a full GRI 306-4 / 306-5 breakdown.",
    );
  }
  if (circularity.facilityCount > 1) {
    pb.note(`Aggregated across ${circularity.facilityCount} facilities.`);
  }
}

// ---------------------------------------------------------------------------
// Energy mix
// ---------------------------------------------------------------------------

/**
 * Renewable versus non-renewable energy, per reporting period.
 *
 * Stacked bars rather than a single-period donut because the question this
 * data answers is whether the share is moving, which one period cannot show.
 * Where only one period exists the bar still draws and the change line is
 * suppressed rather than reported as zero.
 */
export function drawEnergyMixBlock(pb: PageBuilder, energyMix: EnergyMixTrend) {
  if (!energyMix.hasData || energyMix.points.length === 0) {
    pb.paragraph(
      "No energy split has been entered for this facility, so no renewable share is reported.",
      { size: 9.5, color: MUTED },
    );
    return;
  }

  const latest = energyMix.points[energyMix.points.length - 1];

  pb.summaryBox(
    "Energy mix",
    [
      ["Reporting period", latest.periodLabel],
      ["Renewable", `${fmt(latest.renewableGj, 2)} GJ`],
      ["Non-renewable", `${fmt(latest.nonRenewableGj, 2)} GJ`],
      ["Total energy", `${fmt(latest.totalGj, 2)} GJ`],
      [
        "Renewable share",
        energyMix.latestRenewablePct != null ? `${fmt(energyMix.latestRenewablePct, 1)}%` : "Not calculable",
      ],
      ...(energyMix.changePoints != null
        ? ([
            [
              "Change since the earliest period shown",
              `${energyMix.changePoints >= 0 ? "+" : ""}${fmt(energyMix.changePoints, 1)} percentage points`,
            ],
          ] as [string, string][])
        : []),
    ],
    { tone: "teal" },
  );

  pb.ensureSpace(230);
  pb.y = stackedBarTrend(pb.doc, {
    x: MARGIN_X,
    y: pb.y,
    width: CONTENT_WIDTH,
    height: 150,
    unit: "GJ",
    shareSeriesIndex: 0,
    series: [
      { label: "Renewable", color: TEAL },
      { label: "Non-renewable", color: CHART_SLATE },
    ],
    points: energyMix.points.map((p) => ({ label: p.periodLabel, values: [p.renewableGj, p.nonRenewableGj] })),
  });
  pb.note("The figure above each bar is that period's renewable share of total energy.");

  if (energyMix.source) {
    pb.note(`Source: ${ENERGY_MIX_SOURCE_LABELS[energyMix.source]}. ${ENERGY_MIX_SOURCE_NOTES[energyMix.source]}`);
  }
}

// ---------------------------------------------------------------------------
// Renewable energy certificates
// ---------------------------------------------------------------------------

/**
 * REC coverage of grid electricity, by consumption year.
 *
 * Coverage is measured against grid electricity only — electricity already
 * reported as renewable carries its attribute without a certificate, and
 * counting it twice would overstate coverage. Certificates whose vintage
 * matches no consumption year are reported separately rather than quietly
 * folded into the total, because market-based accounting expects vintage to
 * match the year being claimed against.
 */
export function drawRecCoverageBlock(pb: PageBuilder, rec: RecCoverage) {
  if (!rec.hasData) {
    pb.paragraph(
      "No renewable energy certificates have been recorded for this organization, so no certificate-based coverage " +
        "is claimed here.",
      { size: 9.5, color: MUTED },
    );
    return;
  }

  pb.paragraph(
    "Certificates are held at organization level and matched to grid electricity by vintage year. This is the " +
      "organization's own certificate record, not a facility figure.",
    { size: 9.5 },
  );

  pb.table({
    columns: [
      { header: "Consumption year", width: 95 },
      { header: "Grid electricity", width: 100, align: "right" },
      { header: "Directly renewable", width: 105, align: "right" },
      { header: "Certificates matched", width: 105, align: "right" },
      { header: "Coverage", width: 90, align: "right" },
    ],
    rows: rec.periods.map((p) => [
      p.periodLabel,
      `${fmt(p.gridElectricityMwh, 2)} MWh`,
      `${fmt(p.directRenewableMwh, 2)} MWh`,
      `${fmt(p.recsMatchedMwh, 2)} MWh`,
      p.coveragePct != null ? `${fmt(p.coveragePct, 1)}%${p.overCovered ? " (over)" : ""}` : "—",
    ]),
  });

  const withCoverage = rec.periods.filter((p) => p.coveragePct != null);
  if (withCoverage.length > 0) {
    pb.ensureSpace(60 + withCoverage.length * 28);
    pb.y = percentBars(pb.doc, {
      x: MARGIN_X,
      y: pb.y,
      width: CONTENT_WIDTH,
      rows: withCoverage.map((p) => ({
        label: `${p.periodLabel} grid electricity`,
        pct: p.coveragePct,
        valueLabel: `${fmtInt(p.recsMatchedMwh)} / ${fmtInt(p.gridElectricityMwh)} MWh`,
        // Over-coverage is a data question, not an achievement — more
        // certificates than grid consumption in a year means the vintages or
        // the consumption figures need checking.
        color: p.overCovered ? CHART_AMBER : TEAL,
      })),
    });
  }

  if (rec.unmatchedMwh > 0) {
    pb.note(
      `${fmt(rec.unmatchedMwh, 2)} MWh of certificates (vintages ${rec.unmatchedRecs
        .map((u) => u.vintageYear)
        .join(", ")}) match no year with reported grid electricity and are excluded from the coverage above.`,
    );
  }

  pb.note(REC_TRACKING_NOTICE);
}

// ---------------------------------------------------------------------------
// Supplier ESG scorecard
// ---------------------------------------------------------------------------

/**
 * The named-supplier scorecard.
 *
 * Distinct from a GRI 308-1 / 414-1 screening percentage, which is a share of
 * *new* suppliers assessed. This is the register of suppliers the company has
 * actually listed, and coverage is explicitly of that list rather than of the
 * whole supply base — the standing wording in SUPPLIER_SCORECARD_NOTICE, which
 * is printed rather than summarised.
 */
export function drawSupplierScorecardBlock(pb: PageBuilder, suppliers: SupplierScorecard) {
  if (!suppliers.hasData || suppliers.supplierCount === 0) {
    pb.paragraph(
      "No suppliers have been listed in the supplier register, so no scorecard is reported here.",
      { size: 9.5, color: MUTED },
    );
    return;
  }

  pb.summaryBox(
    "Supplier register (organization level)",
    [
      ["Suppliers listed", fmtInt(suppliers.supplierCount)],
      ["With an ESG disclosure on file", fmtInt(suppliers.withDisclosureCount)],
      [
        "Disclosure coverage",
        suppliers.disclosureCoveragePct != null ? `${fmt(suppliers.disclosureCoveragePct, 1)}%` : "Not calculable",
      ],
      ...(suppliers.spendCoveredPct != null
        ? ([["Share of spend covered by the listed suppliers", `${fmt(suppliers.spendCoveredPct, 1)}%`]] as [string, string][])
        : []),
      ["High-risk suppliers with no disclosure", fmtInt(suppliers.highRiskWithoutDisclosure)],
    ],
    { tone: suppliers.highRiskWithoutDisclosure > 0 ? "neutral" : "teal" },
  );

  const risk = suppliers.riskBreakdown;
  const rated = risk.LOW + risk.MEDIUM + risk.HIGH;
  if (rated > 0) {
    pb.ensureSpace(170);
    pb.y = donutChart(pb.doc, {
      x: MARGIN_X,
      y: pb.y,
      diameter: 110,
      unit: "suppliers",
      centerLabel: "Risk-flagged",
      segments: [
        { label: SUPPLIER_RISK_LABELS.LOW, value: risk.LOW, color: TEAL },
        { label: SUPPLIER_RISK_LABELS.MEDIUM, value: risk.MEDIUM, color: CHART_AMBER },
        { label: SUPPLIER_RISK_LABELS.HIGH, value: risk.HIGH, color: CHART_RED },
      ],
    });
  }

  pb.note(SUPPLIER_SCORECARD_NOTICE);
}

// ---------------------------------------------------------------------------
// Governance
// ---------------------------------------------------------------------------

/**
 * Board structure and the policy coverage checklist.
 *
 * Gathered from whichever framework disclosures the company has already filed
 * — GRI 2, ESRS 2/G1, CDP C1 — rather than collected again, so each row names
 * the disclosure it came from. A row reading "not disclosed" means exactly
 * that: no framework the company has filed carries it.
 */
export function drawGovernanceBlock(pb: PageBuilder, governance: GovernanceSummary) {
  if (!governance.hasAnyData) {
    pb.paragraph(
      "No governance disclosures have been filed under any framework on this platform, so no governance summary is " +
        "reported here.",
      { size: 9.5, color: MUTED },
    );
    return;
  }

  const board = governance.boardStructure;
  if (board.hasData) {
    pb.summaryBox(
      "Board structure",
      [
        ["Total members", board.totalMembers != null ? fmtInt(board.totalMembers) : "Not disclosed"],
        ["Executive members", board.executiveMembers != null ? fmtInt(board.executiveMembers) : "Not disclosed"],
        [
          "Non-executive members",
          board.nonExecutiveMembers != null ? fmtInt(board.nonExecutiveMembers) : "Not disclosed",
        ],
        ["Independent", board.independentPct != null ? `${fmt(board.independentPct, 1)}%` : "Not disclosed"],
        [
          "Gender diversity",
          board.genderDiversityPct != null ? `${fmt(board.genderDiversityPct, 1)}%` : "Not disclosed",
        ],
        [
          "Chair is a senior executive",
          board.chairIsSeniorExecutive == null ? "Not disclosed" : board.chairIsSeniorExecutive ? "Yes" : "No",
        ],
      ],
      { tone: "teal" },
    );
    if (board.source) pb.note(`Board structure sourced from ${board.source}.`);
  }

  pb.heading("Policy and oversight coverage");
  pb.table({
    columns: [
      { header: "Disclosure", width: 235 },
      { header: "Status", width: 100 },
      { header: "Sourced from", width: 160 },
    ],
    rows: governance.policies.map((p) => [
      p.label,
      p.state === "DISCLOSED" ? "Disclosed" : "Not disclosed",
      p.source,
    ]),
  });

  pb.ensureSpace(60);
  pb.y = percentBars(pb.doc, {
    x: MARGIN_X,
    y: pb.y,
    width: CONTENT_WIDTH,
    rows: [
      {
        label: "Governance disclosures on file",
        pct: governance.totalCount > 0 ? (governance.disclosedCount / governance.totalCount) * 100 : null,
        valueLabel: `${governance.disclosedCount} of ${governance.totalCount}`,
      },
    ],
  });

  pb.note(GOVERNANCE_DISCLOSURE_NOTICE);
}

// ---------------------------------------------------------------------------
// Product carbon footprint per SKU
// ---------------------------------------------------------------------------

/**
 * Per-SKU allocation of the facility's Scope 1 + 2 emissions.
 *
 * An allocation, not a life-cycle assessment, and the block says so twice —
 * in its own words and in the standing PRODUCT_FOOTPRINT_NOTICE. It carries no
 * upstream or downstream emissions and is not comparable to a cradle-to-gate
 * PCF, which is exactly the misreading a per-SKU tCO2e figure invites.
 *
 * Renders nothing where no SKU has been entered — the caller shows the
 * allocator's own one-line reason instead of an empty annex.
 */
export function drawProductFootprintBlock(pb: PageBuilder, footprint: ProductFootprintAllocation) {
  if (!footprint.hasData || footprint.skus.length === 0) {
    pb.paragraph(footprint.unavailableReason ?? "No product-level data has been entered for this period.", {
      size: 9.5,
      color: MUTED,
    });
    return;
  }

  pb.summaryBox(
    "Allocation basis",
    [
      ["Reporting period", footprint.periodLabel ?? "Not stated"],
      ["Method", PRODUCT_FOOTPRINT_METHOD],
      ["Facility Scope 1 + 2 allocated", `${fmt(footprint.facilityEmissionsTco2e, 2)} tCO2e`],
      ["Output covered by the listed products", `${fmt(footprint.allocatedQuantity, 2)}`],
      [
        "Share of facility output covered",
        footprint.productionCoveragePct != null ? `${fmt(footprint.productionCoveragePct, 1)}%` : "Not calculable",
      ],
    ],
    { tone: "teal" },
  );

  pb.table({
    columns: [
      { header: "Product", width: 165 },
      { header: "SKU code", width: 80 },
      { header: "Output", width: 90, align: "right" },
      { header: "Share", width: 60, align: "right" },
      { header: "Footprint", width: 100, align: "right" },
    ],
    rows: footprint.skus.map((s) => [
      s.name,
      s.skuCode ?? "—",
      `${fmt(s.productionQuantity, 2)} ${s.unit}`,
      `${fmt(s.allocationSharePct, 1)}%`,
      `${fmt(s.perUnitKgCo2e, 3)} kgCO2e/${s.unit.replace(/s$/, "")}`,
    ]),
  });

  if (footprint.skus.length > 1) {
    pb.ensureSpace(60 + footprint.skus.length * 28);
    pb.y = percentBars(pb.doc, {
      x: MARGIN_X,
      y: pb.y,
      width: CONTENT_WIDTH,
      rows: footprint.skus.map((s) => ({
        label: s.name,
        pct: s.allocationSharePct,
        valueLabel: `${fmt(s.allocatedTco2e, 0)} tCO2e`,
        color: CHART_BLUE,
      })),
    });
    pb.note("Share of the allocated emissions carried by each product, by output volume.");
  }

  if (footprint.productionCoveragePct != null && footprint.productionCoveragePct < 99.5) {
    pb.note(
      `The products listed account for ${fmt(footprint.productionCoveragePct, 1)}% of this facility's reported output. ` +
        "Emissions are allocated across the listed products only, so the per-unit figures are unaffected by the " +
        "uncovered remainder rather than being diluted by it.",
    );
  }

  pb.note(PRODUCT_FOOTPRINT_NOTICE);
}
