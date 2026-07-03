import path from "path";
import type { ReportContext } from "../report.service";
import type { CbamFinancialImpact } from "../cbamFinancialImpact.service";
import { PageBuilder } from "./layout";
import {
  TEAL,
  TEAL_DARK,
  NAVY,
  MUTED,
  BORDER,
  MARGIN_X,
  CONTENT_WIDTH,
  PAGE_WIDTH,
  fmt,
  fmtInt,
  fmtEur,
  fmtSigned,
  fmtDate,
  titleCase,
} from "./theme";
import {
  FUEL_LIBRARY,
  PROCESS_MATERIAL_LIBRARY,
  PRECURSOR_LIBRARY,
  DEFAULT_GRID_EMISSION_FACTOR,
  DEFAULT_GRID_EMISSION_FACTOR_SOURCE,
  DEFAULT_STEAM_EMISSION_FACTOR,
} from "../../data/emissionFactors";
import { GWP_AR5 } from "../../data/gwpTables";

const LOGO_PATH = path.join(__dirname, "../../assets/logo-full.png");
const EMISSION_FACTOR_SOURCE = "EU 2023/1773 Annex VIII";

const UNIT_LABELS: Record<string, string> = {
  TONNE: "t",
  KILOLITRE: "kl",
  THOUSAND_NM3: "'000 Nm³",
};

const PRODUCTION_ROUTE_LABELS: Record<string, string> = {
  BF_BOF: "BF-BOF",
  EAF: "EAF",
  DRI_EAF: "DRI-EAF",
  OTHER: "Other",
};

export const buildCbamCommunicationPackage = (
  doc: PDFKit.PDFDocument,
  ctx: ReportContext,
  financials: CbamFinancialImpact,
) => {
  const pb = new PageBuilder(doc, financials.reportReference);

  buildCoverPage(pb, ctx, financials);
  pb.startTocPage();
  buildExecutiveSummary(pb, ctx, financials);
  buildInstallationDeclarant(pb, ctx, financials);
  buildGoodsProduction(pb, ctx, financials);
  buildSeeResults(pb, ctx, financials);
  buildFinancialImpact(pb, financials);
  buildScope1Combustion(pb, ctx);
  buildScope1Process(pb, ctx);
  buildScope2Indirect(pb, ctx);
  buildPrecursors(pb, ctx);
  buildMethodology(pb);
  buildVerification(pb, ctx);
  buildDeclarationAnnexures(pb, ctx);

  pb.finalize();
};

// ---------------------------------------------------------------------------
// Page 1 — Cover
// ---------------------------------------------------------------------------

function buildCoverPage(pb: PageBuilder, ctx: ReportContext, financials: CbamFinancialImpact) {
  const doc = pb.doc;
  pb.startCover();

  doc.rect(0, 0, doc.page.width, 130).fillColor(TEAL).fill();

  doc.roundedRect(MARGIN_X - 10, 24, 168, 50, 6).fillColor("#FFFFFF").fill();
  doc.image(LOGO_PATH, MARGIN_X, 34, { width: 148 });

  doc
    .fillColor(NAVY)
    .font("Helvetica-Bold")
    .fontSize(30)
    .text("CBAM Communication Package", MARGIN_X, 220, { width: CONTENT_WIDTH, align: "center" });
  doc
    .fillColor(MUTED)
    .font("Helvetica")
    .fontSize(12)
    .text(
      "EU Carbon Border Adjustment Mechanism — Specific Embedded Emissions Report",
      MARGIN_X,
      260,
      { width: CONTENT_WIDTH, align: "center" },
    );

  doc
    .moveTo(MARGIN_X + 120, 300)
    .lineTo(PAGE_WIDTH - MARGIN_X - 120, 300)
    .strokeColor(TEAL)
    .lineWidth(2)
    .stroke();

  const boxY = 340;
  const boxX = MARGIN_X + 60;
  const boxWidth = CONTENT_WIDTH - 120;
  doc.roundedRect(boxX, boxY, boxWidth, 176, 8).strokeColor(BORDER).lineWidth(1).stroke();

  const rows: [string, string][] = [
    ["Company", ctx.facility.company.name],
    ["Facility", ctx.facility.name],
    ["Reporting period", `${fmtDate(ctx.periodStart)} – ${fmtDate(ctx.periodEnd)}`],
    ["Date of issue", fmtDate(new Date())],
  ];
  let rowY = boxY + 22;
  for (const [label, value] of rows) {
    doc
      .fillColor(MUTED)
      .font("Helvetica-Bold")
      .fontSize(8)
      .text(label.toUpperCase(), boxX + 30, rowY, { width: boxWidth - 60, characterSpacing: 0.5 });
    doc
      .fillColor(NAVY)
      .font("Helvetica-Bold")
      .fontSize(13)
      .text(value, boxX + 30, rowY + 12, { width: boxWidth - 60 });
    rowY += 40;
  }

  doc
    .fillColor(TEAL_DARK)
    .font("Helvetica-Bold")
    .fontSize(10)
    .text(`Reference: ${financials.reportReference}`, MARGIN_X, doc.page.height - 96, {
      width: CONTENT_WIDTH,
      align: "right",
    });
}

// ---------------------------------------------------------------------------
// Section 01 — Executive Summary (page 3)
// ---------------------------------------------------------------------------

function verificationStatusLabel(ctx: ReportContext): string {
  const vr = ctx.verificationRequest;
  if (!vr) return "Not yet submitted for verification";
  if (vr.status === "APPROVED") return `Approved by ${vr.verifier?.name ?? "independent verifier"}`;
  if (vr.status === "REJECTED") return "Rejected — resubmission required";
  return vr.status === "IN_REVIEW" ? "Under review" : "Submitted, pending assignment";
}

function cctsPositionLabel(financials: CbamFinancialImpact): string {
  const pos = financials.cctsPosition;
  if (pos.pending) return "Pending — target not yet notified";
  return `${pos.isSurplus ? "Surplus" : "Deficit"} of ${fmt(Math.abs(pos.deltaTco2e), 2)} tCO2e`;
}

function buildExecutiveSummary(pb: PageBuilder, ctx: ReportContext, financials: CbamFinancialImpact) {
  pb.startSection(1, "Executive Summary");

  pb.paragraph(
    `This Communication Package presents the Specific Embedded Emissions (SEE) and associated CBAM financial ` +
      `exposure for ${ctx.facility.name} (${ctx.facility.company.name}) for the reporting period ` +
      `${fmtDate(ctx.periodStart)} – ${fmtDate(ctx.periodEnd)}, covering ${fmtInt(ctx.productionQuantityT)} tonnes ` +
      `of ${ctx.productCategory}.`,
  );

  pb.summaryBox(
    "Key Findings",
    [
      ["Actual Specific Embedded Emissions (SEE)", `${fmt(financials.actualSee)} tCO2e/t`],
      ["EU default value (illustrative)", `${fmt(financials.defaultSee)} tCO2e/t`],
      [
        "Variance from default",
        `${fmtSigned(financials.varianceFromDefault)} tCO2e/t (${financials.varianceIsBetterThanDefault ? "better than default" : "above default"})`,
      ],
      ["Estimated net CBAM liability", fmtEur(financials.netLiabilityEur)],
      ["CCTS CCC position", cctsPositionLabel(financials)],
      ["Verification status", verificationStatusLabel(ctx)],
    ],
    { tone: "teal" },
  );

  pb.heading("Actual SEE vs. EU Default Comparison");
  pb.table({
    columns: [
      { header: "Metric", width: 220 },
      { header: "Actual", width: 90, align: "right" },
      { header: "EU Default", width: 90, align: "right" },
      { header: "Variance", width: 95, align: "right" },
    ],
    rows: [
      [
        "Total SEE (tCO2e / t product)",
        fmt(financials.actualSee),
        fmt(financials.defaultSee),
        fmtSigned(financials.varianceFromDefault),
      ],
    ],
    highlightRowIndex: financials.varianceIsBetterThanDefault ? 0 : undefined,
  });

  pb.note(
    "EU default value is illustrative — see Section 05 for the applicable source citation and Section 10 for methodology.",
  );
}

// ---------------------------------------------------------------------------
// Section 02 — Installation and Declarant Details (page 4)
// ---------------------------------------------------------------------------

function buildInstallationDeclarant(pb: PageBuilder, ctx: ReportContext, financials: CbamFinancialImpact) {
  pb.startSection(2, "Installation and Declarant Details");

  const { facility } = ctx;
  const { company } = facility;

  const address = [facility.address, facility.district, facility.state, facility.pincode]
    .filter(Boolean)
    .join(", ");

  const leftRows: [string, string][] = [
    ["Company name", company.name],
    ["Facility name", facility.name],
    ["Address", address || "Not provided"],
    [
      "GPS coordinates",
      facility.latitude != null && facility.longitude != null
        ? `${facility.latitude.toFixed(5)}, ${facility.longitude.toFixed(5)}`
        : "Not provided",
    ],
    [
      "Production capacity",
      facility.installedCapacityTpa
        ? `${facility.installedCapacityTpa.toLocaleString("en-IN")} tonnes/year`
        : "Not provided",
    ],
    ["CN code(s)", facility.cnCodes.length > 0 ? facility.cnCodes.join(", ") : "Not provided"],
    ["CBAM activity", financials.cbamActivity],
  ];

  const rightRows: [string, string][] = [
    ["Importer / EU declarant", company.euImporterName || "Not provided"],
    ["EORI number", company.euImporterEori || "Not provided"],
    ["Country", company.euImporterCountry || "Not provided"],
    ["Contact email", company.euImporterContactEmail || "Not provided"],
    ["Contact phone", company.euImporterContactPhone || "Not provided"],
  ];

  pb.keyValueColumns("NON-EU INSTALLATION", leftRows, "EU DECLARANT", rightRows);

  if (!company.euImporterName || !company.euImporterEori) {
    pb.note(
      "EU declarant details are incomplete — add the importer name and EORI number in Company Settings before this package is used for a regulatory submission.",
    );
  }
}

// ---------------------------------------------------------------------------
// Section 03 — Goods and Production Data (page 5)
// ---------------------------------------------------------------------------

function buildGoodsProduction(pb: PageBuilder, ctx: ReportContext, financials: CbamFinancialImpact) {
  pb.startSection(3, "Goods and Production Data");

  pb.paragraph(
    "The table below summarises the goods produced at this installation and reported under this CBAM Communication Package.",
  );

  pb.table({
    columns: [
      { header: "Product type", width: 115 },
      { header: "CN code(s)", width: 90 },
      { header: "Volume (t)", width: 80, align: "right" },
      { header: "Reporting period", width: 135 },
      { header: "Route", width: 75 },
    ],
    rows: [
      [
        ctx.productCategory,
        ctx.facility.cnCodes.length > 0 ? ctx.facility.cnCodes.join(", ") : "Not provided",
        fmtInt(ctx.productionQuantityT),
        `${fmtDate(ctx.periodStart)} – ${fmtDate(ctx.periodEnd)}`,
        PRODUCTION_ROUTE_LABELS[ctx.facility.productionRoute] ?? titleCase(ctx.facility.productionRoute),
      ],
    ],
  });

  pb.note(`CBAM activity: ${financials.cbamActivity}.`);
}

// ---------------------------------------------------------------------------
// Section 04 — Specific Embedded Emissions Results (page 6)
// ---------------------------------------------------------------------------

function buildSeeResults(pb: PageBuilder, ctx: ReportContext, financials: CbamFinancialImpact) {
  pb.startSection(4, "Specific Embedded Emissions Results");

  const result = ctx.calculationResult!;
  const production = ctx.productionQuantityT;
  const directSee = result.totalDirectCo2eAr5 / production;
  const indirectSee = (result.indirectElectricityCo2e + result.indirectSteamCo2e) / production;

  const rows: (string | number)[][] = [
    ["Direct SEE", fmt(directSee), "tCO2e/t", "—", "—"],
    ["Indirect SEE", fmt(indirectSee), "tCO2e/t", "—", "—"],
    ["Total SEE", fmt(financials.actualSee), "tCO2e/t", fmt(financials.defaultSee), financials.varianceIsBetterThanDefault ? "Better than default" : "Above default"],
    ["EU Default Value", fmt(financials.defaultSee), "tCO2e/t", "—", "Illustrative default"],
    ["Variance from Default", fmtSigned(financials.varianceFromDefault), "tCO2e/t", "—", financials.varianceIsBetterThanDefault ? "Favourable" : "Unfavourable"],
    ["CBAM Certificates Required", fmt(financials.certificatesRequired, 2), "certificates", "—", "—"],
    [
      "Carbon Price Paid — India",
      financials.carbonPricePaidEurPerTonne > 0 ? fmt(financials.carbonPricePaidEurPerTonne, 2) : "Not provided",
      "EUR/tCO2e",
      "—",
      "—",
    ],
    ["Article 9 Deduction", fmt(financials.article9DeductionTonnes, 2), "tCO2e", "—", "—"],
    ["Net Certificates After Deduction", fmt(financials.netCertificates, 2), "certificates", "—", "—"],
  ];

  pb.table({
    columns: [
      { header: "Parameter", width: 155 },
      { header: "Value", width: 75, align: "right" },
      { header: "Unit", width: 80 },
      { header: "Benchmark", width: 80, align: "right" },
      { header: "Status", width: 105 },
    ],
    rows,
    highlightRowIndex: financials.varianceIsBetterThanDefault ? 4 : undefined,
  });

  pb.formulaBlock(
    "Specific Embedded Emissions (SEE)",
    [
      ["Direct emissions (Scope 1)", `${fmt(result.totalDirectCo2eAr5, 2)} tCO2e`],
      ["Indirect emissions (Scope 2)", `${fmt(result.indirectElectricityCo2e + result.indirectSteamCo2e, 2)} tCO2e`],
      ["Precursor embedded emissions", `${fmt(result.directPrecursorCo2e, 2)} tCO2e`],
      ["Production quantity", `${fmtInt(production)} t`],
    ],
    "SEE",
    `${fmt(result.totalEmissionsCbamAr5, 2)} tCO2e ÷ ${fmtInt(production)} t = ${fmt(financials.actualSee)} tCO2e/t`,
  );
}

// ---------------------------------------------------------------------------
// Section 05 — Financial Impact Analysis (page 7)
// ---------------------------------------------------------------------------

function buildFinancialImpact(pb: PageBuilder, financials: CbamFinancialImpact) {
  pb.startSection(5, "Financial Impact Analysis");

  pb.formulaBlock(
    "Net CBAM Liability",
    [
      ["CBAM certificates required", `${fmt(financials.certificatesRequired, 2)} tCO2e`],
      ["Certificate price", `${fmtEur(financials.certificatePrice)} / tCO2e`],
      ["Article 9 deduction", `${fmt(financials.article9DeductionTonnes, 2)} tCO2e`],
    ],
    "Net CBAM liability",
    `(${fmt(financials.certificatesRequired, 2)} - ${fmt(financials.article9DeductionTonnes, 2)}) tCO2e × ${fmtEur(financials.certificatePrice)} = ${fmtEur(financials.netLiabilityEur)}`,
  );

  pb.summaryBox("Liability Summary", [
    ["Certificate price used", `${fmtEur(financials.certificatePrice)}/tCO2e (${financials.certificatePriceQuarter})`],
    ["Gross CBAM liability (before deduction)", fmtEur(financials.grossLiabilityEur)],
    ["Article 9 deduction (EU 2023/956 Art. 9)", `- ${fmtEur(financials.article9DeductionEur)}`],
    ["Net CBAM liability", fmtEur(financials.netLiabilityEur)],
    ["Saving vs. EU default value", fmtEur(financials.savingVsDefaultEur)],
  ]);

  pb.note(`Certificate price source: ${financials.certificatePriceSource} As of ${fmtDate(new Date(financials.certificatePriceAsOfDate))}.`);

  pb.heading("CCTS CCC Position");
  const pos = financials.cctsPosition;
  if (pos.pending) {
    pb.paragraph(
      "The GHG emission intensity target for this reporting cycle has not yet been notified by the Bureau of Energy Efficiency (BEE) for this sub-sector. The Carbon Credit Certificate (CCC) surplus/deficit position cannot be computed until a target is entered against this activity data entry.",
      { color: MUTED },
    );
  } else {
    pb.paragraph(
      `Against the notified target of ${fmt(pos.targetIntensity)} tCO2e/t (actual: ${fmt(pos.actualIntensity)} tCO2e/t), this facility holds a ${pos.isSurplus ? "surplus" : "deficit"} of ${fmt(Math.abs(pos.deltaTco2e), 2)} tCO2e for the reporting period, equivalent to ${fmtInt(Math.abs(pos.deltaTco2e))} Carbon Credit Certificates (CCCs) ${pos.isSurplus ? "available for sale" : "required to be purchased"}.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Section 06 — Direct Emissions: Scope 1 Combustion (page 8)
// ---------------------------------------------------------------------------

function buildScope1Combustion(pb: PageBuilder, ctx: ReportContext) {
  pb.startSection(6, "Direct Emissions — Scope 1 Combustion");

  pb.paragraph(
    "Combustion emissions from fuels charged directly to furnaces, boilers and other combustion equipment at the installation.",
  );

  if (ctx.fuelEntries.length === 0) {
    pb.note("No fuel combustion entries recorded for this reporting period.");
    return;
  }

  let subtotal = 0;
  const rows: (string | number)[][] = ctx.fuelEntries.map((entry) => {
    const def = FUEL_LIBRARY[entry.fuelType];
    const efCo2 = entry.emissionFactorOverrideCo2 ?? def.efCo2PerUnit;
    const co2Tonnes = entry.quantity * efCo2;
    const ch4Kg = entry.quantity * def.efCh4PerUnit;
    const n2oKg = entry.quantity * def.efN2oPerUnit;
    const co2eAr5 = co2Tonnes + (ch4Kg / 1000) * GWP_AR5.ch4 + (n2oKg / 1000) * GWP_AR5.n2o;
    subtotal += co2eAr5;
    return [
      def.label,
      fmt(entry.quantity, 2),
      UNIT_LABELS[entry.unit] ?? titleCase(entry.unit),
      `${fmt(efCo2, 3)} t/unit`,
      EMISSION_FACTOR_SOURCE,
      fmt(co2eAr5, 2),
    ];
  });
  rows.push(["Subtotal — Scope 1 Combustion", "", "", "", "", fmt(subtotal, 2)]);

  pb.table({
    columns: [
      { header: "Fuel type", width: 108 },
      { header: "Quantity", width: 58, align: "right" },
      { header: "Unit", width: 57 },
      { header: "Emission factor", width: 80, align: "right" },
      { header: "Source regulation", width: 122 },
      { header: "tCO2e", width: 70, align: "right" },
    ],
    rows,
    highlightRowIndex: rows.length - 1,
  });

  pb.note(
    `Emission factors are Tier-1 defaults; the applicable regulatory citation for each fuel is ${EMISSION_FACTOR_SOURCE}. Overridden factors reflect facility-specific data supplied at data entry.`,
  );
}

// ---------------------------------------------------------------------------
// Section 07 — Direct Emissions: Scope 1 Process (page 9)
// ---------------------------------------------------------------------------

function buildScope1Process(pb: PageBuilder, ctx: ReportContext) {
  pb.startSection(7, "Direct Emissions — Scope 1 Process");

  pb.paragraph(
    "Process (calcination) emissions from flux and carbonate materials charged to the furnace. Purchased precursor materials (pig iron, DRI, scrap) are reported as embedded emissions in Section 09 — Precursor Embedded Emissions, consistent with the mass balance approach described in Section 10.",
  );

  if (ctx.processMaterialEntries.length === 0) {
    pb.note("No process material entries recorded for this reporting period.");
    return;
  }

  let subtotal = 0;
  const rows: (string | number)[][] = ctx.processMaterialEntries.map((entry) => {
    const def = PROCESS_MATERIAL_LIBRARY[entry.materialType];
    const efUsed = entry.emissionFactorOverride ?? def.efCo2PerTonne;
    const co2 = entry.quantityTonnes * efUsed;
    subtotal += co2;
    return [def.label, fmt(entry.quantityTonnes, 2), `${fmt(efUsed, 3)} tCO2/t`, EMISSION_FACTOR_SOURCE, fmt(co2, 2)];
  });
  rows.push(["Subtotal — Scope 1 Process", "", "", "", fmt(subtotal, 2)]);

  pb.table({
    columns: [
      { header: "Process material", width: 140 },
      { header: "Quantity (t)", width: 65, align: "right" },
      { header: "Emission factor", width: 80, align: "right" },
      { header: "Source regulation", width: 130 },
      { header: "tCO2e", width: 80, align: "right" },
    ],
    rows,
    highlightRowIndex: rows.length - 1,
  });
}

// ---------------------------------------------------------------------------
// Section 08 — Indirect Emissions: Scope 2 (page 10)
// ---------------------------------------------------------------------------

function buildScope2Indirect(pb: PageBuilder, ctx: ReportContext) {
  pb.startSection(8, "Indirect Emissions — Scope 2");

  pb.paragraph("Emissions embedded in purchased electricity and imported steam.");

  const gridEfUsed = ctx.gridEmissionFactorOverride ?? DEFAULT_GRID_EMISSION_FACTOR;
  const gridSource = ctx.gridEmissionFactorOverride != null ? "Facility override" : "CEA FY2025-26";
  const electricityCo2e = ctx.gridElectricityMwh * gridEfUsed;

  const rows: (string | number)[][] = [
    ["Grid electricity", fmt(ctx.gridElectricityMwh, 2), "MWh", `${fmt(gridEfUsed, 3)} tCO2/MWh`, gridSource, fmt(electricityCo2e, 2)],
  ];

  if (ctx.renewableElectricityMwh > 0) {
    rows.push([
      "Renewable electricity",
      fmt(ctx.renewableElectricityMwh, 2),
      "MWh",
      "0.000 tCO2/MWh",
      "Zero-rated",
      "0.00",
    ]);
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

  rows.push(["Subtotal — Scope 2 (Indirect)", "", "", "", "", fmt(electricityCo2e + steamCo2e, 2)]);

  pb.table({
    columns: [
      { header: "Energy source", width: 120 },
      { header: "Quantity", width: 68, align: "right" },
      { header: "Unit", width: 40 },
      { header: "Emission factor", width: 100, align: "right" },
      { header: "Reference", width: 97 },
      { header: "tCO2e", width: 70, align: "right" },
    ],
    rows,
    highlightRowIndex: rows.length - 1,
  });

  pb.note(`Grid emission factor default: ${fmt(DEFAULT_GRID_EMISSION_FACTOR, 3)} tCO2/MWh — ${DEFAULT_GRID_EMISSION_FACTOR_SOURCE}.`);
}

// ---------------------------------------------------------------------------
// Section 09 — Precursor Embedded Emissions (page 11)
// ---------------------------------------------------------------------------

function buildPrecursors(pb: PageBuilder, ctx: ReportContext) {
  pb.startSection(9, "Precursor Embedded Emissions");

  pb.paragraph(
    "Embedded emissions in purchased precursor materials (pig iron, DRI, hot metal, scrap, ferro-alloys) sourced from external suppliers, per the mass balance approach described in Section 10.",
  );

  if (ctx.precursorEntries.length === 0) {
    pb.note("No precursor material entries recorded for this reporting period.");
    return;
  }

  let subtotal = 0;
  const rows: (string | number)[][] = ctx.precursorEntries.map((entry) => {
    const def = PRECURSOR_LIBRARY[entry.materialType];
    const efUsed = entry.embeddedEmissionFactorOverride ?? def.defaultEmbeddedFactor;
    const co2e = entry.quantityTonnes * efUsed;
    subtotal += co2e;
    return [
      def.label,
      entry.sourceLabel || "Not specified",
      fmt(entry.quantityTonnes, 2),
      entry.embeddedEmissionFactorOverride != null ? "Verified / override" : "EU Tier-1 default",
      fmt(efUsed, 3),
      fmt(co2e, 2),
    ];
  });
  rows.push(["Subtotal — Precursors", "", "", "", "", fmt(subtotal, 2)]);

  pb.table({
    columns: [
      { header: "Precursor material", width: 115 },
      { header: "Source / country", width: 115 },
      { header: "Quantity (t)", width: 62, align: "right" },
      { header: "Basis", width: 88 },
      { header: "EF (t/t)", width: 45, align: "right" },
      { header: "tCO2e", width: 70, align: "right" },
    ],
    rows,
    highlightRowIndex: rows.length - 1,
  });
}

// ---------------------------------------------------------------------------
// Section 10 — Calculation Methodology (page 12)
// ---------------------------------------------------------------------------

function buildMethodology(pb: PageBuilder) {
  pb.startSection(10, "Calculation Methodology");

  pb.paragraph(
    "This report is prepared under the framework of Regulation (EU) 2023/956 establishing the Carbon Border Adjustment Mechanism, its implementing provisions for the definitive regime under Regulation (EU) 2025/2547, and the calculation methodology set out in Implementing Regulation (EU) 2023/1773.",
  );

  pb.heading("Mass balance approach");
  pb.paragraph(
    "Direct emissions are attributed to goods using a mass balance approach: combustion emissions from fuels and process emissions from calcination of flux/carbonate materials charged to the production route are summed per Section 06 and 07, embedded emissions in purchased precursor materials are added per Section 09, and indirect emissions from purchased electricity and steam are added per Section 08. The total is divided by the quantity of goods produced in the reporting period to arrive at Specific Embedded Emissions (SEE).",
  );

  pb.formulaBlock(
    "Specific Embedded Emissions (SEE)",
    [
      ["Direct emissions", "Combustion (Section 06) + Process (Section 07)"],
      ["Indirect emissions", "Electricity + Steam (Section 08)"],
      ["Precursor emissions", "Embedded emissions in purchased precursors (Section 09)"],
    ],
    "SEE",
    "(Direct + Indirect + Precursor) ÷ Production quantity",
  );

  pb.heading("Global Warming Potentials (GWP)");
  pb.paragraph(
    `Non-CO2 gases are converted to CO2e using ${GWP_AR5.label} 100-year Global Warming Potentials, as mandated by Implementing Regulation (EU) 2023/1773 Annex III.`,
  );
  const gwpCitation = "IPCC AR5 — EU 2023/1773 Annex III";
  pb.table({
    columns: [
      { header: "Gas", width: 80 },
      { header: "GWP (AR5, 100-yr)", width: 135, align: "right" },
      { header: "Source", width: 280 },
    ],
    rows: [
      ["CO2", fmt(GWP_AR5.co2, 0), gwpCitation],
      ["CH4", fmt(GWP_AR5.ch4, 0), gwpCitation],
      ["N2O", fmt(GWP_AR5.n2o, 0), gwpCitation],
    ],
  });
  pb.note(GWP_AR5.source);

  pb.heading("Grid emission factor");
  pb.paragraph(
    `Indirect electricity emissions use the default India grid emission factor of ${fmt(DEFAULT_GRID_EMISSION_FACTOR, 3)} tCO2/MWh, sourced from the ${DEFAULT_GRID_EMISSION_FACTOR_SOURCE}, unless a facility-specific override was supplied at data entry.`,
  );
}

// ---------------------------------------------------------------------------
// Section 11 — Verification Statement (page 13)
// ---------------------------------------------------------------------------

function buildVerification(pb: PageBuilder, ctx: ReportContext) {
  pb.startSection(11, "Verification Statement");

  const vr = ctx.verificationRequest;
  const isApproved = vr?.status === "APPROVED";

  pb.summaryBox("Verification Status", [
    ["Verifier name", vr?.verifier?.name ?? "—"],
    ["Verifier organisation", vr?.verifierOrg ?? "—"],
    ["Accreditation number", vr?.accreditationNumber ?? "—"],
    ["Date of verification", vr?.decidedAt ? fmtDate(vr.decidedAt) : "—"],
  ], { tone: isApproved ? "teal" : "neutral" });

  pb.heading("Scope of verification");
  pb.paragraph(
    "Specific Embedded Emissions calculation for the stated reporting period, based on the activity data submitted through the Intellocarbon platform (Sections 03–09).",
  );

  pb.heading("Verification opinion");
  const opinion = isApproved
    ? (vr?.statement ?? "Approved — no additional statement provided.")
    : vr?.status === "REJECTED"
      ? (vr?.comments ?? "Rejected — see comments.")
      : "Not yet issued.";
  pb.paragraph(opinion, { color: isApproved ? undefined : MUTED });

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
// Section 12 — Authorised Declaration and Annexures (page 14)
// ---------------------------------------------------------------------------

function buildDeclarationAnnexures(pb: PageBuilder, ctx: ReportContext) {
  pb.startSection(12, "Authorised Declaration and Annexures");

  const owner = ctx.facility.company.owner;

  pb.heading("Declaration");
  pb.paragraph(
    `I/We, on behalf of ${ctx.facility.company.name}, declare that the information contained in this CBAM Communication Package has been prepared in good faith based on the activity data submitted through the Intellocarbon platform for the reporting period ${fmtDate(ctx.periodStart)} – ${fmtDate(ctx.periodEnd)}, and represents our best current estimate of the Specific Embedded Emissions of the goods described in Section 03.`,
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
    "Annex A — Goods and production data (Section 03)",
    "Annex B — Fuel, process material and precursor entry detail (Sections 06–09)",
    "Annex C — Calculation methodology and GWP tables (Section 10)",
    "Annex D — Verification statement (Section 11)",
  ];
  for (const item of annexures) {
    pb.paragraph(`•  ${item}`, { size: 9.5 });
  }
}
