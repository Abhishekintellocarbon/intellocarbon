import path from "path";
import type { ReportContext } from "../report.service";
import { computeCbamFinancialImpact, type CbamFinancialImpact } from "../cbamFinancialImpact.service";
import { PageBuilder } from "../cbamReport/layout";
import { buildVerifyQr } from "../cbamReport/qr";
import { verificationStatusLabel, cctsPositionLabel, productionRouteLabel } from "../cbamReport/build";
import {
  TEAL,
  TEAL_DARK,
  NAVY,
  MUTED,
  BORDER,
  MARGIN_X,
  CONTENT_WIDTH,
  fmt,
  fmtInt,
  fmtDate,
} from "../cbamReport/theme";
import { donutChart, gaugeBar, verticalBarChart, CHART_BLUE, CHART_AMBER, CHART_SLATE } from "../cbamReport/charts";
import {
  FUEL_LIBRARY,
  PROCESS_MATERIAL_LIBRARY,
  PRECURSOR_LIBRARY,
  DEFAULT_GRID_EMISSION_FACTOR,
  DEFAULT_GRID_EMISSION_FACTOR_SOURCE,
  DEFAULT_STEAM_EMISSION_FACTOR,
} from "../../data/emissionFactors";
import { GWP_AR2_BUR3 } from "../../data/gwpTables";

const LOGO_PATH = path.join(__dirname, "../../assets/logo-full.png");
const EMISSION_FACTOR_SOURCE = "IPCC 2006 Guidelines for National GHG Inventories (Tier-1) — India GHG Programme";

const UNIT_LABELS: Record<string, string> = {
  TONNE: "t",
  KILOLITRE: "kl",
  THOUSAND_NM3: "'000 Nm³",
  GJ: "GJ",
};

interface SectorBreakdown {
  calcination?: { limestoneInputTonnes: number; emissionFactorUsed: number; clinkerConversionFraction: number; co2Tonnes: number };
  fertilizerFeedstock?: { naturalGasFeedstockNm3: number; emissionFactorUsed: number; co2Tonnes: number };
  pfc?: { cf4Tonnes: number; c2f6Tonnes: number; anodeEffectMinutes: number | null; co2eAr5: number; co2eAr4: number };
  n2oProcess?: { n2oTonnes: number; abatementFactorPct: number; netN2oTonnes: number; co2eAr5: number; co2eAr4: number };
}

/** Full 11-section CCTS GHG Intensity Report — mirrors the CBAM Communication Package's design system exactly. */
export const buildCctsGhgIntensityReport = async (doc: PDFKit.PDFDocument, ctx: ReportContext) => {
  // Reused from the CBAM financial-impact calculator purely for the stable report
  // reference number and the already-computed CCTS CCC surplus/deficit position —
  // no CBAM-specific figures (liability, certificates) are read from it here.
  const financials = computeCbamFinancialImpact(ctx, "CCTS");
  const pb = new PageBuilder(doc, financials.reportReference, LOGO_PATH);
  const qr = await buildVerifyQr(financials.reportReference);

  buildCoverPage(pb, ctx, financials, qr);
  pb.startTocPage();
  buildExecutiveSummary(pb, ctx, financials);
  buildEntityFacilityProduction(pb, ctx);
  buildIntensityResults(pb, ctx, financials);
  buildCombustion(pb, ctx);
  buildProcess(pb, ctx);
  buildIndirectAndPrecursors(pb, ctx);
  buildMethodology(pb);
  buildVerification(pb, ctx);
  buildDeclarationAnnexures(pb, ctx);

  pb.finalize();
};

// ---------------------------------------------------------------------------
// Cover
// ---------------------------------------------------------------------------

function buildCoverPage(
  pb: PageBuilder,
  ctx: ReportContext,
  financials: CbamFinancialImpact,
  qr: { buffer: Buffer; url: string },
) {
  const result = ctx.calculationResult!;
  const unit = ctx.sector === "ELECTRICITY" ? "tCO2e/MWh" : "tCO2e/t";
  const pos = financials.cctsPosition;

  const heroDelta = pos.pending
    ? { text: "Target pending BEE notification", tone: "amber" as const }
    : pos.isSurplus
      ? { text: `${fmt(Math.abs(pos.deltaTco2e), 2)} tCO2e surplus vs. notified target`, tone: "green" as const }
      : { text: `${fmt(Math.abs(pos.deltaTco2e), 2)} tCO2e deficit vs. notified target`, tone: "red" as const };

  pb.coverShell({
    logoPath: LOGO_PATH,
    eyebrow: "Regulatory Reporting Document",
    title: "CCTS GHG Intensity Report",
    subtitle: "India Carbon Credit Trading Scheme — GHG Emission Intensity Report",
    heroLabel: "GHG Emission Intensity",
    heroValue: `${fmt(result.ghgIntensityCcts)} ${unit}`,
    heroDelta,
    referenceBadge: financials.reportReference,
    controlTitle: "Document Control",
    controlRows: [
      ["Document ID", financials.reportReference],
      ["Version", "v1.0"],
      ["Classification", "Confidential — Regulatory Submission"],
      ["Distribution", "Company Admin, BEE-Accredited Verifier"],
      ["Generated", fmtDate(new Date())],
      ["Reporting period", `${fmtDate(ctx.periodStart)} – ${fmtDate(ctx.periodEnd)}`],
    ],
    qrPngBuffer: qr.buffer,
    qrCaption: "Scan to verify",
    qrUrl: qr.url,
    docIdBadge: `DOC ID  ${financials.reportReference}  ·  v1.0`,
    confidentialityText:
      "This document is classified Confidential — Regulatory Submission and is intended solely for the named distribution list above. Unauthorised copying or distribution is prohibited. © 2026 Intellocarbon Solutions Private Limited.",
  });
}

// ---------------------------------------------------------------------------
// Section 01 — Executive Summary
// ---------------------------------------------------------------------------

function buildExecutiveSummary(pb: PageBuilder, ctx: ReportContext, financials: CbamFinancialImpact) {
  pb.startSection(1, "Executive Summary");

  const result = ctx.calculationResult!;
  const unit = ctx.sector === "ELECTRICITY" ? "tCO2e/MWh" : "tCO2e/t";
  const quantityLabel =
    ctx.sector === "ELECTRICITY"
      ? `${fmtInt(ctx.electricityExportedEuMwh ?? 0)} MWh exported to the EU`
      : `${fmtInt(ctx.productionQuantityT)} tonnes of ${ctx.productCategory}`;

  pb.paragraph(
    `This report presents the GHG Emission Intensity computed for ${ctx.facility.name} (${ctx.facility.company.name}) ` +
      `under India's Carbon Credit Trading Scheme (CCTS) for the reporting period ${fmtDate(ctx.periodStart)} – ` +
      `${fmtDate(ctx.periodEnd)}, covering ${quantityLabel}.`,
  );

  const pos = financials.cctsPosition;
  pb.summaryBox(
    "Key Findings",
    [
      ["GHG Emission Intensity (actual)", `${fmt(result.ghgIntensityCcts)} ${unit}`],
      ["Notified target intensity", pos.pending ? "Pending BEE notification" : `${fmt(pos.targetIntensity)} ${unit}`],
      ["Surplus / deficit position", cctsPositionLabel(financials)],
      ["Total GHG emissions (AR2/BUR3)", `${fmt(result.totalEmissionsCctsAr4, 2)} tCO2e`],
      ["Verification status", verificationStatusLabel(ctx)],
    ],
    { tone: "teal" },
  );

  const badgeTone = pos.pending ? "amber" : pos.isSurplus ? "green" : "red";
  const badgeText = pos.pending ? "TARGET PENDING" : pos.isSurplus ? "SURPLUS" : "DEFICIT";
  pb.statusBadge(badgeText, badgeTone, MARGIN_X, pb.y);
  pb.y += 30;

  pb.note(
    "The CCC surplus/deficit position is illustrative pending the Bureau of Energy Efficiency's formal notification cycle for this sub-sector — see Section 03 for the comparison against the notified target.",
  );
}

// ---------------------------------------------------------------------------
// Section 02 — Reporting Entity and Facility Details
// ---------------------------------------------------------------------------

function buildEntityFacilityProduction(pb: PageBuilder, ctx: ReportContext) {
  pb.startSection(2, "Reporting Entity, Facility and Production Data");

  const { facility } = ctx;
  const { company } = facility;

  const companyRows: [string, string][] = [
    ["Company name", company.name],
    ["Registration number", company.registrationNumber || "Not provided"],
    ["Sector", company.sector],
    ["Location", [company.city, company.state, company.country].filter(Boolean).join(", ") || "Not provided"],
  ];

  const facilityRows: [string, string][] = [
    ["Facility name", facility.name],
    ["Facility type", (facility.facilityType ?? "Not provided").toString().replace(/_/g, " ")],
    ["Production route", productionRouteLabel(ctx.sector, facility.productionRoute)],
    [
      "Installed capacity",
      facility.installedCapacityTpa ? `${facility.installedCapacityTpa.toLocaleString("en-IN")} tonnes/year` : "Not provided",
    ],
  ];

  pb.keyValueColumns("COMPANY", companyRows, "FACILITY", facilityRows);

  pb.heading("Production and Reporting Period Data");
  pb.paragraph(
    "The table below summarises the production quantity and reporting period this GHG Emission Intensity figure is calculated against.",
  );

  const volumeLabel = ctx.sector === "ELECTRICITY" ? "Volume (MWh)" : "Volume (t)";
  const volumeValue =
    ctx.sector === "ELECTRICITY" ? fmtInt(ctx.electricityExportedEuMwh ?? 0) : fmtInt(ctx.productionQuantityT);

  pb.table({
    columns: [
      { header: "Product category", width: 160 },
      { header: volumeLabel, width: 90, align: "right" },
      { header: "Reporting period", width: 160 },
      { header: "Production route", width: 85 },
    ],
    rows: [
      [
        ctx.productCategory,
        volumeValue,
        `${fmtDate(ctx.periodStart)} – ${fmtDate(ctx.periodEnd)}`,
        productionRouteLabel(ctx.sector, ctx.facility.productionRoute),
      ],
    ],
  });
}

// ---------------------------------------------------------------------------
// Section 03 — GHG Intensity Results
// ---------------------------------------------------------------------------

function buildIntensityResults(pb: PageBuilder, ctx: ReportContext, financials: CbamFinancialImpact) {
  pb.startSection(3, "GHG Intensity Results");

  const result = ctx.calculationResult!;
  const production = ctx.sector === "ELECTRICITY" ? (ctx.electricityExportedEuMwh ?? 0) : ctx.productionQuantityT;
  const unit = ctx.sector === "ELECTRICITY" ? "tCO2e/MWh" : "tCO2e/t";
  const pos = financials.cctsPosition;

  pb.paragraph(
    "GHG Emission Intensity is calculated as total direct and indirect emissions (Scope 1 + Scope 2), plus embedded emissions from precursor materials, divided by production quantity, using IPCC AR2/BUR3 100-year Global Warming Potentials as gazetted for CCTS.",
  );

  pb.ensureSpace(110);
  pb.heading("Actual vs. Notified Target");
  pb.y = gaugeBar(pb.doc, {
    x: MARGIN_X,
    y: pb.y,
    width: CONTENT_WIDTH,
    unit,
    pending: pos.pending,
    actualValue: result.ghgIntensityCcts,
    targetValue: pos.pending ? undefined : pos.targetIntensity,
  });

  pb.ensureSpace(240);
  pb.heading("Emission Source Composition");
  pb.y = donutChart(pb.doc, {
    x: MARGIN_X,
    y: pb.y,
    diameter: 130,
    unit: "tCO2e",
    centerLabel: "Total (AR2/BUR3)",
    segments: [
      { label: "Combustion", value: result.directCombustionCo2eAr4, color: TEAL },
      { label: "Process", value: result.directProcessCo2e, color: CHART_BLUE },
      { label: "Indirect", value: result.indirectElectricityCo2e + result.indirectSteamCo2e, color: CHART_AMBER },
      { label: "Precursors", value: result.directPrecursorCo2e, color: CHART_SLATE },
    ],
  });

  pb.formulaBlock(
    "GHG Emission Intensity",
    [
      ["Direct emissions (Scope 1, AR2/BUR3)", `${fmt(result.totalDirectCo2eAr4, 2)} tCO2e`],
      ["Indirect emissions (Scope 2)", `${fmt(result.indirectElectricityCo2e + result.indirectSteamCo2e, 2)} tCO2e`],
      ["Precursor embedded emissions", `${fmt(result.directPrecursorCo2e, 2)} tCO2e`],
      ["Production quantity", `${fmtInt(production)} ${ctx.sector === "ELECTRICITY" ? "MWh" : "t"}`],
    ],
    "GHG Intensity",
    `${fmt(result.totalEmissionsCctsAr4, 2)} tCO2e ÷ ${fmtInt(production)} ${ctx.sector === "ELECTRICITY" ? "MWh" : "t"} = ${fmt(result.ghgIntensityCcts)} ${unit}`,
  );

  if (!pos.pending) {
    pb.note(
      `Against the notified target of ${fmt(pos.targetIntensity)} ${unit}, this facility holds a ${pos.isSurplus ? "surplus" : "deficit"} of ${fmt(Math.abs(pos.deltaTco2e), 2)} tCO2e for the reporting period, equivalent to ${fmtInt(Math.abs(pos.deltaTco2e))} Carbon Credit Certificates (CCCs) ${pos.isSurplus ? "available for sale" : "required to be purchased"}.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Section 05 — Direct Emissions — Combustion
// ---------------------------------------------------------------------------

function buildCombustion(pb: PageBuilder, ctx: ReportContext) {
  pb.startSection(4, "Direct Emissions — Combustion");

  pb.paragraph(
    "Combustion emissions from fuels charged directly to furnaces, boilers and other combustion equipment at the installation, converted to CO2e using IPCC AR2/BUR3 Global Warming Potentials as gazetted for CCTS.",
  );

  if (ctx.fuelEntries.length === 0) {
    pb.note("No fuel combustion entries recorded for this reporting period.");
    return;
  }

  // Computed once and shared between the table and the fuel-wise chart below,
  // so the two can never drift apart on the same report.
  let subtotal = 0;
  const fuelBreakdown = ctx.fuelEntries.map((entry) => {
    const def = FUEL_LIBRARY[entry.fuelType];
    const efCo2 = entry.emissionFactorOverrideCo2 ?? def.efCo2PerUnit;
    const co2Tonnes = entry.quantity * efCo2;
    const ch4Kg = entry.quantity * def.efCh4PerUnit;
    const n2oKg = entry.quantity * def.efN2oPerUnit;
    const co2eAr4 = co2Tonnes + (ch4Kg / 1000) * GWP_AR2_BUR3.ch4 + (n2oKg / 1000) * GWP_AR2_BUR3.n2o;
    subtotal += co2eAr4;
    return { label: def.label, quantity: entry.quantity, unit: entry.unit, efCo2, co2eAr4 };
  });

  const rows: (string | number)[][] = fuelBreakdown.map((f) => [
    f.label,
    fmt(f.quantity, 2),
    UNIT_LABELS[f.unit] ?? f.unit,
    `${fmt(f.efCo2, 3)} t/unit^1`,
    fmt(f.co2eAr4, 2),
  ]);
  rows.push(["Subtotal — Combustion (AR2/BUR3)", "", "", "", fmt(subtotal, 2)]);

  pb.table({
    columns: [
      { header: "Fuel type", width: 145 },
      { header: "Quantity", width: 70, align: "right" },
      { header: "Unit", width: 65 },
      { header: "Emission factor", width: 105, align: "right" },
      { header: "tCO2e", width: 110, align: "right" },
    ],
    rows,
    highlightRowIndex: rows.length - 1,
  });

  pb.note(
    `¹ Emission factors are Tier-1 defaults; the applicable source is ${EMISSION_FACTOR_SOURCE}. Overridden factors reflect facility-specific data supplied at data entry. Non-CO2 gases converted using ${GWP_AR2_BUR3.label} — see Section 07.`,
  );

  pb.ensureSpace(260);
  pb.heading("Fuel-wise Combustion Emissions");
  pb.y = verticalBarChart(pb.doc, {
    x: MARGIN_X,
    y: pb.y,
    width: CONTENT_WIDTH,
    height: 150,
    unit: "tCO2e",
    data: fuelBreakdown.map((f) => ({ label: f.label, value: f.co2eAr4 })),
  });
}

// ---------------------------------------------------------------------------
// Section 06 — Direct Emissions — Process
// ---------------------------------------------------------------------------

function buildProcess(pb: PageBuilder, ctx: ReportContext) {
  pb.startSection(5, "Direct Emissions — Process");

  pb.paragraph(
    "Process emissions from flux/carbonate calcination, anode carbon oxidation, and other sector-specific process reactions. Purchased precursor materials are reported as embedded emissions in Section 06 — Indirect Emissions and Precursor Embedded Emissions.",
  );

  const breakdown = (ctx.calculationResult?.breakdown ?? {}) as SectorBreakdown;

  if (ctx.processMaterialEntries.length === 0 && !breakdown.calcination && !breakdown.fertilizerFeedstock) {
    pb.note("No process material entries recorded for this reporting period.");
  } else {
    let subtotal = 0;
    const rows: (string | number)[][] = ctx.processMaterialEntries.map((entry) => {
      const def = PROCESS_MATERIAL_LIBRARY[entry.materialType];
      const efUsed = entry.emissionFactorOverride ?? def.efCo2PerTonne;
      const co2 = entry.quantityTonnes * efUsed;
      subtotal += co2;
      return [def.label, fmt(entry.quantityTonnes, 2), `${fmt(efUsed, 3)} tCO2/t^1`, fmt(co2, 2)];
    });

    if (breakdown.calcination) {
      subtotal += breakdown.calcination.co2Tonnes;
      rows.push([
        "Limestone calcination (cement)",
        fmt(breakdown.calcination.limestoneInputTonnes, 2),
        `${fmt(breakdown.calcination.emissionFactorUsed, 3)} tCO2/t CaCO3 x ${fmt(breakdown.calcination.clinkerConversionFraction, 2)}`,
        fmt(breakdown.calcination.co2Tonnes, 2),
      ]);
    }
    if (breakdown.fertilizerFeedstock) {
      subtotal += breakdown.fertilizerFeedstock.co2Tonnes;
      rows.push([
        "Natural gas feedstock carbon (ammonia)",
        `${fmt(breakdown.fertilizerFeedstock.naturalGasFeedstockNm3, 2)} '000 Nm3`,
        `${fmt(breakdown.fertilizerFeedstock.emissionFactorUsed, 3)} tCO2/'000 Nm3`,
        fmt(breakdown.fertilizerFeedstock.co2Tonnes, 2),
      ]);
    }
    rows.push(["Subtotal — Process", "", "", fmt(subtotal, 2)]);

    pb.table({
      columns: [
        { header: "Process material", width: 175 },
        { header: "Quantity (t)", width: 80, align: "right" },
        { header: "Emission factor", width: 140, align: "right" },
        { header: "tCO2e", width: 100, align: "right" },
      ],
      rows,
      highlightRowIndex: rows.length - 1,
    });
    pb.note(`¹ ${EMISSION_FACTOR_SOURCE}.`);
  }

  if (breakdown.pfc) {
    pb.heading("PFC emissions — anode effects (aluminium)");
    pb.paragraph(
      "Perfluorocarbons (CF4, C2F6) released during anode effects in Hall-Héroult electrolysis cells. CCTS uses the AR2/BUR3-gazetted GWPs under S.O. 2825(E), unlike CBAM which uses IPCC AR5.",
    );
    pb.table({
      columns: [
        { header: "Gas", width: 110 },
        { header: "Quantity (t)", width: 110, align: "right" },
        { header: "GWP (CCTS/AR2)", width: 130, align: "right" },
        { header: "tCO2e (CCTS/AR2)", width: 145, align: "right" },
      ],
      rows: [
        ["CF4", fmt(breakdown.pfc.cf4Tonnes, 3), fmt(GWP_AR2_BUR3.cf4 ?? 0, 0), fmt(breakdown.pfc.cf4Tonnes * (GWP_AR2_BUR3.cf4 ?? 0), 2)],
        ["C2F6", fmt(breakdown.pfc.c2f6Tonnes, 3), fmt(GWP_AR2_BUR3.c2f6 ?? 0, 0), fmt(breakdown.pfc.c2f6Tonnes * (GWP_AR2_BUR3.c2f6 ?? 0), 2)],
        ["Subtotal — PFC (CCTS/AR2)", "", "", fmt(breakdown.pfc.co2eAr4, 2)],
      ],
      highlightRowIndex: 2,
    });
  }

  if (breakdown.n2oProcess) {
    pb.heading("N2O process emissions — nitric acid (fertilizer)");
    pb.paragraph(
      "Nitrous oxide released during nitric acid production (Ostwald process), net of any catalytic abatement installed.",
    );
    pb.table({
      columns: [
        { header: "N2O emitted (t)", width: 140, align: "right" },
        { header: "Abatement", width: 115, align: "right" },
        { header: "Net N2O (t)", width: 125, align: "right" },
        { header: "tCO2e (CCTS/AR2)", width: 115, align: "right" },
      ],
      rows: [[
        fmt(breakdown.n2oProcess.n2oTonnes, 3),
        `${fmt(breakdown.n2oProcess.abatementFactorPct, 1)}%`,
        fmt(breakdown.n2oProcess.netN2oTonnes, 3),
        fmt(breakdown.n2oProcess.co2eAr4, 2),
      ]],
    });
  }
}

// ---------------------------------------------------------------------------
// Section 06 — Indirect Emissions and Precursor Embedded Emissions
// ---------------------------------------------------------------------------

function buildIndirectAndPrecursors(pb: PageBuilder, ctx: ReportContext) {
  pb.startSection(6, "Indirect Emissions and Precursor Embedded Emissions");

  pb.paragraph("Emissions embedded in purchased electricity and imported steam.");

  const gridEfUsed = ctx.gridEmissionFactorOverride ?? DEFAULT_GRID_EMISSION_FACTOR;
  const gridSource = ctx.gridEmissionFactorOverride != null ? "Facility override" : "CEA FY2025-26";
  const electricityCo2e = ctx.gridElectricityMwh * gridEfUsed;

  const rows: (string | number)[][] = [
    ["Grid electricity", fmt(ctx.gridElectricityMwh, 2), "MWh", `${fmt(gridEfUsed, 3)} tCO2/MWh^1`, gridSource, fmt(electricityCo2e, 2)],
  ];

  if (ctx.renewableElectricityMwh > 0) {
    rows.push(["Renewable electricity", fmt(ctx.renewableElectricityMwh, 2), "MWh", "0.000 tCO2/MWh", "Zero-rated", "0.00"]);
  }

  let steamCo2e = 0;
  if (ctx.steamImportedGj > 0) {
    const steamEfUsed = ctx.steamEmissionFactorOverride ?? DEFAULT_STEAM_EMISSION_FACTOR;
    steamCo2e = ctx.steamImportedGj * steamEfUsed;
    rows.push([
      "Imported steam",
      fmt(ctx.steamImportedGj, 2),
      "GJ",
      `${fmt(steamEfUsed, 4)} tCO2/GJ`,
      ctx.steamEmissionFactorOverride != null ? "Facility override" : "Facility default",
      fmt(steamCo2e, 2),
    ]);
  }

  rows.push(["Subtotal — Indirect", "", "", "", "", fmt(electricityCo2e + steamCo2e, 2)]);

  pb.table({
    columns: [
      { header: "Energy source", width: 115 },
      { header: "Quantity", width: 65, align: "right" },
      { header: "Unit", width: 40 },
      { header: "Emission factor", width: 105, align: "right" },
      { header: "Reference", width: 90 },
      { header: "tCO2e", width: 80, align: "right" },
    ],
    rows,
    highlightRowIndex: rows.length - 1,
  });

  pb.note(`¹ Grid emission factor default: ${fmt(DEFAULT_GRID_EMISSION_FACTOR, 3)} tCO2/MWh — ${DEFAULT_GRID_EMISSION_FACTOR_SOURCE}.`);

  pb.heading("Precursor Embedded Emissions");
  pb.paragraph(
    "Embedded emissions in purchased precursor materials sourced from external suppliers. These fall within the CCTS GHG Emission Intensity boundary on the same mass-balance basis described in Section 07.",
  );

  if (ctx.precursorEntries.length === 0) {
    pb.note("No precursor material entries recorded for this reporting period.");
    return;
  }

  let precursorSubtotal = 0;
  const precursorRows: (string | number)[][] = ctx.precursorEntries.map((entry) => {
    const def = PRECURSOR_LIBRARY[entry.materialType];
    const efUsed = entry.embeddedEmissionFactorOverride ?? def.defaultEmbeddedFactor;
    const co2e = entry.quantityTonnes * efUsed;
    precursorSubtotal += co2e;
    return [
      def.label,
      entry.sourceLabel || "Not specified",
      fmt(entry.quantityTonnes, 2),
      entry.embeddedEmissionFactorOverride != null ? "Verified / override" : "Tier-1 default",
      fmt(efUsed, 3),
      fmt(co2e, 2),
    ];
  });
  precursorRows.push(["Subtotal — Precursors", "", "", "", "", fmt(precursorSubtotal, 2)]);

  pb.table({
    columns: [
      { header: "Precursor material", width: 115 },
      { header: "Source / country", width: 115 },
      { header: "Quantity (t)", width: 62, align: "right" },
      { header: "Basis", width: 88 },
      { header: "EF (t/t)", width: 45, align: "right" },
      { header: "tCO2e", width: 70, align: "right" },
    ],
    rows: precursorRows,
    highlightRowIndex: precursorRows.length - 1,
  });
}

// ---------------------------------------------------------------------------
// Section 07 — Calculation Methodology
// ---------------------------------------------------------------------------

function buildMethodology(pb: PageBuilder) {
  pb.startSection(7, "Calculation Methodology");

  pb.paragraph(
    "This report is prepared under India's Carbon Credit Trading Scheme (CCTS), notified under the Energy Conservation Act 2001 (as amended 2022) and its implementing rules, using the GHG emission intensity methodology gazetted for the scheme.",
  );

  pb.heading("Mass balance approach");
  pb.paragraph(
    "Direct emissions are attributed to goods using a mass balance approach: combustion emissions from fuels and process emissions from calcination of flux/carbonate materials charged to the production route are summed per Section 04 and 05, and embedded emissions in purchased precursor materials plus indirect emissions from purchased electricity and steam are added per Section 06. The total is divided by the quantity of goods produced in the reporting period to arrive at GHG Emission Intensity.",
  );

  pb.formulaBlock(
    "GHG Emission Intensity",
    [
      ["Direct emissions", "Combustion (Section 04) + Process (Section 05)"],
      ["Indirect emissions", "Electricity + Steam (Section 06)"],
      ["Precursor emissions", "Embedded emissions in purchased precursors (Section 06)"],
    ],
    "GHG Intensity",
    "(Direct + Indirect + Precursor) ÷ Production quantity",
  );

  pb.heading("Global Warming Potentials (GWP)");
  pb.paragraph(
    `Non-CO2 gases are converted to CO2e using ${GWP_AR2_BUR3.label} Global Warming Potentials, as gazetted for CCTS under S.O. 2825(E) 2023 and India's Third Biennial Update Report (BUR3). This is a hard regulatory requirement — CBAM reports for the same facility use IPCC AR5 GWPs instead (see the CBAM Communication Package, Section 08), so the two totals are not directly comparable gas-for-gas.`,
  );
  pb.table({
    columns: [
      { header: "Gas", width: 80 },
      { header: "GWP (AR2/BUR3, 100-yr)", width: 155, align: "right" },
      { header: "Source", width: 260 },
    ],
    rows: [
      ["CO2", fmt(GWP_AR2_BUR3.co2, 0), GWP_AR2_BUR3.source],
      ["CH4", fmt(GWP_AR2_BUR3.ch4, 0), GWP_AR2_BUR3.source],
      ["N2O", fmt(GWP_AR2_BUR3.n2o, 0), GWP_AR2_BUR3.source],
      ["CF4 (aluminium PFC)", fmt(GWP_AR2_BUR3.cf4 ?? 0, 0), GWP_AR2_BUR3.source],
      ["C2F6 (aluminium PFC)", fmt(GWP_AR2_BUR3.c2f6 ?? 0, 0), GWP_AR2_BUR3.source],
    ],
  });

  pb.heading("Grid emission factor");
  pb.paragraph(
    `Indirect electricity emissions use the default India grid emission factor of ${fmt(DEFAULT_GRID_EMISSION_FACTOR, 3)} tCO2/MWh, sourced from the ${DEFAULT_GRID_EMISSION_FACTOR_SOURCE}, unless a facility-specific override was supplied at data entry.`,
  );
}

// ---------------------------------------------------------------------------
// Section 08 — Verification Statement
// ---------------------------------------------------------------------------

function buildVerification(pb: PageBuilder, ctx: ReportContext) {
  pb.startSection(8, "Verification Statement");

  const vr = ctx.verificationRequest;
  const isApproved = vr?.status === "APPROVED";

  pb.summaryBox(
    "Verification Status",
    [
      ["Verifier name", vr?.verifier?.name ?? "—"],
      ["Verifier organisation", vr?.verifierOrg ?? "—"],
      ["Accreditation number", vr?.accreditationNumber ?? "—"],
      ["Date of verification", vr?.decidedAt ? fmtDate(vr.decidedAt) : "—"],
    ],
    { tone: isApproved ? "teal" : "neutral" },
  );

  pb.heading("Scope of verification");
  pb.paragraph(
    "GHG Emission Intensity calculation for the stated reporting period, based on the activity data submitted through the Intellocarbon platform (Sections 02–06).",
  );

  pb.heading("Verification opinion");
  const opinion = isApproved
    ? (vr?.statement ?? "Approved — no additional statement provided.")
    : vr?.status === "REJECTED"
      ? (vr?.comments ?? "Rejected — see comments.")
      : "Not yet issued.";
  pb.paragraph(opinion, { color: isApproved ? undefined : MUTED });

  if (isApproved && vr?.qualifications) {
    pb.heading("Qualifications / emphasis of matter");
    pb.paragraph(vr.qualifications);
  }

  pb.heading("Digital signature");
  if (isApproved) {
    pb.paragraph(
      `Verified electronically by ${vr?.verifier?.name ?? "the assigned verifier"} on ${vr?.decidedAt ? fmtDate(vr.decidedAt) : "—"}.`,
      { bold: true, color: TEAL_DARK },
    );
  } else {
    pb.ensureSpace(50);
    pb.doc.moveTo(MARGIN_X, pb.y + 30).lineTo(MARGIN_X + 220, pb.y + 30).strokeColor(BORDER).lineWidth(1).stroke();
    pb.doc.fillColor(MUTED).font("Helvetica").fontSize(8).text("Verifier signature", MARGIN_X, pb.y + 34);
    pb.y += 50;
  }

  if (!isApproved) {
    pb.watermark("PENDING VERIFICATION");
  }
}

// ---------------------------------------------------------------------------
// Section 09 — Authorised Declaration and Annexures
// ---------------------------------------------------------------------------

function buildDeclarationAnnexures(pb: PageBuilder, ctx: ReportContext) {
  pb.startSection(9, "Authorised Declaration and Annexures");

  const owner = ctx.facility.company.owner;

  pb.heading("Declaration");
  pb.paragraph(
    `I/We, on behalf of ${ctx.facility.company.name}, declare that the information contained in this CCTS GHG Intensity Report has been prepared in good faith based on the activity data submitted through the Intellocarbon platform for the reporting period ${fmtDate(ctx.periodStart)} – ${fmtDate(ctx.periodEnd)}, and represents our best current estimate of the GHG Emission Intensity of the goods described in Section 02.`,
  );

  pb.ensureSpace(70);
  pb.doc.moveTo(MARGIN_X, pb.y + 30).lineTo(MARGIN_X + 220, pb.y + 30).strokeColor(BORDER).lineWidth(1).stroke();
  pb.doc.fillColor(MUTED).font("Helvetica").fontSize(8).text("Signature", MARGIN_X, pb.y + 34);
  pb.doc
    .fillColor(NAVY)
    .font("Helvetica-Bold")
    .fontSize(9.5)
    .text(`${owner.name} — Company Administrator`, MARGIN_X, pb.y + 48);
  pb.doc.fillColor(MUTED).font("Helvetica").fontSize(8.5).text(`Date: ${fmtDate(new Date())}`, MARGIN_X, pb.y + 62);
  pb.y += 84;

  pb.heading("Annexures");
  const annexures = [
    "Annex A — Production and reporting period data (Section 02)",
    "Annex B — Fuel, process material and precursor entry detail (Sections 04–06)",
    "Annex C — Calculation methodology and GWP tables (Section 07)",
    "Annex D — Verification statement (Section 08)",
  ];
  for (const item of annexures) {
    pb.paragraph(`•  ${item}`, { size: 9.5 });
  }
}
