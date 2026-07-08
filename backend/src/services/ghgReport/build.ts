import type { GhgEngagement } from "@prisma/client";
import { GhgPageBuilder } from "./layout";
import { fmt, fmtDate, NAVY, NAVY_LIGHT, GREY } from "./theme";
import { GHG_JURISDICTIONS } from "../../data/ghgJurisdictions";
import type { GhgCalculationResult } from "../ghgCalculation.service";

const periodLabel = (start: Date, end: Date) => `${fmtDate(start)} – ${fmtDate(end)}`;

/**
 * Assembles the full white-label GHG Protocol Scope 1 + 2 inventory PDF —
 * cover, methodology, Scope 1 detail, Scope 2 detail, totals summary with a
 * simple chart, a fillable "Prepared by" block, and a disclaimers page.
 * Every number here comes from `calc`, already computed by
 * ghgCalculation.service.ts using the engagement's own frozen entries and
 * jurisdiction — this module only lays it out.
 */
export function buildGhgInventoryReport(doc: PDFKit.PDFDocument, engagement: GhgEngagement, calc: GhgCalculationResult) {
  const pb = new GhgPageBuilder(doc);
  const jurisdiction = GHG_JURISDICTIONS[engagement.jurisdiction];

  // ---- Cover ----
  pb.coverPage({
    title: "Greenhouse Gas Emissions Inventory",
    organizationName: engagement.organizationName,
    periodLabel: periodLabel(engagement.reportingPeriodStart, engagement.reportingPeriodEnd),
    jurisdictionLabel: jurisdiction.label,
    regulationLabel: jurisdiction.regulationLabel,
    preparedDate: fmtDate(new Date()),
  });

  // ---- Section 01 — Methodology ----
  pb.startSection(1, "Methodology");
  pb.paragraph(
    "This inventory was prepared in accordance with the GHG Protocol Corporate Accounting and Reporting Standard " +
      "(World Resources Institute / World Business Council for Sustainable Development). It covers direct (Scope 1) " +
      "and indirect, location-based (Scope 2) emissions for the reporting organization.",
  );

  pb.heading("Operational boundary");
  pb.paragraph(
    "Emissions are consolidated using the operational control approach: all sources over which the reporting " +
      "organization or its subsidiaries have full authority to introduce and implement operating policies are " +
      "included. Site count and organizational structure were supplied by the organization and have not been " +
      "independently verified.",
  );
  if (engagement.numberOfSites != null) {
    pb.keyValueRow("Sites within boundary (as reported)", String(engagement.numberOfSites));
  }
  pb.keyValueRow("Country", engagement.country);
  pb.keyValueRow("Reporting standard / jurisdiction", `${jurisdiction.label} — ${jurisdiction.regulationLabel}`);

  pb.heading("Global Warming Potentials applied");
  pb.paragraph(
    `All non-CO2 gases in this inventory are converted to CO2-equivalent using 100-year Global Warming Potentials ` +
      `from the ${calc.gwpScheme} table below. The same GWP table is applied to every emission source in this ` +
      `report — GWP values are never mixed across assessment reports within a single inventory.`,
  );
  pb.table({
    columns: [
      { header: "Gas", width: 120 },
      { header: "100-yr GWP", width: 120, align: "right" },
      { header: "Assessment report", width: 255 },
    ],
    rows: [
      ["CO2", fmt(jurisdiction.gwp.co2, 0), calc.gwpScheme],
      ["CH4 (fossil)", fmt(jurisdiction.gwp.ch4, 1), calc.gwpScheme],
      ["N2O", fmt(jurisdiction.gwp.n2o, 0), calc.gwpScheme],
    ],
  });
  pb.note(`Source: ${calc.gwpSource}`);

  // ---- Section 02 — Scope 1 ----
  pb.startSection(2, "Scope 1 — Direct Emissions");
  pb.paragraph("Direct emissions from sources owned or controlled by the organization — primarily on-site fuel combustion.");

  if (calc.scope1Results.length === 0) {
    pb.paragraph("No Scope 1 sources were reported for this period.", { color: GREY });
  } else {
    pb.table({
      columns: [
        { header: "Source", width: 130 },
        { header: "Quantity", width: 90, align: "right" },
        { header: "Factor applied", width: 175 },
        { header: "tCO2e", width: 100, align: "right" },
      ],
      rows: calc.scope1Results.map((r) => [r.label, `${fmt(r.quantity, 2)} ${r.unit}`, r.factorApplied, fmt(r.co2eTonnes, 2)]),
    });
    for (const r of calc.scope1Results) {
      pb.note(`${r.label}: ${r.source}`);
    }
  }
  pb.summaryBox("Scope 1 total", [["Total direct emissions", `${fmt(calc.scope1TotalTco2e, 2)} tCO2e`]]);

  // ---- Section 03 — Scope 2 ----
  pb.startSection(3, "Scope 2 — Indirect Emissions (Location-Based)");
  pb.paragraph(
    "Indirect emissions from purchased electricity, calculated using the location-based method — grid-average " +
      "emission factors for each country/grid the organization draws electricity from, entered and cited " +
      "individually rather than defaulted.",
  );

  if (calc.scope2Results.length === 0) {
    pb.paragraph("No Scope 2 sources were reported for this period.", { color: GREY });
  } else {
    pb.table({
      columns: [
        { header: "Source", width: 150 },
        { header: "Consumption", width: 110, align: "right" },
        { header: "Grid factor", width: 135, align: "right" },
        { header: "tCO2e", width: 100, align: "right" },
      ],
      rows: calc.scope2Results.map((r) => [
        r.label,
        `${fmt(r.quantityValue, 2)} ${r.quantityUnit}`,
        `${fmt(r.gridFactorValue, 4)} tCO2e/${r.quantityUnit}`,
        fmt(r.co2eTonnes, 2),
      ]),
    });
    for (const r of calc.scope2Results) {
      pb.note(`${r.label}: ${r.source}`);
    }
  }
  pb.summaryBox("Scope 2 total", [["Total indirect emissions (location-based)", `${fmt(calc.scope2TotalTco2e, 2)} tCO2e`]]);

  // ---- Section 04 — Total emissions summary ----
  pb.startSection(4, "Total Emissions Summary");
  pb.paragraph(`Combined Scope 1 and Scope 2 emissions for ${periodLabel(engagement.reportingPeriodStart, engagement.reportingPeriodEnd)}.`);
  pb.simpleBarChart(
    [
      { label: "Scope 1", value: calc.scope1TotalTco2e, color: NAVY },
      { label: "Scope 2", value: calc.scope2TotalTco2e, color: NAVY_LIGHT },
      { label: "Total", value: calc.totalTco2e, color: GREY },
    ],
    "tCO2e",
  );
  pb.summaryBox("Total emissions", [
    ["Scope 1 (direct)", `${fmt(calc.scope1TotalTco2e, 2)} tCO2e`],
    ["Scope 2 (indirect, location-based)", `${fmt(calc.scope2TotalTco2e, 2)} tCO2e`],
    ["Total (Scope 1 + Scope 2)", `${fmt(calc.totalTco2e, 2)} tCO2e`],
  ]);

  pb.heading("Prepared by");
  pb.filledLine("Name");
  pb.filledLine("Title");
  pb.filledLine("Firm");
  pb.filledLine("Date");

  // ---- Section 05 — Disclaimers and Assumptions ----
  pb.startSection(5, "Disclaimers and Assumptions");
  pb.paragraph(
    "This inventory is based on activity data and site information supplied by the reporting organization and has " +
      "not been independently verified or assured unless separately stated. Emission factors used are cited " +
      "individually against each source in Sections 02 and 03; no factor has been assumed without a named source.",
  );
  pb.paragraph(
    "Scope 3 (value chain) emissions are not included in this inventory. Scope 2 emissions are reported on a " +
      "location-based basis only; a market-based figure has not been calculated.",
  );
  pb.paragraph(
    "Emission totals are expressed in metric tonnes of CO2-equivalent (tCO2e), converted using the Global Warming " +
      `Potentials set out in Section 01 (${calc.gwpScheme}). Results should be reviewed against the reporting ` +
      "organization's own records before submission to any regulator or disclosure framework.",
  );

  pb.finalize();
}
