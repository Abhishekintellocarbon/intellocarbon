import { LOGO_LOCKUP_ON_DARK } from "../brandAssets";
import PDFDocument from "pdfkit";
import type { IssbS1S2Report, Facility, Company, User } from "@prisma/client";
import type { IssbS1S2Metrics } from "../issbCalculation.service";
import { PageBuilder } from "../cbamReport/layout";
import { buildVerifyQr } from "../cbamReport/qr";
import { MARGIN_X, MUTED, NAVY, TEAL, BORDER, fmt, fmtDate, fmtDateTime } from "../cbamReport/theme";
import { donutChart, CHART_SLATE } from "../cbamReport/charts";
import type { ReportPhase2Data } from "../reportSections/phase2Data";
import { drawTargetsTable, drawTrajectoryChart, hasTargetsToReport } from "../reportSections/targetsAndTrajectory";

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
  /**
   * Optional because it genuinely is: a company that has entered no reduction
   * target has nothing here, and that is the common case rather than an error.
   * The production loader always supplies it.
   */
  phase2?: ReportPhase2Data,
): Promise<PDFKit.PDFDocument> => {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 50, left: 50, right: 50, bottom: 20 },
    bufferPages: true,
  });

  const reference = reportReference(report);
  const pb = new PageBuilder(doc, reference, facility.company.name);
  const qr = await buildVerifyQr(reference);

  buildCoverPage(pb, report, metrics, reference, qr);
  pb.startTocPage();
  buildExecutiveSummary(pb, report, metrics);
  buildEntityDetails(pb, facility, report);
  buildGovernance(pb, report);
  buildStrategy(pb, report);
  buildRiskManagement(pb, report);
  buildMetricsAndTargets(pb, report, metrics, phase2);
  buildMethodologyAssuranceAndDeclaration(pb, facility);

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
      ["Generated", fmtDateTime(new Date())],
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
  pb.startSection(1, "Executive Summary and Entity Details");

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
    "Scope 1 and Scope 2 figures under Metrics & Targets (Section 05) are derived from this facility's existing CBAM/CCTS activity data. Governance, Strategy, and Risk Management (Sections 02-04) are narrative disclosures entered directly for this reporting period.",
  );
}

// ---------------------------------------------------------------------------
// Section 01 continued — entity and reporting period
// ---------------------------------------------------------------------------

/**
 * Continues Section 01 rather than opening a section of its own. Eight
 * key/value rows filled a third of a page, and the only reason they were on a
 * page of their own was that startSection() forces a break.
 */
function buildEntityDetails(pb: PageBuilder, facility: FacilityWithCompany, report: IssbS1S2Report) {
  pb.heading("Entity and reporting period");

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
// Section 02 — Governance (IFRS S1 §27-28, IFRS S2 §6)
// ---------------------------------------------------------------------------

function buildGovernance(pb: PageBuilder, report: IssbS1S2Report) {
  pb.startSection(2, "Governance");

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
// Section 03 — Strategy (IFRS S1 §29-42, IFRS S2 §9-22)
// ---------------------------------------------------------------------------

function buildStrategy(pb: PageBuilder, report: IssbS1S2Report) {
  pb.startSection(3, "Strategy");

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
// Section 04 — Risk Management (IFRS S1 §43-45, IFRS S2 §25-27)
// ---------------------------------------------------------------------------

function buildRiskManagement(pb: PageBuilder, report: IssbS1S2Report) {
  pb.startSection(4, "Risk Management");

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
// Section 05 — Metrics & Targets (IFRS S1 §46-53, IFRS S2 §28-36)
// ---------------------------------------------------------------------------

function buildMetricsAndTargets(
  pb: PageBuilder,
  report: IssbS1S2Report,
  metrics: IssbS1S2Metrics,
  phase2?: ReportPhase2Data,
) {
  pb.startSection(5, "Metrics & Targets");

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

  buildCompanyTargets(pb, phase2);
}

/**
 * The company's reduction targets and its progress against them — IFRS S2
 * §§33-36, which asks for each target's scope, baseline, period, and the
 * entity's performance against it, not only the single headline target the
 * ISSB entry form captures.
 *
 * These are company-level targets shown in a facility-level report, which the
 * heading and note say plainly. A company sets one Scope 1+2 target across its
 * operations; splitting it per facility would be an allocation nobody stated.
 *
 * Renders nothing when no target has been submitted. IFRS S2 §36 permits an
 * entity to have no target, so an absent section is a truthful answer here
 * where an empty table under a heading would look like a defect.
 */
function buildCompanyTargets(pb: PageBuilder, phase2?: ReportPhase2Data) {
  if (!phase2) return;

  pb.heading("Reduction targets and progress (entity-level)");

  if (!hasTargetsToReport(phase2)) {
    pb.paragraph(
      "No entity-level reduction target has been submitted for this company. The baseline and target year stated " +
        "above are the ones entered against this disclosure; no separate target register entry exists to report " +
        "progress against.",
      { size: 9.5, color: MUTED },
    );
    return;
  }

  pb.paragraph(
    "These targets are set at company level and cover the scopes named against each. They are reproduced here " +
      "unchanged; this facility's share of them is not apportioned, because no such apportionment has been stated.",
    { size: 9.5 },
  );

  drawTargetsTable(pb, phase2);

  pb.heading("Emissions against the stated path");
  drawTrajectoryChart(pb, phase2.trajectory);
}

// ---------------------------------------------------------------------------
// Section 06 — Methodology, Assurance and Declaration
// ---------------------------------------------------------------------------

/**
 * Three closing subjects in one section.
 *
 * Methodology, assurance and the signature block each ran to about a third of
 * a page and each took a page, because startSection() forces a break. They
 * belong together anyway: all three are statements about the standing of the
 * document rather than disclosures within it.
 */
function buildMethodologyAssuranceAndDeclaration(pb: PageBuilder, facility: FacilityWithCompany) {
  pb.startSection(6, "Methodology, Assurance and Declaration");

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

  buildAssurance(pb);
  buildDeclaration(pb, facility);
}

/**
 * IFRS S1 §§ 78-79 require an entity to state whether its sustainability
 * disclosures have been assured and by whom. This platform holds no assurance
 * record against an ISSB disclosure — the verifier workflow covers CBAM, CCTS
 * and BRSR only — so the honest answer is a stated absence, in the same block
 * shape every other report uses for the same question.
 */
function buildAssurance(pb: PageBuilder) {
  pb.verificationBlock({
    title: "Assurance status",
    verifierName: null,
    verifierOrg: null,
    accreditationRef: null,
    statementLabel: "External assurance",
    statement: null,
    verifiedAt: null,
    unverifiedNote:
      "This disclosure has not been externally assured. No assurance engagement over an ISSB IFRS S1/S2 disclosure " +
      "is recorded on the Intellocarbon platform, and no figure in this report carries an assurance opinion. Where " +
      "an assurance provider is engaged separately, their report is the record of it and this document is not.",
  });
}

function buildDeclaration(pb: PageBuilder, facility: FacilityWithCompany) {
  pb.heading("Declaration");

  const owner = facility.company.owner;

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
