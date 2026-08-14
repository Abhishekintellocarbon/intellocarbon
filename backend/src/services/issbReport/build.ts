import { LOGO_LOCKUP_ON_DARK } from "../brandAssets";
import PDFDocument from "pdfkit";
import type { IssbS1S2Report, Facility, Company, User } from "@prisma/client";
import type { IssbS1S2Metrics } from "../issbCalculation.service";
import { PageBuilder } from "../cbamReport/layout";
import { buildVerifyQr } from "../cbamReport/qr";
import { MARGIN_X, MUTED, NAVY, TEAL, BORDER, fmt, fmtDate } from "../cbamReport/theme";
import { donutChart, CHART_SLATE } from "../cbamReport/charts";

// Cover band is the dark gradient — see brandAssets for why the interior
// pages use a different lockup.
const LOGO_PATH = LOGO_LOCKUP_ON_DARK;

type FacilityWithCompany = Facility & { company: Company & { owner: User } };

// "Rs." rather than the ₹ glyph — pdfkit's standard fonts only cover WinAnsi
// (Latin-1-ish) encoding, and the Indian Rupee Sign (U+20B9) isn't in it
// (same fix as brsrReport/build.ts).
const fmtInr = (v: number | null | undefined): string => (v == null ? "Not disclosed" : `Rs. ${fmt(v, 0)}`);
const fmtCo2e = (v: number | null | undefined): string => (v == null ? "Not disclosed" : `${fmt(v, 2)} tCO2e`);
const fmtText = (v: string | null | undefined): string => (v && v.trim() ? v : "Not yet disclosed.");

/** Stable 4-digit code derived from the report id, so the same report always shows the same reference number. */
const stableDigits = (id: string): string => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return String(1000 + (hash % 9000));
};

const reportReference = (report: IssbS1S2Report): string =>
  `ICT-ISSB-${report.reportingPeriod.replace("FY", "")}-${stableDigits(report.id)}`;

/** How many of the four pillars have at least one narrative field disclosed — used on the cover hero stat. */
export const DISCLOSED_PILLAR_COUNT = (report: IssbS1S2Report): number => {
  const pillars: (unknown | null)[][] = [
    [report.governanceBodyOversight, report.managementRole],
    [report.climateRisksOpportunities, report.businessModelImpact, report.financialEffects, report.scenarioAnalysisResilience],
    [report.riskIdentificationProcess, report.riskManagementProcess, report.riskIntegrationOverall],
    [report.scope3Tco2e, report.targetDescription, report.transitionPlan],
  ];
  return pillars.filter((g) => g.some((v) => v != null && v !== "")).length;
};

/** Foundational 8-section ISSB IFRS S1/S2 PDF — same cover/TOC/header/footer design system as CBAM/CCTS/BRSR reports. */
export const buildIssbS1S2Pdf = async (
  report: IssbS1S2Report,
  facility: FacilityWithCompany,
  metrics: IssbS1S2Metrics,
): Promise<PDFKit.PDFDocument> => {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 50, left: 50, right: 50, bottom: 20 },
    bufferPages: true,
  });

  const reference = reportReference(report);
  const pb = new PageBuilder(doc, reference);
  const qr = await buildVerifyQr(reference);

  buildCoverPage(pb, report, metrics, reference, qr);
  pb.startTocPage();
  buildExecutiveSummary(pb, report, metrics);
  buildEntityDetails(pb, facility, report);
  buildGovernance(pb, report);
  buildStrategy(pb, report);
  buildRiskManagement(pb, report);
  buildMetricsAndTargets(pb, report, metrics);
  buildMethodology(pb);
  buildDeclaration(pb, facility);

  pb.finalize();
  return doc;
};

// ---------------------------------------------------------------------------
// Cover
// ---------------------------------------------------------------------------

function buildCoverPage(
  pb: PageBuilder,
  report: IssbS1S2Report,
  metrics: IssbS1S2Metrics,
  reference: string,
  qr: { buffer: Buffer; url: string },
) {
  const disclosed = DISCLOSED_PILLAR_COUNT(report);
  const heroDelta =
    disclosed === 4
      ? { text: "All 4 pillars disclosed", tone: "green" as const }
      : { text: `${disclosed} of 4 pillars disclosed`, tone: "amber" as const };

  pb.coverShell({
    logoPath: LOGO_PATH,
    eyebrow: "Sustainability-related Financial Disclosure",
    title: "ISSB IFRS S1 & S2 Report",
    subtitle: "General Sustainability-related and Climate-related Financial Disclosures",
    heroLabel: "Scope 1 + 2 GHG Emissions",
    heroValue: fmtCo2e(metrics.ghg.scope1Co2e + metrics.ghg.scope2Co2e),
    heroDelta,
    referenceBadge: reference,
    controlTitle: "Document Control",
    controlRows: [
      ["Document ID", reference],
      ["Version", "v1.0"],
      ["Classification", "Confidential — Investor Disclosure"],
      ["Distribution", "Company Admin, Investors, Assurance Provider"],
      ["Generated", fmtDate(new Date())],
      ["Reporting period", report.reportingPeriod],
    ],
    qrPngBuffer: qr.buffer,
    qrCaption: "Scan to verify",
    qrUrl: qr.url,
    docIdBadge: `DOC ID  ${reference}  ·  v1.0`,
    confidentialityText:
      "This document is classified Confidential — Investor Disclosure and is intended solely for the named distribution list above. Unauthorised copying or distribution is prohibited. © 2026 Intellocarbon Solutions Private Limited.",
  });
}

// ---------------------------------------------------------------------------
// Section 01 — Executive Summary
// ---------------------------------------------------------------------------

function buildExecutiveSummary(pb: PageBuilder, report: IssbS1S2Report, metrics: IssbS1S2Metrics) {
  pb.startSection(1, "Executive Summary");

  pb.paragraph(
    `This report presents this facility's sustainability- and climate-related financial disclosures for ${report.reportingPeriod}, ` +
      "structured around the four core pillars common to IFRS S1 (General Requirements) and IFRS S2 (Climate-related Disclosures): " +
      "Governance, Strategy, Risk Management, and Metrics & Targets.",
  );

  pb.table({
    columns: [
      { header: "#", width: 25 },
      { header: "Pillar", width: 220 },
      { header: "Key figure", width: 250, align: "right" },
    ],
    rows: [
      ["1", "Governance", report.governanceBodyOversight ? "Disclosed" : "Not yet disclosed"],
      ["2", "Strategy", report.climateRisksOpportunities ? "Disclosed" : "Not yet disclosed"],
      ["3", "Risk Management", report.riskIdentificationProcess ? "Disclosed" : "Not yet disclosed"],
      ["4", "Metrics & Targets", fmtCo2e(metrics.ghg.totalCo2e)],
    ],
  });

  pb.note(
    "Scope 1 and Scope 2 figures under Metrics & Targets (Section 06) are derived from this facility's existing CBAM/CCTS activity data. Governance, Strategy, and Risk Management (Sections 03-05) are narrative disclosures entered directly for this reporting period.",
  );
}

// ---------------------------------------------------------------------------
// Section 02 — Entity and Reporting Period Details
// ---------------------------------------------------------------------------

function buildEntityDetails(pb: PageBuilder, facility: FacilityWithCompany, report: IssbS1S2Report) {
  pb.startSection(2, "Entity and Reporting Period Details");

  const { company } = facility;
  const companyRows: [string, string][] = [
    ["Company name", company.name],
    ["Registration number", company.registrationNumber || "Not provided"],
    ["Sector", company.sector],
    ["Location", [company.city, company.state, company.country].filter(Boolean).join(", ") || "Not provided"],
  ];

  const facilityRows: [string, string][] = [
    ["Facility name", facility.name],
    ["Reporting period", report.reportingPeriod],
    ["Reporting basis", "Facility-level, entity-controlled operations"],
    ["Framework", "IFRS S1 (General) + IFRS S2 (Climate)"],
  ];

  pb.keyValueColumns("COMPANY", companyRows, "FACILITY", facilityRows);
}

// ---------------------------------------------------------------------------
// Section 03 — Governance (IFRS S1 §27-28, IFRS S2 §6)
// ---------------------------------------------------------------------------

function buildGovernance(pb: PageBuilder, report: IssbS1S2Report) {
  pb.startSection(3, "Governance");

  pb.paragraph(
    "IFRS S1 and IFRS S2 both require disclosure of the governance processes, controls and procedures an entity uses to " +
      "monitor and manage sustainability- and climate-related risks and opportunities.",
  );

  pb.heading("Oversight by the governance body");
  pb.paragraph(fmtText(report.governanceBodyOversight));

  pb.heading("Management's role");
  pb.paragraph(fmtText(report.managementRole));
}

// ---------------------------------------------------------------------------
// Section 04 — Strategy (IFRS S1 §29-42, IFRS S2 §9-22)
// ---------------------------------------------------------------------------

function buildStrategy(pb: PageBuilder, report: IssbS1S2Report) {
  pb.startSection(4, "Strategy");

  pb.paragraph(
    "Strategy discloses how sustainability- and climate-related risks and opportunities affect the entity's business " +
      "model, strategy and financial planning, including resilience under different climate scenarios.",
  );

  pb.heading("Climate-related risks and opportunities");
  pb.paragraph(fmtText(report.climateRisksOpportunities));

  pb.heading("Effect on business model and value chain");
  pb.paragraph(fmtText(report.businessModelImpact));

  pb.heading("Effect on financial position, performance and cash flows");
  pb.paragraph(fmtText(report.financialEffects));

  pb.heading("Climate resilience — scenario analysis");
  pb.paragraph(fmtText(report.scenarioAnalysisResilience));
}

// ---------------------------------------------------------------------------
// Section 05 — Risk Management (IFRS S1 §43-45, IFRS S2 §25-27)
// ---------------------------------------------------------------------------

function buildRiskManagement(pb: PageBuilder, report: IssbS1S2Report) {
  pb.startSection(5, "Risk Management");

  pb.paragraph(
    "Risk Management discloses the processes used to identify, assess, prioritise and monitor sustainability- and " +
      "climate-related risks, and whether and how those processes are integrated into the entity's overall risk " +
      "management process.",
  );

  pb.heading("Risk identification and assessment process");
  pb.paragraph(fmtText(report.riskIdentificationProcess));

  pb.heading("Risk management and prioritisation process");
  pb.paragraph(fmtText(report.riskManagementProcess));

  pb.heading("Integration into overall risk management");
  pb.paragraph(fmtText(report.riskIntegrationOverall));
}

// ---------------------------------------------------------------------------
// Section 06 — Metrics & Targets (IFRS S1 §46-53, IFRS S2 §28-36)
// ---------------------------------------------------------------------------

function buildMetricsAndTargets(pb: PageBuilder, report: IssbS1S2Report, metrics: IssbS1S2Metrics) {
  pb.startSection(6, "Metrics & Targets");

  pb.paragraph(
    "Scope 1 and Scope 2 emissions below are reused directly from this facility's existing CBAM/CCTS activity data — " +
      "on the IPCC AR5 (100-yr) Global Warming Potential basis, following the GHG Protocol/TCFD convention IFRS S2 " +
      "aligns to — and are not recalculated here. Scope 3 is a manual disclosure, as no value-chain emissions " +
      "calculation engine exists on this platform yet.",
  );

  pb.summaryBox(
    "GHG Emissions",
    [
      ["Scope 1 (direct, AR5)", fmtCo2e(metrics.ghg.scope1Co2e)],
      ["Scope 2 (indirect)", fmtCo2e(metrics.ghg.scope2Co2e)],
      ["Scope 3 (value chain, disclosed)", fmtCo2e(metrics.ghg.scope3Co2e)],
      ["Total GHG emissions", fmtCo2e(metrics.ghg.totalCo2e)],
    ],
    { tone: "teal" },
  );

  pb.note(
    `Scope 1/2 rolled up from ${metrics.ghg.activityDataCount} submitted activity data ${metrics.ghg.activityDataCount === 1 ? "entry" : "entries"} for the financial year ${metrics.fyWindow.label} (${fmtDate(metrics.fyWindow.start)} – ${fmtDate(new Date(metrics.fyWindow.end.getTime() - 86400000))}).`,
  );

  if (metrics.ghg.scope1Co2e + metrics.ghg.scope2Co2e > 0) {
    pb.ensureSpace(220);
    pb.heading("Scope 1 / Scope 2 Composition");
    pb.y = donutChart(pb.doc, {
      x: MARGIN_X,
      y: pb.y,
      diameter: 130,
      unit: "tCO2e",
      centerLabel: "Total",
      segments: [
        { label: "Scope 1", value: metrics.ghg.scope1Co2e, color: TEAL },
        { label: "Scope 2", value: metrics.ghg.scope2Co2e, color: CHART_SLATE },
      ],
    });
  }

  pb.heading("Targets and transition plan");
  pb.table({
    columns: [
      { header: "Metric", width: 300 },
      { header: "Value", width: 195, align: "right" },
    ],
    rows: [
      ["Baseline year", report.baselineYear != null ? String(report.baselineYear) : "Not disclosed"],
      ["Baseline emissions", fmtCo2e(report.baselineEmissionsTco2e)],
      ["Target year", report.targetYear != null ? String(report.targetYear) : "Not disclosed"],
      [
        "Change vs. baseline",
        metrics.targets.changeFromBaselinePct == null ? "Not calculable" : `${fmt(metrics.targets.changeFromBaselinePct, 1)}%`,
      ],
      ["Internal carbon price", fmtInr(report.internalCarbonPriceInr) + (report.internalCarbonPriceInr != null ? "/tCO2e" : "")],
      ["Climate-aligned capital expenditure", fmtInr(report.climateCapexInr)],
    ],
  });

  pb.heading("Target description");
  pb.paragraph(fmtText(report.targetDescription));

  pb.heading("Transition plan");
  pb.paragraph(fmtText(report.transitionPlan));
}

// ---------------------------------------------------------------------------
// Section 07 — Methodology and Regulatory Basis
// ---------------------------------------------------------------------------

function buildMethodology(pb: PageBuilder) {
  pb.startSection(7, "Methodology and Regulatory Basis");

  pb.paragraph(
    "This report is prepared with reference to IFRS S1 (General Requirements for Disclosure of Sustainability-related " +
      "Financial Information) and IFRS S2 (Climate-related Disclosures), issued by the International Sustainability " +
      "Standards Board (ISSB), at a foundational level covering the four core pillars both standards share.",
  );

  pb.heading("Four-pillar structure");
  pb.paragraph(
    "Governance, Strategy, and Risk Management (Sections 03-05) apply the disclosure architecture common to both " +
      "IFRS S1 and IFRS S2. Metrics & Targets (Section 06) applies IFRS S2's climate-specific cross-industry metrics " +
      "(Scope 1, 2 and 3 GHG emissions, targets, and transition plan).",
  );

  pb.heading("GHG calculation basis");
  pb.paragraph(
    "Scope 1 and Scope 2 emissions reuse this facility's existing activity data, computed on the IPCC AR5 (100-yr) " +
      "Global Warming Potential basis — the GHG Protocol/TCFD convention IFRS S2 follows internationally, distinct " +
      "from the AR2/BUR3 basis used for India's domestic BRSR/CCTS reporting on the same underlying activity data.",
  );

  pb.heading("Scope of this disclosure");
  pb.paragraph(
    "This is a foundational-level ISSB disclosure covering the core requirements of both standards. It does not yet " +
      "include industry-based SASB metrics, full value-chain Scope 3 categorisation, or detailed scenario-modelled " +
      "financial statement effects.",
  );
}

// ---------------------------------------------------------------------------
// Section 08 — Declaration
// ---------------------------------------------------------------------------

function buildDeclaration(pb: PageBuilder, facility: FacilityWithCompany) {
  pb.startSection(8, "Declaration");

  const owner = facility.company.owner;

  pb.heading("Declaration");
  pb.paragraph(
    `I/We, on behalf of ${facility.company.name}, declare that the information contained in this ISSB IFRS S1 & S2 ` +
      "Report has been prepared in good faith based on data submitted through the Intellocarbon platform, and " +
      "represents our best current disclosure under the four core pillars for this facility and reporting period.",
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
}
