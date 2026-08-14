import { LOGO_LOCKUP_ON_DARK } from "../brandAssets";
import type { ReportContext } from "../report.service";
import type { UkCbamFinancialImpact, UkCbamOutOfScope } from "../ukCbamFinancialImpact.service";
import { AppError } from "../../utils/AppError";
import { PageBuilder } from "../cbamReport/layout";
import { buildVerifyQr } from "../cbamReport/qr";
import {
  TEAL_DARK,
  MUTED,
  MARGIN_X,
  CONTENT_WIDTH,
  fmt,
  fmtGbp,
  fmtDate,
  titleCase,
} from "../cbamReport/theme";
import { productionRouteLabel } from "../cbamReport/build";
import { FUEL_LIBRARY, PROCESS_MATERIAL_LIBRARY, PRECURSOR_LIBRARY } from "../../data/emissionFactors";
import { GWP_AR5 } from "../../data/gwpTables";
import {
  UK_CBAM_DEFERRED_EMISSIONS,
  UK_CBAM_REGISTRATION_THRESHOLD_GBP,
  UK_CBAM_REGISTRATION_THRESHOLD_SOURCE,
} from "../../data/ukCbamReferenceData";
import {
  UK_CBAM_FIRST_ACCOUNTING_PERIOD_YEAR,
  ukCbamReportingCadence,
  nextUkCbamDeadline,
} from "../../data/complianceDeadlines";

// Cover band is the dark gradient — see brandAssets for why the interior
// pages use a different lockup.
const LOGO_PATH = LOGO_LOCKUP_ON_DARK;

/**
 * What the section builders below are allowed to receive. An out-of-scope
 * result never reaches them — buildUkCbamReturn rejects it up front — and
 * excluding it here is what lets each section read `impact.emissionsTco2e`
 * without re-checking, while still forcing every liability field to be
 * guarded behind the RATE_PENDING check.
 */
type UkCbamReturnImpact = Exclude<UkCbamFinancialImpact, UkCbamOutOfScope>;

/**
 * The UK CBAM return.
 *
 * Deliberately not a copy of the EU Communication Package. That document
 * exists because EU CBAM is a certificate regime: an importer has to be able
 * to hand a declarant a defensible SEE figure benchmarked against the
 * Commission's published default values, which is why it carries default-value
 * comparisons, savings-vs-default framing and a declarant annexure. UK CBAM is
 * a tax: a liability is computed on a rate HMRC sets and is filed as a return.
 * So this document is shorter and differently shaped — what was imported, what
 * it emitted within the UK's boundary, the rate applied, and what is owed —
 * with no default-value benchmark (HMRC publishes none) and no invented
 * sections to pad it out to the EU report's length.
 */
export const buildUkCbamReturn = async (
  doc: PDFKit.PDFDocument,
  ctx: ReportContext,
  impact: UkCbamFinancialImpact,
) => {
  if (impact.status === "OUT_OF_SCOPE") {
    throw AppError.badRequest(impact.reason, "UK_CBAM_OUT_OF_SCOPE");
  }

  const pb = new PageBuilder(doc, impact.reportReference);
  const qr = await buildVerifyQr(impact.reportReference);

  buildCoverPage(pb, ctx, impact, qr);
  pb.startTocPage();
  buildReturnSummary(pb, ctx, impact);
  buildGoodsAndInstallation(pb, ctx, impact);
  buildEmissionsInScope(pb, ctx, impact);
  buildLiability(pb, impact);
  buildMethodology(pb, impact);

  pb.finalize();
};

/** The accounting period a report covers is the calendar year its data period ends in. */
const accountingPeriodYear = (ctx: ReportContext): number => ctx.periodEnd.getUTCFullYear();

const RATE_PENDING_HERO = "Rate not yet published";

// ---------------------------------------------------------------------------
// Cover
// ---------------------------------------------------------------------------

function buildCoverPage(
  pb: PageBuilder,
  ctx: ReportContext,
  impact: UkCbamReturnImpact,
  qr: { buffer: Buffer; url: string },
) {
  // No hero delta chip. The EU cover compares against a published default
  // value; HMRC publishes none, and inventing a benchmark to fill the same
  // visual slot would be a fabricated regulatory comparison.
  const isPending = impact.status === "RATE_PENDING";

  pb.coverShell({
    logoPath: LOGO_PATH,
    eyebrow: "HMRC Return — Prepared for Submission",
    title: "UK CBAM Return",
    subtitle: "UK Carbon Border Adjustment Mechanism — embedded emissions and liability",
    heroLabel: isPending ? "UK CBAM Liability" : "Net UK CBAM Liability",
    heroValue: isPending ? RATE_PENDING_HERO : fmtGbp(impact.netLiabilityGbp),
    referenceBadge: impact.reportReference,
    controlTitle: "Document Control",
    controlRows: [
      ["Document ID", impact.reportReference],
      ["Version", "v1.0"],
      ["Classification", "Confidential — Regulatory Submission"],
      ["Distribution", "Company Admin, Assigned Verifier"],
      ["Generated", fmtDate(new Date())],
      ["Accounting period", `${fmtDate(ctx.periodStart)} – ${fmtDate(ctx.periodEnd)}`],
    ],
    qrPngBuffer: qr.buffer,
    qrCaption: "Scan to verify",
    qrUrl: qr.url,
    docIdBadge: `DOC ID  ${impact.reportReference}  ·  v1.0`,
    confidentialityText:
      "This document is classified Confidential — Regulatory Submission and is intended solely for the named distribution list above. Unauthorised copying or distribution is prohibited. © 2026 Intellocarbon Solutions Private Limited.",
  });
}

// ---------------------------------------------------------------------------
// Section 01 — Return summary
// ---------------------------------------------------------------------------

function buildReturnSummary(pb: PageBuilder, ctx: ReportContext, impact: UkCbamReturnImpact) {
  pb.startSection(1, "Return Summary");

  const year = accountingPeriodYear(ctx);
  const cadence = ukCbamReportingCadence(year);
  const deadline = nextUkCbamDeadline(ctx.periodEnd);

  pb.paragraph(
    cadence === "ANNUAL"
      ? `The ${UK_CBAM_FIRST_ACCOUNTING_PERIOD_YEAR} accounting period is filed as a single annual return covering the full calendar year. Returns for later periods are filed quarterly.`
      : "This accounting period is filed quarterly.",
  );

  pb.summaryBox(
    "Return at a glance",
    [
      ["Accounting period", `${fmtDate(ctx.periodStart)} – ${fmtDate(ctx.periodEnd)}`],
      ["Reporting cadence", cadence === "ANNUAL" ? "Annual" : "Quarterly"],
      ["Return due", fmtDate(deadline)],
      ["Emissions in scope", `${fmt(impact.emissionsTco2e, 2)} tCO2e`],
      [
        "Liability",
        impact.status === "RATE_PENDING" ? RATE_PENDING_HERO : fmtGbp(impact.netLiabilityGbp),
      ],
    ],
    { tone: "teal" },
  );

  pb.heading("Registration threshold");
  pb.paragraph(
    `Registration for UK CBAM is required once the value of CBAM goods imported reaches £${UK_CBAM_REGISTRATION_THRESHOLD_GBP.toLocaleString("en-GB")} over any rolling 12-month period. That test is on the value of goods imported, which this platform does not hold — this return does not assess whether the threshold has been met.`,
  );
  pb.note(UK_CBAM_REGISTRATION_THRESHOLD_SOURCE);
}

// ---------------------------------------------------------------------------
// Section 02 — Goods and installation
// ---------------------------------------------------------------------------

function buildGoodsAndInstallation(pb: PageBuilder, ctx: ReportContext, impact: UkCbamReturnImpact) {
  pb.startSection(2, "Goods and Installation");

  const company = ctx.facility.company;

  pb.keyValueColumns(
    "Installation",
    [
      ["Facility", ctx.facility.name],
      ["Sector", titleCase(ctx.sector)],
      ["Production route", productionRouteLabel(ctx.sector, ctx.facility.productionRoute)],
      ["Location", [ctx.facility.district, ctx.facility.state].filter(Boolean).join(", ") || "Not provided"],
    ],
    "Operator",
    [
      ["Company", company.name],
      ["Registration number", company.registrationNumber ?? "Not provided"],
      ["Country", company.country],
      ["Contact", company.owner.email],
    ],
  );

  pb.heading("Goods covered by this return");
  pb.table({
    columns: [
      { header: "Product", width: 200 },
      { header: "Quantity produced (t)", width: 150, align: "right" },
      { header: "Embedded emissions (tCO2e/t)", width: 145, align: "right" },
    ],
    rows: [
      [
        ctx.productCategory,
        fmt(ctx.productionQuantityT, 2),
        fmt(impact.specificEmbeddedEmissions, 4),
      ],
    ],
  });
  pb.note(
    "Commodity codes are not stated here — the UK's goods classification for CBAM is set by HMRC and is not held on this platform. Confirm the codes for these goods before filing.",
  );
}

// ---------------------------------------------------------------------------
// Section 03 — Emissions in scope
// ---------------------------------------------------------------------------

function buildEmissionsInScope(pb: PageBuilder, ctx: ReportContext, impact: UkCbamReturnImpact) {
  pb.startSection(3, "Emissions in Scope");

  const r = ctx.calculationResult;

  pb.paragraph(
    "UK CBAM counts direct (Scope 1) emissions and the embedded emissions of select precursor materials. Indirect emissions are not in scope for this accounting period.",
  );

  pb.heading("Scope 1 — direct emissions");
  const scope1Rows: [string, string][] = [
    ["Fuel combustion", `${fmt(r.directCombustionCo2eAr5, 3)} tCO2e`],
    ["Process emissions", `${fmt(r.directProcessCo2e, 3)} tCO2e`],
  ];
  if (r.directPfcCo2eAr5 > 0) scope1Rows.push(["Perfluorocarbons (anode effects)", `${fmt(r.directPfcCo2eAr5, 3)} tCO2e`]);
  if (r.directN2oProcessCo2eAr5 > 0) scope1Rows.push(["Process N2O (net of abatement)", `${fmt(r.directN2oProcessCo2eAr5, 3)} tCO2e`]);
  scope1Rows.push(["Scope 1 total", `${fmt(r.totalDirectCo2eAr5, 3)} tCO2e`]);
  pb.summaryBox("Scope 1 breakdown", scope1Rows);

  if (ctx.fuelEntries.length > 0) {
    pb.heading("Fuel consumption");
    pb.table({
      columns: [
        { header: "Fuel", width: 175 },
        { header: "Quantity", width: 110, align: "right" },
        { header: "CO2 factor", width: 105, align: "right" },
        { header: "CO2e (AR5)", width: 105, align: "right" },
      ],
      rows: ctx.fuelEntries.map((entry) => {
        const def = FUEL_LIBRARY[entry.fuelType];
        const efCo2 = entry.emissionFactorOverrideCo2 ?? def?.efCo2PerUnit ?? 0;
        const co2 = entry.quantity * efCo2;
        const ch4Kg = entry.quantity * (def?.efCh4PerUnit ?? 0);
        const n2oKg = entry.quantity * (def?.efN2oPerUnit ?? 0);
        const co2e = co2 + (ch4Kg / 1000) * GWP_AR5.ch4 + (n2oKg / 1000) * GWP_AR5.n2o;
        return [
          def?.label ?? titleCase(entry.fuelType),
          `${fmt(entry.quantity, 2)} ${entry.unit.toLowerCase()}`,
          fmt(efCo2, 4),
          fmt(co2e, 3),
        ];
      }),
    });
  }

  if (ctx.processMaterialEntries.length > 0) {
    pb.heading("Process materials");
    pb.table({
      columns: [
        { header: "Material", width: 220 },
        { header: "Quantity (t)", width: 135, align: "right" },
        { header: "CO2 (t)", width: 140, align: "right" },
      ],
      rows: ctx.processMaterialEntries.map((entry) => {
        const def = PROCESS_MATERIAL_LIBRARY[entry.materialType];
        const ef = entry.emissionFactorOverride ?? def?.efCo2PerTonne ?? 0;
        return [
          def?.label ?? titleCase(entry.materialType),
          fmt(entry.quantityTonnes, 2),
          fmt(entry.quantityTonnes * ef, 3),
        ];
      }),
    });
  }

  pb.heading("Precursor materials");
  if (ctx.precursorEntries.length > 0) {
    pb.table({
      columns: [
        { header: "Precursor", width: 220 },
        { header: "Quantity (t)", width: 135, align: "right" },
        { header: "Embedded CO2e (t)", width: 140, align: "right" },
      ],
      rows: ctx.precursorEntries.map((entry) => {
        const def = PRECURSOR_LIBRARY[entry.materialType];
        const ef = entry.embeddedEmissionFactorOverride ?? def?.defaultEmbeddedFactor ?? 0;
        return [
          def?.label ?? titleCase(entry.materialType),
          fmt(entry.quantityTonnes, 2),
          fmt(entry.quantityTonnes * ef, 3),
        ];
      }),
    });
  } else {
    pb.paragraph("No precursor materials were reported for this period.", { color: MUTED, size: 9 });
  }

  pb.heading("Emissions excluded from this return");
  pb.paragraph(
    `${fmt(impact.excludedIndirectTco2e, 2)} tCO2e of indirect emissions (purchased electricity and imported steam) were calculated for this period and are excluded from the UK CBAM total above. ${UK_CBAM_DEFERRED_EMISSIONS.description}`,
  );
  pb.note(UK_CBAM_DEFERRED_EMISSIONS.source);

  pb.summaryBox(
    "Total emissions in scope for UK CBAM",
    [
      ["Scope 1 (direct)", `${fmt(r.totalDirectCo2eAr5, 3)} tCO2e`],
      ["Precursors", `${fmt(r.directPrecursorCo2e, 3)} tCO2e`],
      ["Excluded — indirect", `(${fmt(impact.excludedIndirectTco2e, 3)}) tCO2e`],
      ["Total in scope", `${fmt(impact.emissionsTco2e, 2)} tCO2e`],
    ],
    { tone: "teal" },
  );
}

// ---------------------------------------------------------------------------
// Section 04 — Liability
// ---------------------------------------------------------------------------

function buildLiability(pb: PageBuilder, impact: UkCbamReturnImpact) {
  pb.startSection(4, "Liability");

  if (impact.status === "RATE_PENDING") {
    // The whole point of the pending state: the emissions above are final and
    // usable, and no number is put in the liability column until HMRC sets a
    // rate. A zero here would read as "nothing owed".
    pb.statBox("UK CBAM liability", RATE_PENDING_HERO, "No rate has been published for this accounting period");
    pb.paragraph(impact.reason);
    pb.summaryBox("What is known", [
      ["Emissions in scope", `${fmt(impact.emissionsTco2e, 2)} tCO2e`],
      ["Embedded emissions", `${fmt(impact.specificEmbeddedEmissions, 4)} tCO2e/t`],
      ["Rate", "Not published"],
      ["Liability", "Cannot be stated"],
    ]);
    pb.note(
      "Once the rate is published and recorded, regenerating this return will state the liability. The emissions figures above will not change.",
    );
    return;
  }

  pb.statBox(
    "Net UK CBAM liability",
    fmtGbp(impact.netLiabilityGbp),
    `${fmt(impact.emissionsTco2e, 2)} tCO2e at ${fmtGbp(impact.rateGbpPerTonne)}/tCO2e (${impact.rateQuarter})`,
  );

  pb.formulaBlock(
    "Gross liability",
    [
      ["Emissions in scope", `${fmt(impact.emissionsTco2e, 2)} tCO2e`],
      ["UK CBAM rate", `${fmtGbp(impact.rateGbpPerTonne)}/tCO2e`],
    ],
    "Gross liability",
    fmtGbp(impact.grossLiabilityGbp),
  );

  pb.heading("Adjustment for carbon price paid overseas");
  if (impact.carbonPricePaidGbpPerTonne > 0) {
    pb.formulaBlock(
      "Overseas carbon price adjustment",
      [
        ["Carbon price paid", `${fmtGbp(impact.carbonPricePaidGbpPerTonne)}/tCO2e`],
        ["Emissions in scope", `${fmt(impact.emissionsTco2e, 2)} tCO2e`],
        ["UK CBAM rate", `${fmtGbp(impact.rateGbpPerTonne)}/tCO2e`],
      ],
      "Adjustment",
      `${fmt(impact.overseasCarbonPriceDeductionTco2e, 2)} tCO2e — ${fmtGbp(impact.overseasCarbonPriceDeductionGbp)}`,
    );
  } else {
    pb.paragraph("No overseas carbon price has been recorded for this period, so no adjustment is claimed.", {
      color: MUTED,
      size: 9,
    });
  }

  pb.summaryBox(
    "Liability summary",
    [
      ["Gross liability", fmtGbp(impact.grossLiabilityGbp)],
      ["Less: carbon price paid overseas", `(${fmtGbp(impact.overseasCarbonPriceDeductionGbp)})`],
      ["Net liability", fmtGbp(impact.netLiabilityGbp)],
    ],
    { tone: "teal" },
  );
  pb.note(`Rate source: ${impact.rateSource} (as of ${impact.rateAsOfDate}).`);
}

// ---------------------------------------------------------------------------
// Section 05 — Methodology
// ---------------------------------------------------------------------------

function buildMethodology(pb: PageBuilder, impact: UkCbamReturnImpact) {
  pb.startSection(5, "Methodology and Sources");

  pb.heading("Emissions");
  pb.paragraph(
    "Emissions in scope = Scope 1 direct emissions (fuel combustion, process emissions, perfluorocarbons and process N2O) + embedded emissions of precursor materials, on the AR5 GWP basis. Indirect emissions from purchased electricity and imported steam are calculated but excluded, per the UK's deferral of indirect emissions.",
  );
  pb.note(
    "Default fuel and process emission factors: IPCC 2006 Guidelines for National GHG Inventories, Vol 2. AR5 GWP: IPCC Fifth Assessment Report. Any line item flagged as an override uses the operator-provided factor instead of the default.",
  );

  pb.heading("Liability");
  pb.paragraph(
    "Gross liability (GBP) = Emissions in scope (tCO2e) × UK CBAM rate (GBP/tCO2e). The rate is set by HMRC from the UK ETS auction price plus Carbon Price Support. An adjustment for a carbon price already paid overseas is valued at the UK rate and capped at the gross liability, so it can never produce a negative liability.",
  );
  pb.note(
    impact.status === "RATE_PENDING"
      ? "No UK CBAM rate has been published for this accounting period, so no liability is stated in this return."
      : `Rate: ${impact.rateSource} (as of ${impact.rateAsOfDate}).`,
  );

  pb.heading("Scope of this document");
  pb.paragraph(
    "This return is prepared from the operator's submitted activity data and is not a filing. It does not assess registration threshold status, does not state commodity codes, and does not constitute tax advice. Figures should be confirmed against HMRC's published guidance for the accounting period before submission.",
  );
  pb.doc.fillColor(TEAL_DARK).font("Helvetica-Bold").fontSize(9).text("", MARGIN_X, pb.y, { width: CONTENT_WIDTH });
}
