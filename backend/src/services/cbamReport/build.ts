import path from "path";
import type { ReportContext } from "../report.service";
import type { CbamFinancialImpact } from "../cbamFinancialImpact.service";
import { PageBuilder } from "./layout";
import { buildVerifyQr } from "./qr";
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
  fmtEur,
  fmtSigned,
  fmtDate,
  titleCase,
  buildCitationNumbering,
} from "./theme";
import { donutChart, horizontalBarComparison, waterfallChart, CHART_BLUE, CHART_SLATE, CHART_AMBER } from "./charts";
import {
  FUEL_LIBRARY,
  PROCESS_MATERIAL_LIBRARY,
  PRECURSOR_LIBRARY,
  DEFAULT_GRID_EMISSION_FACTOR,
  DEFAULT_GRID_EMISSION_FACTOR_SOURCE,
  DEFAULT_STEAM_EMISSION_FACTOR,
} from "../../data/emissionFactors";
import { GWP_AR5, GWP_AR2_BUR3 } from "../../data/gwpTables";
import { CN_CODES_BY_SECTOR, SECTOR_PRODUCTION_ROUTES } from "../../data/cbamReferenceData";

const LOGO_PATH = path.join(__dirname, "../../assets/logo-full.png");
const EMISSION_FACTOR_SOURCE = "EU 2023/1773 Annex VIII";

const UNIT_LABELS: Record<string, string> = {
  TONNE: "t",
  KILOLITRE: "kl",
  THOUSAND_NM3: "'000 Nm³",
  GJ: "GJ",
};

export const productionRouteLabel = (sector: ReportContext["sector"], route: string): string =>
  SECTOR_PRODUCTION_ROUTES[sector]?.find((r) => r.value === route)?.label ?? titleCase(route);

const cnCodesLabel = (ctx: ReportContext): string => {
  if (ctx.facility.cnCodes.length > 0) return ctx.facility.cnCodes.join(", ");
  const sectorDefaults = CN_CODES_BY_SECTOR[ctx.sector]?.map((c) => c.code);
  return sectorDefaults && sectorDefaults.length > 0 ? sectorDefaults.join(", ") : "Not provided";
};

export const buildCbamCommunicationPackage = async (
  doc: PDFKit.PDFDocument,
  ctx: ReportContext,
  financials: CbamFinancialImpact,
) => {
  const pb = new PageBuilder(doc, financials.reportReference, LOGO_PATH);
  const qr = await buildVerifyQr(financials.reportReference);

  buildCoverPage(pb, ctx, financials, qr);
  pb.startTocPage();
  buildExecutiveSummary(pb, ctx, financials);
  buildInstallationDeclarantProduction(pb, ctx, financials);
  buildSeeResults(pb, ctx, financials);
  buildFinancialImpact(pb, financials);
  buildScope1Combustion(pb, ctx);
  buildScope1Process(pb, ctx);
  buildIndirectAndPrecursors(pb, ctx);
  buildMethodology(pb);
  buildVerification(pb, ctx);
  buildDeclarationAnnexures(pb, ctx);

  pb.finalize();
};

// ---------------------------------------------------------------------------
// Page 1 — Cover
// ---------------------------------------------------------------------------

function buildCoverPage(
  pb: PageBuilder,
  ctx: ReportContext,
  financials: CbamFinancialImpact,
  qr: { buffer: Buffer; url: string },
) {
  const savingAbs = fmtEur(Math.abs(financials.savingVsDefaultEur));
  const heroDelta = financials.varianceIsBetterThanDefault
    ? { text: `${savingAbs} better than EU default value`, tone: "green" as const }
    : { text: `${savingAbs} above EU default value`, tone: "red" as const };

  pb.coverShell({
    logoPath: LOGO_PATH,
    eyebrow: "Regulatory Submission Document",
    title: "CBAM Communication Package",
    subtitle: "EU Carbon Border Adjustment Mechanism — Specific Embedded Emissions Report",
    heroLabel: "Net CBAM Liability",
    heroValue: fmtEur(financials.netLiabilityEur),
    heroDelta,
    referenceBadge: financials.reportReference,
    controlTitle: "Document Control",
    controlRows: [
      ["Document ID", financials.reportReference],
      ["Version", "v1.0"],
      ["Classification", "Confidential — Regulatory Submission"],
      ["Distribution", "Company Admin, EU Declarant, Assigned Verifier"],
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
// Section 01 — Executive Summary (page 3)
// ---------------------------------------------------------------------------

export function verificationStatusLabel(ctx: ReportContext): string {
  const vr = ctx.verificationRequest;
  if (!vr) return "Not yet submitted for verification";
  if (vr.status === "APPROVED") return `Approved by ${vr.verifier?.name ?? "independent verifier"}`;
  if (vr.status === "REJECTED") return "Rejected — resubmission required";
  return vr.status === "IN_REVIEW" ? "Under review" : "Submitted, pending assignment";
}

export function cctsPositionLabel(financials: CbamFinancialImpact): string {
  const pos = financials.cctsPosition;
  if (pos.pending) return "Pending — target not yet notified";
  return `${pos.isSurplus ? "Surplus" : "Deficit"} of ${fmt(Math.abs(pos.deltaTco2e), 2)} tCO2e`;
}

function buildExecutiveSummary(pb: PageBuilder, ctx: ReportContext, financials: CbamFinancialImpact) {
  pb.startSection(1, "Executive Summary");

  const seeUnit = ctx.sector === "ELECTRICITY" ? "tCO2e/MWh" : "tCO2e/t";
  const quantityLabel =
    ctx.sector === "ELECTRICITY"
      ? `${fmtInt(ctx.electricityExportedEuMwh ?? 0)} MWh exported to the EU`
      : `${fmtInt(ctx.productionQuantityT)} tonnes of ${ctx.productCategory}`;

  pb.paragraph(
    `This Communication Package presents the Specific Embedded Emissions (SEE) and associated CBAM financial ` +
      `exposure for ${ctx.facility.name} (${ctx.facility.company.name}) for the reporting period ` +
      `${fmtDate(ctx.periodStart)} – ${fmtDate(ctx.periodEnd)}, covering ${quantityLabel}.`,
  );

  pb.summaryBox(
    "Key Findings",
    [
      ["Actual Specific Embedded Emissions (SEE)", `${fmt(financials.actualSee)} ${seeUnit}`],
      ["EU default value (illustrative)", `${fmt(financials.defaultSee)} ${seeUnit}`],
      [
        "Variance from default",
        `${fmtSigned(financials.varianceFromDefault)} ${seeUnit} (${financials.varianceIsBetterThanDefault ? "better than default" : "above default"})`,
      ],
      ["Estimated net CBAM liability", fmtEur(financials.netLiabilityEur)],
      ["CCTS CCC position", cctsPositionLabel(financials)],
      ["Verification status", verificationStatusLabel(ctx)],
    ],
    { tone: "teal" },
  );

  pb.ensureSpace(150);
  pb.heading("Actual SEE vs. EU Default Comparison");
  pb.y = horizontalBarComparison(pb.doc, {
    x: MARGIN_X,
    y: pb.y,
    width: CONTENT_WIDTH,
    actualValue: financials.actualSee,
    actualLabel: "Actual SEE",
    referenceValue: financials.defaultSee,
    referenceLabel: "EU Default",
    unit: seeUnit,
  });

  pb.note(
    "EU default value is illustrative — see Section 04 for the applicable source citation and Section 08 for methodology.",
  );
}

// ---------------------------------------------------------------------------
// Section 02 — Installation, Declarant and Production Data
// ---------------------------------------------------------------------------

function buildInstallationDeclarantProduction(pb: PageBuilder, ctx: ReportContext, financials: CbamFinancialImpact) {
  pb.startSection(2, "Installation, Declarant and Production Data");

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
    ["CN code(s)", cnCodesLabel(ctx)],
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

  pb.heading("Goods and Production Data");
  pb.paragraph(
    "The table below summarises the goods produced at this installation and reported under this CBAM Communication Package.",
  );

  const volumeLabel = ctx.sector === "ELECTRICITY" ? "Volume (MWh)" : "Volume (t)";
  const volumeValue = ctx.sector === "ELECTRICITY" ? fmtInt(ctx.electricityExportedEuMwh ?? 0) : fmtInt(ctx.productionQuantityT);

  pb.table({
    columns: [
      { header: "Product type", width: 115 },
      { header: "CN code(s)", width: 90 },
      { header: volumeLabel, width: 80, align: "right" },
      { header: "Reporting period", width: 135 },
      { header: "Route", width: 75 },
    ],
    rows: [
      [
        ctx.productCategory,
        cnCodesLabel(ctx),
        volumeValue,
        `${fmtDate(ctx.periodStart)} – ${fmtDate(ctx.periodEnd)}`,
        productionRouteLabel(ctx.sector, ctx.facility.productionRoute),
      ],
    ],
  });

  pb.note(`CBAM activity: ${financials.cbamActivity}.`);
}

// ---------------------------------------------------------------------------
// Section 03 — Specific Embedded Emissions Results
// ---------------------------------------------------------------------------

function buildSeeResults(pb: PageBuilder, ctx: ReportContext, financials: CbamFinancialImpact) {
  pb.startSection(3, "Specific Embedded Emissions Results");

  const result = ctx.calculationResult!;
  const production = ctx.sector === "ELECTRICITY" ? (ctx.electricityExportedEuMwh ?? 0) : ctx.productionQuantityT;
  const seeUnit = ctx.sector === "ELECTRICITY" ? "tCO2e/MWh" : "tCO2e/t";
  const directSee = result.totalDirectCo2eAr5 / production;
  const indirectSee = (result.indirectElectricityCo2e + result.indirectSteamCo2e) / production;

  const rows: (string | number)[][] = [
    ["Direct SEE", fmt(directSee), seeUnit, "—", "—"],
    ["Indirect SEE", fmt(indirectSee), seeUnit, "—", "—"],
    ["Total SEE", fmt(financials.actualSee), seeUnit, fmt(financials.defaultSee), financials.varianceIsBetterThanDefault ? "Better than default" : "Above default"],
    ["EU Default Value", fmt(financials.defaultSee), seeUnit, "—", "Illustrative default"],
    ["Variance from Default", fmtSigned(financials.varianceFromDefault), seeUnit, "—", financials.varianceIsBetterThanDefault ? "Favourable" : "Unfavourable"],
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

  pb.ensureSpace(240);
  pb.heading("Total Embedded Emissions Composition");
  pb.y = donutChart(pb.doc, {
    x: MARGIN_X,
    y: pb.y,
    diameter: 130,
    unit: "tCO2e",
    centerLabel: "Total",
    segments: [
      { label: "Scope 1 Combustion", value: result.directCombustionCo2eAr5, color: TEAL },
      { label: "Scope 1 Process", value: result.directProcessCo2e, color: CHART_BLUE },
      { label: "Scope 2 Indirect", value: result.indirectElectricityCo2e + result.indirectSteamCo2e, color: CHART_AMBER },
      { label: "Precursor Embedded", value: result.directPrecursorCo2e, color: CHART_SLATE },
    ],
  });

  pb.formulaBlock(
    "Specific Embedded Emissions (SEE)",
    [
      ["Direct emissions (Scope 1)", `${fmt(result.totalDirectCo2eAr5, 2)} tCO2e`],
      ["Indirect emissions (Scope 2)", `${fmt(result.indirectElectricityCo2e + result.indirectSteamCo2e, 2)} tCO2e`],
      ["Precursor embedded emissions", `${fmt(result.directPrecursorCo2e, 2)} tCO2e`],
      ["Production quantity", `${fmtInt(production)} ${ctx.sector === "ELECTRICITY" ? "MWh" : "t"}`],
    ],
    "SEE",
    `${fmt(result.totalEmissionsCbamAr5, 2)} tCO2e ÷ ${fmtInt(production)} ${ctx.sector === "ELECTRICITY" ? "MWh" : "t"} = ${fmt(financials.actualSee)} ${seeUnit}`,
  );
}

// ---------------------------------------------------------------------------
// Section 05 — Financial Impact Analysis (page 7)
// ---------------------------------------------------------------------------

function buildFinancialImpact(pb: PageBuilder, financials: CbamFinancialImpact) {
  pb.startSection(4, "Financial Impact Analysis");

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

  pb.ensureSpace(250);
  pb.heading("Liability Walk — Gross to Net");
  pb.y = waterfallChart(pb.doc, {
    x: MARGIN_X,
    y: pb.y,
    width: CONTENT_WIDTH,
    height: 150,
    grossLabel: "Gross Liability",
    grossValue: financials.grossLiabilityEur,
    deductionLabel: "Article 9 Deduction",
    deductionValue: financials.article9DeductionEur,
    netLabel: "Net Liability",
    netValue: financials.netLiabilityEur,
    formatValue: fmtEur,
  });

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
  pb.startSection(5, "Direct Emissions — Scope 1 Combustion");

  pb.paragraph(
    "Combustion emissions from fuels charged directly to furnaces, boilers and other combustion equipment at the installation.",
  );

  if (ctx.fuelEntries.length === 0) {
    pb.note("No fuel combustion entries recorded for this reporting period.");
    return;
  }

  let subtotal = 0;
  const sources: string[] = [];
  const rows: (string | number)[][] = ctx.fuelEntries.map((entry) => {
    const def = FUEL_LIBRARY[entry.fuelType];
    const efCo2 = entry.emissionFactorOverrideCo2 ?? def.efCo2PerUnit;
    const co2Tonnes = entry.quantity * efCo2;
    const ch4Kg = entry.quantity * def.efCh4PerUnit;
    const n2oKg = entry.quantity * def.efN2oPerUnit;
    const co2eAr5 = co2Tonnes + (ch4Kg / 1000) * GWP_AR5.ch4 + (n2oKg / 1000) * GWP_AR5.n2o;
    subtotal += co2eAr5;
    sources.push(EMISSION_FACTOR_SOURCE);
    return [
      def.label,
      fmt(entry.quantity, 2),
      UNIT_LABELS[entry.unit] ?? titleCase(entry.unit),
      `${fmt(efCo2, 3)} t/unit`,
      fmt(co2eAr5, 2),
    ];
  });
  const { numbers, legend } = buildCitationNumbering(sources);
  rows.forEach((row, i) => {
    row[3] = `${row[3]}^${numbers[i]}`;
  });
  rows.push(["Subtotal — Scope 1 Combustion", "", "", "", fmt(subtotal, 2)]);

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
    `${legend}. Emission factors are Tier-1 defaults. Overridden factors reflect facility-specific data supplied at data entry.`,
  );
}

// ---------------------------------------------------------------------------
// Section 07 — Direct Emissions: Scope 1 Process (page 9)
// ---------------------------------------------------------------------------

interface SectorBreakdown {
  calcination?: { limestoneInputTonnes: number; emissionFactorUsed: number; clinkerConversionFraction: number; co2Tonnes: number };
  fertilizerFeedstock?: { naturalGasFeedstockNm3: number; emissionFactorUsed: number; co2Tonnes: number };
  pfc?: { cf4Tonnes: number; c2f6Tonnes: number; anodeEffectMinutes: number | null; co2eAr5: number; co2eAr4: number };
  n2oProcess?: { n2oTonnes: number; abatementFactorPct: number; netN2oTonnes: number; co2eAr5: number; co2eAr4: number };
}

function buildScope1Process(pb: PageBuilder, ctx: ReportContext) {
  pb.startSection(6, "Direct Emissions — Scope 1 Process");

  pb.paragraph(
    "Process emissions from flux/carbonate calcination, anode carbon oxidation, and other sector-specific process reactions. Purchased precursor materials (pig iron, DRI, scrap, clinker, alumina, ammonia) are reported as embedded emissions in Section 07 — Indirect Emissions and Precursor Embedded Emissions, consistent with the mass balance approach described in Section 08.",
  );

  const breakdown = (ctx.calculationResult?.breakdown ?? {}) as SectorBreakdown;

  if (ctx.processMaterialEntries.length === 0 && !breakdown.calcination && !breakdown.fertilizerFeedstock) {
    pb.note("No process material entries recorded for this reporting period.");
  } else {
    let subtotal = 0;
    const sources: string[] = [];
    const rows: (string | number)[][] = ctx.processMaterialEntries.map((entry) => {
      const def = PROCESS_MATERIAL_LIBRARY[entry.materialType];
      const efUsed = entry.emissionFactorOverride ?? def.efCo2PerTonne;
      const co2 = entry.quantityTonnes * efUsed;
      subtotal += co2;
      sources.push(EMISSION_FACTOR_SOURCE);
      return [def.label, fmt(entry.quantityTonnes, 2), `${fmt(efUsed, 3)} tCO2/t`, fmt(co2, 2)];
    });

    if (breakdown.calcination) {
      subtotal += breakdown.calcination.co2Tonnes;
      sources.push("IPCC 2006 Vol.3 Ch.2");
      rows.push([
        "Limestone calcination (cement)",
        fmt(breakdown.calcination.limestoneInputTonnes, 2),
        `${fmt(breakdown.calcination.emissionFactorUsed, 3)} tCO2/t CaCO3 x ${fmt(breakdown.calcination.clinkerConversionFraction, 2)}`,
        fmt(breakdown.calcination.co2Tonnes, 2),
      ]);
    }
    if (breakdown.fertilizerFeedstock) {
      subtotal += breakdown.fertilizerFeedstock.co2Tonnes;
      sources.push(EMISSION_FACTOR_SOURCE);
      rows.push([
        "Natural gas feedstock carbon (ammonia)",
        `${fmt(breakdown.fertilizerFeedstock.naturalGasFeedstockNm3, 2)} '000 Nm3`,
        `${fmt(breakdown.fertilizerFeedstock.emissionFactorUsed, 3)} tCO2/'000 Nm3`,
        fmt(breakdown.fertilizerFeedstock.co2Tonnes, 2),
      ]);
    }

    const { numbers, legend } = buildCitationNumbering(sources);
    rows.forEach((row, i) => {
      row[2] = `${row[2]}^${numbers[i]}`;
    });
    rows.push(["Subtotal — Scope 1 Process", "", "", fmt(subtotal, 2)]);

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
    pb.note(legend);
  }

  if (breakdown.pfc) {
    pb.heading("PFC emissions — anode effects (aluminium)");
    pb.paragraph(
      "Perfluorocarbons (CF4, C2F6) released during anode effects in Hall-Héroult electrolysis cells. CBAM uses IPCC AR5 GWPs; CCTS uses the AR2/BUR3-gazetted GWPs under S.O. 2825(E).",
    );
    pb.table({
      columns: [
        { header: "Gas", width: 90 },
        { header: "Quantity (t)", width: 90, align: "right" },
        { header: "GWP (CBAM/AR5)", width: 105, align: "right" },
        { header: "GWP (CCTS/AR2)", width: 105, align: "right" },
        { header: "tCO2e (CBAM)", width: 105, align: "right" },
      ],
      rows: [
        ["CF4", fmt(breakdown.pfc.cf4Tonnes, 3), fmt(GWP_AR5.cf4 ?? 0, 0), fmt(GWP_AR2_BUR3.cf4 ?? 0, 0), fmt(breakdown.pfc.cf4Tonnes * (GWP_AR5.cf4 ?? 0), 2)],
        ["C2F6", fmt(breakdown.pfc.c2f6Tonnes, 3), fmt(GWP_AR5.c2f6 ?? 0, 0), fmt(GWP_AR2_BUR3.c2f6 ?? 0, 0), fmt(breakdown.pfc.c2f6Tonnes * (GWP_AR5.c2f6 ?? 0), 2)],
        ["Subtotal — PFC (CBAM/AR5)", "", "", "", fmt(breakdown.pfc.co2eAr5, 2)],
      ],
      highlightRowIndex: 2,
    });
    pb.note(`PFC subtotal under CCTS (AR2/BUR3 GWPs): ${fmt(breakdown.pfc.co2eAr4, 2)} tCO2e.`);
  }

  if (breakdown.n2oProcess) {
    pb.heading("N2O process emissions — nitric acid (fertilizer)");
    pb.paragraph(
      "Nitrous oxide released during nitric acid production (Ostwald process), net of any catalytic abatement installed. This typically accounts for 60-70% of total GHG emissions at a nitric acid plant.",
    );
    pb.table({
      columns: [
        { header: "N2O emitted (t)", width: 110, align: "right" },
        { header: "Abatement", width: 90, align: "right" },
        { header: "Net N2O (t)", width: 100, align: "right" },
        { header: "tCO2e (CBAM/AR5)", width: 100, align: "right" },
        { header: "tCO2e (CCTS/AR2)", width: 100, align: "right" },
      ],
      rows: [[
        fmt(breakdown.n2oProcess.n2oTonnes, 3),
        `${fmt(breakdown.n2oProcess.abatementFactorPct, 1)}%`,
        fmt(breakdown.n2oProcess.netN2oTonnes, 3),
        fmt(breakdown.n2oProcess.co2eAr5, 2),
        fmt(breakdown.n2oProcess.co2eAr4, 2),
      ]],
    });
  }
}

// ---------------------------------------------------------------------------
// Section 07 — Indirect Emissions and Precursor Embedded Emissions
// ---------------------------------------------------------------------------

function buildIndirectAndPrecursors(pb: PageBuilder, ctx: ReportContext) {
  pb.startSection(7, "Indirect Emissions and Precursor Embedded Emissions");

  pb.paragraph("Emissions embedded in purchased electricity and imported steam.");

  const gridEfUsed = ctx.gridEmissionFactorOverride ?? DEFAULT_GRID_EMISSION_FACTOR;
  const gridSource = ctx.gridEmissionFactorOverride != null ? "Facility override" : DEFAULT_GRID_EMISSION_FACTOR_SOURCE;
  const electricityCo2e = ctx.gridElectricityMwh * gridEfUsed;

  const sources: string[] = [gridSource];
  const rows: (string | number)[][] = [
    ["Grid electricity", fmt(ctx.gridElectricityMwh, 2), "MWh", `${fmt(gridEfUsed, 3)} tCO2/MWh`, fmt(electricityCo2e, 2)],
  ];

  if (ctx.renewableElectricityMwh > 0) {
    sources.push("Zero-rated");
    rows.push(["Renewable electricity", fmt(ctx.renewableElectricityMwh, 2), "MWh", "0.000 tCO2/MWh", "0.00"]);
  }

  let steamCo2e = 0;
  if (ctx.steamImportedGj > 0) {
    const steamEfUsed = ctx.steamEmissionFactorOverride ?? DEFAULT_STEAM_EMISSION_FACTOR;
    steamCo2e = ctx.steamImportedGj * steamEfUsed;
    sources.push(ctx.steamEmissionFactorOverride != null ? "Facility override" : "Facility default");
    rows.push(["Imported steam", fmt(ctx.steamImportedGj, 2), "GJ", `${fmt(steamEfUsed, 4)} tCO2/GJ`, fmt(steamCo2e, 2)]);
  }

  const { numbers, legend } = buildCitationNumbering(sources);
  rows.forEach((row, i) => {
    row[3] = `${row[3]}^${numbers[i]}`;
  });
  rows.push(["Subtotal — Scope 2 (Indirect)", "", "", "", fmt(electricityCo2e + steamCo2e, 2)]);

  pb.table({
    columns: [
      { header: "Energy source", width: 150 },
      { header: "Quantity", width: 80, align: "right" },
      { header: "Unit", width: 50 },
      { header: "Emission factor", width: 125, align: "right" },
      { header: "tCO2e", width: 90, align: "right" },
    ],
    rows,
    highlightRowIndex: rows.length - 1,
  });

  pb.note(
    `${legend}. Grid emission factor default: ${fmt(DEFAULT_GRID_EMISSION_FACTOR, 3)} tCO2/MWh — ${DEFAULT_GRID_EMISSION_FACTOR_SOURCE}.`,
  );

  pb.heading("Precursor Embedded Emissions");
  pb.paragraph(
    "Embedded emissions in purchased precursor materials (pig iron, DRI, hot metal, scrap, ferro-alloys) sourced from external suppliers, per the mass balance approach described in Section 08.",
  );

  if (ctx.precursorEntries.length === 0) {
    pb.note("No precursor material entries recorded for this reporting period.");
    return;
  }

  let precursorSubtotal = 0;
  const precursorSources: string[] = [];
  const precursorRows: (string | number)[][] = ctx.precursorEntries.map((entry) => {
    const def = PRECURSOR_LIBRARY[entry.materialType];
    const efUsed = entry.embeddedEmissionFactorOverride ?? def.defaultEmbeddedFactor;
    const co2e = entry.quantityTonnes * efUsed;
    precursorSubtotal += co2e;
    precursorSources.push(entry.embeddedEmissionFactorOverride != null ? "Verified / override" : "EU Tier-1 default");
    return [def.label, entry.sourceLabel || "Not specified", fmt(entry.quantityTonnes, 2), fmt(efUsed, 3), fmt(co2e, 2)];
  });
  const precursorCitation = buildCitationNumbering(precursorSources);
  precursorRows.forEach((row, i) => {
    row[3] = `${row[3]}^${precursorCitation.numbers[i]}`;
  });
  precursorRows.push(["Subtotal — Precursors", "", "", "", fmt(precursorSubtotal, 2)]);

  pb.table({
    columns: [
      { header: "Precursor material", width: 135 },
      { header: "Source / country", width: 130 },
      { header: "Quantity (t)", width: 70, align: "right" },
      { header: "EF (t/t)", width: 65, align: "right" },
      { header: "tCO2e", width: 95, align: "right" },
    ],
    rows: precursorRows,
    highlightRowIndex: precursorRows.length - 1,
  });
  pb.note(precursorCitation.legend);
}

// ---------------------------------------------------------------------------
// Section 08 — Calculation Methodology
// ---------------------------------------------------------------------------

function buildMethodology(pb: PageBuilder) {
  pb.startSection(8, "Calculation Methodology");

  pb.paragraph(
    "This report is prepared under the framework of Regulation (EU) 2023/956 establishing the Carbon Border Adjustment Mechanism, its implementing provisions for the definitive regime under Regulation (EU) 2025/2547, and the calculation methodology set out in Implementing Regulation (EU) 2023/1773.",
  );

  pb.heading("Mass balance approach");
  pb.paragraph(
    "Direct emissions are attributed to goods using a mass balance approach: combustion emissions from fuels and process emissions from calcination of flux/carbonate materials charged to the production route are summed per Section 05 and 06, and embedded emissions in purchased precursor materials plus indirect emissions from purchased electricity and steam are added per Section 07. The total is divided by the quantity of goods produced in the reporting period to arrive at Specific Embedded Emissions (SEE).",
  );

  pb.formulaBlock(
    "Specific Embedded Emissions (SEE)",
    [
      ["Direct emissions", "Combustion (Section 05) + Process (Section 06)"],
      ["Indirect emissions", "Electricity + Steam (Section 07)"],
      ["Precursor emissions", "Embedded emissions in purchased precursors (Section 07)"],
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
      ["CF4 (aluminium PFC)", fmt(GWP_AR5.cf4 ?? 0, 0), gwpCitation],
      ["C2F6 (aluminium PFC)", fmt(GWP_AR5.c2f6 ?? 0, 0), gwpCitation],
    ],
  });
  pb.note(GWP_AR5.source);

  pb.heading("Grid emission factor");
  pb.paragraph(
    `Indirect electricity emissions use the default India grid emission factor of ${fmt(DEFAULT_GRID_EMISSION_FACTOR, 3)} tCO2/MWh, sourced from the ${DEFAULT_GRID_EMISSION_FACTOR_SOURCE}, unless a facility-specific override was supplied at data entry.`,
  );
}

// ---------------------------------------------------------------------------
// Section 09 — Verification Statement
// ---------------------------------------------------------------------------

function buildVerification(pb: PageBuilder, ctx: ReportContext) {
  pb.startSection(9, "Verification Statement");

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
    "Specific Embedded Emissions calculation for the stated reporting period, based on the activity data submitted through the Intellocarbon platform (Sections 02–07).",
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
// Section 10 — Authorised Declaration and Annexures
// ---------------------------------------------------------------------------

function buildDeclarationAnnexures(pb: PageBuilder, ctx: ReportContext) {
  pb.startSection(10, "Authorised Declaration and Annexures");

  const owner = ctx.facility.company.owner;

  pb.heading("Declaration");
  pb.paragraph(
    `I/We, on behalf of ${ctx.facility.company.name}, declare that the information contained in this CBAM Communication Package has been prepared in good faith based on the activity data submitted through the Intellocarbon platform for the reporting period ${fmtDate(ctx.periodStart)} – ${fmtDate(ctx.periodEnd)}, and represents our best current estimate of the Specific Embedded Emissions of the goods described in Section 02.`,
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
    "Annex A — Goods and production data (Section 02)",
    "Annex B — Fuel, process material and precursor entry detail (Sections 05–07)",
    "Annex C — Calculation methodology and GWP tables (Section 08)",
    "Annex D — Verification statement (Section 09)",
  ];
  for (const item of annexures) {
    pb.paragraph(`•  ${item}`, { size: 9.5 });
  }
}
