import path from "path";
import type { ReportContext } from "../report.service";
import type { CbamFinancialImpact } from "../cbamFinancialImpact.service";
import type { CertificatePricePoint } from "../certificatePriceHistory.service";
import { PageBuilder } from "./layout";
import { productionRouteLabel } from "./build";
import {
  MARGIN_X,
  CONTENT_WIDTH,
  fmt,
  fmtInt,
  fmtEur,
  fmtDate,
} from "./theme";
import { horizontalBarComparison, verticalBarChart, CHART_BLUE } from "./charts";

/**
 * CBAM Executive Summary — a two-to-three page board document.
 *
 * Deliberately a *different assembly of the same numbers*, not a second
 * calculation: every figure comes from the CbamFinancialImpact the full
 * Communication Package is built from, and the price series is the Emission
 * Factor Manager's supersession chain. Nothing here computes an emission.
 *
 * It reuses the Communication Package's PageBuilder and chart primitives so
 * the two documents are visually the same product, but omits the cover shell,
 * table of contents, QR verification block, per-fuel line items, methodology
 * and annexures. Those exist because that document is a regulatory submission;
 * this one is for a board that wants the liability, how it compares to the EU
 * default, and where the price is heading.
 */

const LOGO_PATH = path.join(__dirname, "../../assets/logo-full.png");

/** Last N quarters of price history — a board needs a trend, not a full archive. */
const PRICE_TREND_QUARTERS = 6;

const seeUnitFor = (sector: ReportContext["sector"]): string =>
  sector === "ELECTRICITY" ? "tCO2e/MWh" : "tCO2e/t";

export const buildCbamExecutiveSummary = async (
  doc: PDFKit.PDFDocument,
  ctx: ReportContext,
  financials: CbamFinancialImpact,
  priceHistory: CertificatePricePoint[],
) => {
  const pb = new PageBuilder(doc, financials.reportReference, LOGO_PATH);
  // No cover page in this document — page 1 is content and should carry the
  // same branded header band as pages 2 and 3.
  pb.noCoverPage();

  buildHeadline(pb, ctx, financials);
  buildBenchmark(pb, ctx, financials);
  buildPriceTrend(pb, financials, priceHistory);

  pb.finalize();
};

// ---------------------------------------------------------------------------
// Page 1 — position and liability
// ---------------------------------------------------------------------------

function buildHeadline(pb: PageBuilder, ctx: ReportContext, financials: CbamFinancialImpact) {
  // startSection() always adds a page, which would leave the auto-created
  // first page blank — section 1 writes onto it directly instead. pb.y is
  // already at the top margin on a fresh PageBuilder.
  pb.sectionHeader(1, "CBAM Position");

  pb.paragraph(
    `${ctx.facility.company.name} — ${ctx.facility.name}. Reporting period ` +
      `${fmtDate(ctx.periodStart)} to ${fmtDate(ctx.periodEnd)}, ${ctx.productCategory} ` +
      `via ${productionRouteLabel(ctx.sector, ctx.facility.productionRoute)}.`,
  );

  const production =
    ctx.sector === "ELECTRICITY" ? (ctx.electricityExportedEuMwh ?? 0) : ctx.productionQuantityT;
  const productionUnit = ctx.sector === "ELECTRICITY" ? "MWh exported to the EU" : "tonnes produced";

  pb.summaryBox(
    "Headline position",
    [
      ["Net CBAM liability", fmtEur(financials.netLiabilityEur)],
      ["Gross liability before deductions", fmtEur(financials.grossLiabilityEur)],
      ["Certificates required", `${fmt(financials.netCertificates, 2)} tCO2e`],
      ["Certificate price applied", `${fmtEur(financials.certificatePrice)} (${financials.certificatePriceQuarter})`],
      ["Volume in scope", `${fmtInt(production)} ${productionUnit}`],
    ],
    { tone: "teal" },
  );

  // The Article 9 line only means anything when a carbon price was actually
  // paid in India — showing a zero deduction would invite the question of
  // why the company isn't claiming one.
  if (financials.article9DeductionEur > 0) {
    pb.keyValueRow(
      "Article 9 deduction (carbon price paid in India)",
      `${fmtEur(financials.article9DeductionEur)} — ${fmt(financials.article9DeductionTonnes, 2)} tCO2e`,
    );
  }

  pb.note(
    "Figures are drawn from the same calculation as this facility's CBAM Communication Package. " +
      "This summary is an internal management document, not a regulatory submission — the " +
      "Communication Package remains the document filed with the EU declarant.",
  );
}

// ---------------------------------------------------------------------------
// Page 2 — SEE against the EU default
// ---------------------------------------------------------------------------

function buildBenchmark(pb: PageBuilder, ctx: ReportContext, financials: CbamFinancialImpact) {
  pb.startSection(2, "Emissions Intensity vs EU Default");

  pb.paragraph(
    "Your verified Specific Embedded Emissions (SEE) against the EU default value for this " +
      "sector and production route. The default applies when facility-specific data is not " +
      "reported, and is typically higher — the gap below is what reporting real data is worth.",
  );

  pb.ensureSpace(140);
  pb.y = horizontalBarComparison(pb.doc, {
    x: MARGIN_X,
    y: pb.y,
    width: CONTENT_WIDTH,
    actualValue: financials.actualSee,
    actualLabel: "Your SEE",
    referenceValue: financials.defaultSee,
    referenceLabel: "EU default",
    unit: seeUnitFor(ctx.sector),
    lowerIsBetter: true,
  });

  pb.summaryBox("What the gap is worth", [
    ["Your SEE", `${fmt(financials.actualSee)} ${seeUnitFor(ctx.sector)}`],
    ["EU default value", `${fmt(financials.defaultSee)} ${seeUnitFor(ctx.sector)}`],
    [
      financials.varianceIsBetterThanDefault ? "Better than default by" : "Above default by",
      `${fmt(Math.abs(financials.varianceFromDefault))} ${seeUnitFor(ctx.sector)}`,
    ],
    [
      financials.varianceIsBetterThanDefault ? "Liability avoided this period" : "Additional liability this period",
      fmtEur(Math.abs(financials.savingVsDefaultEur)),
    ],
  ]);

  pb.note(`EU default source: ${financials.defaultSeeSource}`);
}

// ---------------------------------------------------------------------------
// Page 3 — certificate price trend
// ---------------------------------------------------------------------------

function buildPriceTrend(pb: PageBuilder, financials: CbamFinancialImpact, priceHistory: CertificatePricePoint[]) {
  pb.startSection(3, "Certificate Price Trend");

  // One published price is a number, not a trend — say so rather than drawing
  // a single bar and implying a direction.
  if (priceHistory.length < 2) {
    pb.paragraph(
      "Only one published CBAM certificate reference price is on record, so there is no trend to " +
        "show yet. The current price is applied to the liability on page 1.",
    );
    pb.keyValueRow("Current price", `${fmtEur(financials.certificatePrice)} (${financials.certificatePriceQuarter})`);
    pb.note(`Source: ${financials.certificatePriceSource}`);
    return;
  }

  const recent = priceHistory.slice(-PRICE_TREND_QUARTERS);
  const first = recent[0];
  const last = recent[recent.length - 1];
  const change = last.pricePerTonneEur - first.pricePerTonneEur;
  const changePct = first.pricePerTonneEur > 0 ? (change / first.pricePerTonneEur) * 100 : 0;

  pb.paragraph(
    `Published CBAM certificate reference price by quarter. Over the ${recent.length} quarters shown the ` +
      `price has moved ${change >= 0 ? "up" : "down"} ${fmtEur(Math.abs(change))} ` +
      `(${change >= 0 ? "+" : "-"}${fmt(Math.abs(changePct), 1)}%), which applies directly to the liability ` +
      "on page 1 — the same tonnage costs more or less purely on price.",
  );

  pb.ensureSpace(180);
  pb.y = verticalBarChart(pb.doc, {
    x: MARGIN_X,
    y: pb.y,
    width: CONTENT_WIDTH,
    height: 120,
    unit: "EUR/tCO2e",
    data: recent.map((point) => ({
      label: point.quarterLabel,
      value: point.pricePerTonneEur,
      // The live price is the one the liability was computed at — set apart
      // from the historical series it sits in.
      color: point.isCurrent ? undefined : CHART_BLUE,
    })),
  });

  pb.table({
    columns: [
      { header: "Quarter", width: 120 },
      { header: "Price (EUR/tCO2e)", width: 140, align: "right" },
      { header: "Effective from", width: CONTENT_WIDTH - 260 },
    ],
    rows: recent.map((point) => [point.quarterLabel, fmt(point.pricePerTonneEur, 2), fmtDate(new Date(point.validFrom))]),
    highlightRowIndex: recent.findIndex((p) => p.isCurrent),
    highlightNote: "Price applied to the liability in this summary",
  });

  pb.note(`Source: ${last.source}`);
}
