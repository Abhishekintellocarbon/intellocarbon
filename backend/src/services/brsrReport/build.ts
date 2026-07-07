import path from "path";
import PDFDocument from "pdfkit";
import type { BrsrCoreReport, Facility, Company, User, BrsrVerificationRequest } from "@prisma/client";
import type { BrsrCoreMetrics } from "../brsrCalculation.service";
import { PageBuilder } from "../cbamReport/layout";
import { buildVerifyQr } from "../cbamReport/qr";
import {
  MARGIN_X,
  CONTENT_WIDTH,
  MUTED,
  NAVY,
  TEAL,
  BORDER,
  fmt,
  fmtInt,
  fmtDate,
  type StatusTone,
} from "../cbamReport/theme";
import { donutChart, horizontalGroupedBars, CHART_BLUE, CHART_SLATE } from "../cbamReport/charts";

const LOGO_PATH = path.join(__dirname, "../../assets/logo-full.png");

type FacilityWithCompany = Facility & { company: Company & { owner: User } };
type ReportWithVerification = BrsrCoreReport & {
  verificationRequest?: (BrsrVerificationRequest & { verifier: User | null }) | null;
};

// "Rs." rather than the ₹ glyph — pdfkit's standard fonts only cover WinAnsi
// (Latin-1-ish) encoding, and the Indian Rupee Sign (U+20B9) isn't in it, so
// it silently renders as a stray glyph (the same class of bug as unicode
// arrows — see drawTrendMarker in cbamReport/layout.ts).
const fmtPerCrore = (perRupee: number | null, unit: string): string =>
  perRupee == null ? "Not disclosed" : `${fmt(perRupee * 1e7, 4)} ${unit}/Rs. Cr`;
const fmtPct = (v: number | null | undefined, digits = 1): string => (v == null ? "Not disclosed" : `${fmt(v, digits)}%`);
const fmtNum = (v: number | null | undefined, unit: string, digits = 2): string => (v == null ? "Not disclosed" : `${fmt(v, digits)} ${unit}`);
const fmtCount = (v: number | null | undefined): string => (v == null ? "Not disclosed" : fmtInt(v));
const fmtInr = (v: number | null | undefined): string => (v == null ? "Not disclosed" : `Rs. ${fmt(v, 0)}`);

/** Stable 4-digit code derived from the report id, so the same report always shows the same reference number. */
const stableDigits = (id: string): string => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return String(1000 + (hash % 9000));
};

const reportReference = (report: BrsrCoreReport): string => `ICT-BRSR-${report.reportingPeriod.replace("FY", "")}-${stableDigits(report.id)}`;

/** Of the 9 BRSR Core attributes, how many are disclosed on this report — attribute 1 (GHG) is always derived, the other 8 are manual fields. Reused by facilityDashboard.service.ts for the BRSR status card. */
export const DISCLOSED_ATTRIBUTE_COUNT = (report: BrsrCoreReport): number => {
  const groups: (unknown | null)[][] = [
    [report.waterWithdrawnKl, report.waterDischargedKl],
    [report.wasteGeneratedTonnes, report.wasteRecoveredTonnes],
    [report.renewableEnergyConsumptionGj, report.nonRenewableEnergyConsumptionGj],
    [report.employeeCountTotal, report.employeeCountFemale],
    [report.womenInWorkforcePct, report.womenInManagementPct],
    [report.procurementFromMsmePct],
    [report.purchasesFromTop10SuppliersPct, report.salesToTop10CustomersPct],
    [report.consumerComplaintsCount, report.consumerComplaintsResolvedPct],
  ];
  // GHG (attribute 1) is always disclosed — it's derived from the calculation engine, not a manual field.
  return 1 + groups.filter((g) => g.some((v) => v != null)).length;
};

/** Full 11-section BRSR Core PDF — same cover/TOC/header/footer design system as the CBAM and CCTS reports. */
export const buildBrsrCorePdf = async (
  report: ReportWithVerification,
  facility: FacilityWithCompany,
  metrics: BrsrCoreMetrics,
): Promise<PDFKit.PDFDocument> => {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 50, left: 50, right: 50, bottom: 20 },
    bufferPages: true,
  });

  const reference = reportReference(report);
  const pb = new PageBuilder(doc, reference, LOGO_PATH);
  const qr = await buildVerifyQr(reference);

  buildCoverPage(pb, report, metrics, reference, qr);
  pb.startTocPage();
  buildExecutiveSummary(pb, report, metrics);
  buildEntityDetails(pb, facility, report);
  buildGhgFootprint(pb, metrics);
  buildWaterAndWaste(pb, metrics);
  buildEnergyFootprint(pb, metrics);
  buildEmployeeWellbeing(pb, report, metrics);
  buildGenderAndInclusion(pb, report, metrics);
  buildOpennessAndFairness(pb, report);
  buildMethodology(pb);
  buildVerification(pb, report);
  buildDeclarationAnnexures(pb, facility);

  pb.finalize();
  return doc;
};

// ---------------------------------------------------------------------------
// Cover
// ---------------------------------------------------------------------------

function buildCoverPage(
  pb: PageBuilder,
  report: BrsrCoreReport,
  metrics: BrsrCoreMetrics,
  reference: string,
  qr: { buffer: Buffer; url: string },
) {
  const disclosed = DISCLOSED_ATTRIBUTE_COUNT(report);
  const heroDelta =
    disclosed === 9
      ? { text: "All 9 BRSR Core attributes disclosed", tone: "green" as const }
      : { text: `${disclosed} of 9 BRSR Core attributes disclosed`, tone: "amber" as const };

  pb.coverShell({
    logoPath: LOGO_PATH,
    eyebrow: "Regulatory Reporting Document",
    title: "BRSR Core Report",
    subtitle: "SEBI Business Responsibility and Sustainability Reporting — Core Disclosures",
    heroLabel: "GHG Emission Intensity",
    heroValue: fmtPerCrore(metrics.ghg.intensityPerRupeeTurnover, "tCO2e"),
    heroDelta,
    referenceBadge: reference,
    controlTitle: "Document Control",
    controlRows: [
      ["Document ID", reference],
      ["Version", "v1.0"],
      ["Classification", "Confidential — Regulatory Submission"],
      ["Distribution", "Company Admin, Assurance Provider"],
      ["Generated", fmtDate(new Date())],
      ["Reporting period", report.reportingPeriod],
    ],
    qrPngBuffer: qr.buffer,
    qrCaption: "Scan to verify",
    qrUrl: qr.url,
    docIdBadge: `DOC ID  ${reference}  ·  v1.0`,
    confidentialityText:
      "This document is classified Confidential — Regulatory Submission and is intended solely for the named distribution list above. Unauthorised copying or distribution is prohibited. © 2026 Intellocarbon Solutions Private Limited.",
  });
}

// ---------------------------------------------------------------------------
// Section 01 — Executive Summary
// ---------------------------------------------------------------------------

function buildExecutiveSummary(pb: PageBuilder, report: BrsrCoreReport, metrics: BrsrCoreMetrics) {
  pb.startSection(1, "Executive Summary");

  pb.paragraph(
    `This report presents the 9 BRSR Core ESG attributes disclosed by ${report.reportingPeriod} for this facility, ` +
      `under SEBI's Business Responsibility and Sustainability Reporting (Core) framework.`,
  );

  pb.table({
    columns: [
      { header: "#", width: 25 },
      { header: "BRSR Core attribute", width: 220 },
      { header: "Key figure", width: 250, align: "right" },
    ],
    rows: [
      ["1", "GHG footprint", fmtPerCrore(metrics.ghg.intensityPerRupeeTurnover, "tCO2e")],
      ["2", "Water footprint", fmtNum(metrics.water.consumptionKl, "KL consumed")],
      ["3", "Waste management", fmtPct(metrics.waste.recoveryRatePct) + " recovered"],
      ["4", "Energy footprint", fmtPct(metrics.energy.renewablePct) + " renewable"],
      ["5", "Employee wellbeing", fmtCount(report.employeeCountTotal) + " employees"],
      ["6", "Gender diversity", fmtPct(report.womenInWorkforcePct) + " women in workforce"],
      ["7", "Inclusive development", fmtPct(report.procurementFromMsmePct) + " from MSMEs"],
      ["8", "Openness of business", fmtPct(report.purchasesFromTop10SuppliersPct) + " top-10 supplier conc."],
      ["9", "Customer fairness", fmtPct(report.consumerComplaintsResolvedPct) + " complaints resolved"],
    ],
  });

  pb.note(
    "Attribute 1 (GHG footprint) is derived from this facility's existing CBAM/CCTS activity data — see Section 03. All other attributes are company disclosures entered directly for this reporting period.",
  );
}

// ---------------------------------------------------------------------------
// Section 02 — Entity and Reporting Period Details
// ---------------------------------------------------------------------------

function buildEntityDetails(pb: PageBuilder, facility: FacilityWithCompany, report: BrsrCoreReport) {
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
    ["Turnover (disclosed)", fmtInr(report.turnoverInr ?? company.annualTurnoverInr)],
    ["Employee count", fmtCount(report.employeeCountTotal)],
  ];

  pb.keyValueColumns("COMPANY", companyRows, "FACILITY", facilityRows);
}

// ---------------------------------------------------------------------------
// Section 03 — GHG Footprint
// ---------------------------------------------------------------------------

function buildGhgFootprint(pb: PageBuilder, metrics: BrsrCoreMetrics) {
  pb.startSection(3, "GHG Footprint");

  pb.paragraph(
    "Scope 1 and Scope 2 emissions below are reused directly from this facility's existing CBAM/CCTS activity data — " +
      "on the CCTS/AR2-BUR3 GWP basis, since BRSR is an Indian regulatory framework — and are not recalculated here. " +
      "See the CCTS GHG Intensity Report (Sections 05-08) for the full emissions breakdown.",
  );

  pb.summaryBox(
    "GHG Footprint",
    [
      ["Scope 1 (direct, AR2/BUR3)", `${fmt(metrics.ghg.scope1Co2e, 2)} tCO2e`],
      ["Scope 2 (indirect)", `${fmt(metrics.ghg.scope2Co2e, 2)} tCO2e`],
      ["Total GHG emissions", `${fmt(metrics.ghg.totalCo2e, 2)} tCO2e`],
      ["Intensity per rupee of turnover", fmtPerCrore(metrics.ghg.intensityPerRupeeTurnover, "tCO2e")],
      [
        "Intensity per unit of production",
        metrics.ghg.intensityPerUnitProduction == null
          ? "Not available"
          : `${fmt(metrics.ghg.intensityPerUnitProduction, 4)} tCO2e/t`,
      ],
    ],
    { tone: "teal" },
  );

  pb.note(
    `Rolled up from ${metrics.ghg.activityDataCount} submitted activity data ${metrics.ghg.activityDataCount === 1 ? "entry" : "entries"} for the financial year ${metrics.fyWindow.label} (${fmtDate(metrics.fyWindow.start)} – ${fmtDate(new Date(metrics.fyWindow.end.getTime() - 86400000))}). Production quantity used for the per-unit ratio: ${fmtInt(metrics.ghg.productionQuantityT)} t.`,
  );
}

// ---------------------------------------------------------------------------
// Section 04 — Water & Waste
// ---------------------------------------------------------------------------

function buildWaterAndWaste(pb: PageBuilder, metrics: BrsrCoreMetrics) {
  pb.startSection(4, "Water & Waste");

  pb.heading("Water Footprint");
  pb.paragraph("Water withdrawn, discharged and consumed by this facility during the reporting period.");
  pb.table({
    columns: [
      { header: "Metric", width: 300 },
      { header: "Value", width: 195, align: "right" },
    ],
    rows: [
      ["Water withdrawn", fmtNum(metrics.water.withdrawnKl, "KL")],
      ["Water discharged", fmtNum(metrics.water.dischargedKl, "KL")],
      // Plain hyphen, not the U+2212 minus sign — pdfkit's standard fonts only
      // cover WinAnsi, which lacks it (same bug class as the ₹ and unicode-arrow fixes).
      ["Water consumption (withdrawn - discharged)", fmtNum(metrics.water.consumptionKl, "KL")],
      ["Consumption rate (consumption ÷ withdrawn)", fmtPct(metrics.water.consumptionRatePct)],
      ["Water consumption intensity per rupee turnover", fmtPerCrore(metrics.water.intensityPerRupeeTurnover, "KL")],
    ],
    highlightRowIndex: 3,
  });

  if (metrics.water.withdrawnKl != null && metrics.water.dischargedKl != null && metrics.water.consumptionKl != null) {
    pb.ensureSpace(130);
    pb.heading("Water Balance");
    pb.y = horizontalGroupedBars(pb.doc, {
      x: MARGIN_X,
      y: pb.y,
      width: CONTENT_WIDTH,
      data: [
        { label: "Withdrawn", value: metrics.water.withdrawnKl, unit: "KL", color: CHART_BLUE },
        { label: "Discharged", value: metrics.water.dischargedKl, unit: "KL", color: CHART_SLATE },
        { label: "Consumed", value: metrics.water.consumptionKl, unit: "KL", color: TEAL },
      ],
    });
  }

  pb.heading("Waste Management");
  pb.paragraph("Waste generated and recovered/recycled by this facility during the reporting period.");
  pb.table({
    columns: [
      { header: "Metric", width: 300 },
      { header: "Value", width: 195, align: "right" },
    ],
    rows: [
      ["Waste generated", fmtNum(metrics.waste.generatedTonnes, "t")],
      ["Waste recovered / recycled", fmtNum(metrics.waste.recoveredTonnes, "t")],
      ["Recovery rate", fmtPct(metrics.waste.recoveryRatePct)],
      ["Waste intensity per rupee turnover", fmtPerCrore(metrics.waste.intensityPerRupeeTurnover, "t")],
    ],
    highlightRowIndex: 2,
  });
}

// ---------------------------------------------------------------------------
// Section 05 — Energy Footprint
// ---------------------------------------------------------------------------

function buildEnergyFootprint(pb: PageBuilder, metrics: BrsrCoreMetrics) {
  pb.startSection(5, "Energy Footprint");

  pb.paragraph(
    "Total energy consumption is split between renewable and non-renewable sources below (a manual disclosure). " +
      "Electricity and imported steam energy already captured in this facility's activity data are shown separately for reference.",
  );

  pb.table({
    columns: [
      { header: "Metric", width: 300 },
      { header: "Value", width: 195, align: "right" },
    ],
    rows: [
      ["Renewable energy consumption", fmtNum(metrics.energy.renewableGj, "GJ")],
      ["Non-renewable energy consumption", fmtNum(metrics.energy.nonRenewableGj, "GJ")],
      ["Total energy consumption", fmtNum(metrics.energy.totalGj, "GJ")],
      ["Renewable share", fmtPct(metrics.energy.renewablePct)],
    ],
    highlightRowIndex: 2,
  });

  if (metrics.energy.renewableGj != null && metrics.energy.nonRenewableGj != null) {
    pb.ensureSpace(220);
    pb.heading("Renewable / Non-renewable Composition");
    pb.y = donutChart(pb.doc, {
      x: MARGIN_X,
      y: pb.y,
      diameter: 130,
      unit: "GJ",
      centerLabel: "Total",
      segments: [
        { label: "Renewable", value: metrics.energy.renewableGj, color: TEAL },
        { label: "Non-renewable", value: metrics.energy.nonRenewableGj, color: CHART_SLATE },
      ],
    });
  }

  pb.note(
    `For reference: ${fmt(metrics.energy.electricityAndSteamGjReused, 2)} GJ of this facility's electricity and imported steam energy is already captured in its CBAM/CCTS activity data (see Section 03).`,
  );
}

// ---------------------------------------------------------------------------
// Section 06 — Employee Wellbeing and Safety
// ---------------------------------------------------------------------------

function buildEmployeeWellbeing(pb: PageBuilder, report: BrsrCoreReport, metrics: BrsrCoreMetrics) {
  pb.startSection(6, "Employee Wellbeing and Safety");

  pb.summaryBox("Employee Wellbeing", [
    ["Total employees", fmtCount(report.employeeCountTotal)],
    ["Female employees", fmtCount(report.employeeCountFemale)],
    ["Wages paid — male", fmtInr(report.wagesPaidMaleInr)],
    ["Wages paid — female", fmtInr(report.wagesPaidFemaleInr)],
    ["Safety incidents reported", fmtCount(report.safetyIncidentsCount)],
    [
      "Safety incident rate",
      metrics.employeeWellbeing.safetyIncidentRatePer1000 == null
        ? "Not calculable (missing incident count or employee count)"
        : `${fmt(metrics.employeeWellbeing.safetyIncidentRatePer1000, 2)} per 1,000 employees`,
    ],
  ]);

  pb.note(
    "Safety incident rate is incidents per 1,000 employees — hours-worked data isn't captured on this platform, so a per-lakh-hours rate can't be computed.",
  );
}

// ---------------------------------------------------------------------------
// Section 07 — Gender Diversity & Inclusive Development
// ---------------------------------------------------------------------------

function buildGenderAndInclusion(pb: PageBuilder, report: BrsrCoreReport, metrics: BrsrCoreMetrics) {
  pb.startSection(7, "Gender Diversity & Inclusive Development");

  pb.heading("Gender Diversity");
  pb.table({
    columns: [
      { header: "Metric", width: 300 },
      { header: "Value", width: 195, align: "right" },
    ],
    rows: [
      ["Women in workforce", fmtPct(report.womenInWorkforcePct)],
      ["Women in management / board", fmtPct(report.womenInManagementPct)],
    ],
  });

  const gd = metrics.genderDiversity;

  if (report.employeeCountFemale != null && gd.maleHeadcount != null) {
    pb.ensureSpace(220);
    pb.heading("Workforce Gender Split");
    pb.y = donutChart(pb.doc, {
      x: MARGIN_X,
      y: pb.y,
      diameter: 130,
      unit: "employees",
      centerLabel: "Total",
      segments: [
        { label: "Women", value: report.employeeCountFemale, color: TEAL },
        { label: "Men", value: gd.maleHeadcount, color: CHART_BLUE },
      ],
    });
  }
  if (gd.payGapPct != null) {
    pb.summaryBox("Gender Pay Gap", [
      ["Average wage — male", `${fmtInr(gd.avgWageMaleInr)} (${fmtCount(gd.maleHeadcount)} employees)`],
      ["Average wage — female", `${fmtInr(gd.avgWageFemaleInr)} (${fmtCount(report.employeeCountFemale)} employees)`],
      ["Gender pay gap", `${fmt(Math.abs(gd.payGapPct), 1)}%`],
    ]);
    pb.note(
      `Average female pay is ${fmt(Math.abs(gd.payGapPct), 1)}% ${gd.payGapPct >= 0 ? "lower" : "higher"} than average male pay, computed from wages paid and headcount by gender for this reporting period.`,
    );
  } else {
    pb.note(
      "Gender pay gap requires wages paid and headcount by gender for both groups — not fully disclosed for this reporting period.",
    );
  }

  pb.heading("Inclusive Development");
  pb.paragraph("Share of procurement sourced from small and marginal producers or MSMEs.");
  pb.summaryBox("Inclusive Development", [
    ["Procurement from MSMEs / small producers", fmtPct(report.procurementFromMsmePct)],
  ]);
}

// ---------------------------------------------------------------------------
// Section 08 — Openness of Business & Customer Fairness
// ---------------------------------------------------------------------------

const concentrationTone = (pct: number | null | undefined): StatusTone => {
  if (pct == null) return "amber";
  if (pct >= 50) return "red";
  if (pct >= 25) return "amber";
  return "green";
};

/** One-line interpretive note mechanically derived from the disclosed % and its risk band — not generic commentary. */
const concentrationNote = (label: string, noun: string, pct: number | null | undefined): string | null => {
  if (pct == null) return null;
  const tone = concentrationTone(pct);
  const pctLabel = fmtPct(pct);
  if (tone === "red") {
    return `${label} concentration at ${pctLabel} (Red band) indicates dependency on a small ${noun} base — a factor buyers and lenders may assess independently.`;
  }
  if (tone === "amber") {
    return `${label} concentration at ${pctLabel} (Amber band) reflects moderate reliance on a small ${noun} base.`;
  }
  return `${label} concentration at ${pctLabel} (Green band) reflects a diversified ${noun} base.`;
};

function buildOpennessAndFairness(pb: PageBuilder, report: BrsrCoreReport) {
  pb.startSection(8, "Openness of Business & Customer Fairness");

  pb.heading("Openness of Business");
  pb.paragraph(
    "Concentration risk disclosure — the share of purchases and sales concentrated in the top 10 suppliers/customers.",
  );

  pb.paragraph("Purchases from top 10 suppliers", { bold: true, size: 10 });
  pb.statusBadge(
    fmtPct(report.purchasesFromTop10SuppliersPct),
    concentrationTone(report.purchasesFromTop10SuppliersPct),
    MARGIN_X,
    pb.y,
  );
  pb.y += 26;
  const supplierNote = concentrationNote("Purchase", "supplier", report.purchasesFromTop10SuppliersPct);
  if (supplierNote) pb.note(supplierNote);

  pb.paragraph("Sales to top 10 customers", { bold: true, size: 10 });
  pb.statusBadge(
    fmtPct(report.salesToTop10CustomersPct),
    concentrationTone(report.salesToTop10CustomersPct),
    MARGIN_X,
    pb.y,
  );
  pb.y += 26;
  const customerNote = concentrationNote("Sales", "customer", report.salesToTop10CustomersPct);
  if (customerNote) pb.note(customerNote);

  pb.note("Green: below 25% (low concentration risk). Amber: 25-50%. Red: 50% or above (high concentration risk).");

  pb.heading("Customer Fairness");
  pb.summaryBox("Customer Fairness", [
    ["Consumer complaints received", fmtCount(report.consumerComplaintsCount)],
    ["Complaints resolved", fmtPct(report.consumerComplaintsResolvedPct)],
  ]);
}

// ---------------------------------------------------------------------------
// Section 09 — Methodology and Regulatory Basis
// ---------------------------------------------------------------------------

function buildMethodology(pb: PageBuilder) {
  pb.startSection(9, "Methodology and Regulatory Basis");

  pb.paragraph(
    "This report is prepared under SEBI's Business Responsibility and Sustainability Reporting (BRSR) Core framework, " +
      "notified vide circular SEBI/HO/CFD/CFD-SEC-2/P/CIR/2023/122, which mandates reasonable assurance on a defined " +
      "subset of BRSR disclosures (the 9 Core attributes) for the top listed entities by market capitalisation and their " +
      "value chain partners.",
  );

  pb.heading("National Guidelines on Responsible Business Conduct (NGRBC)");
  pb.paragraph(
    "BRSR operationalises the NGRBC's nine principles — Ethics/Transparency/Accountability; Safe & sustainable goods " +
      "and services; Employee wellbeing; Stakeholder interests; Human rights; Environment; Public & regulatory policy; " +
      "Inclusive growth; and Consumer value — into structured, comparable disclosures.",
  );

  pb.heading("GHG calculation basis");
  pb.paragraph(
    "The GHG footprint (Section 03) reuses this facility's existing Scope 1 and Scope 2 emissions from its CBAM/CCTS " +
      "activity data, computed on the IPCC AR2/BUR3 (100-yr) Global Warming Potential basis used for CCTS — the same " +
      "basis mandated for India's domestic carbon reporting — rather than recalculating emissions independently.",
  );

  pb.heading("Other attributes");
  pb.paragraph(
    "Water, waste, energy, employee wellbeing, gender diversity, inclusive development, openness of business, and " +
      "customer fairness (Sections 04-08) are company disclosures entered directly against this facility and reporting period, " +
      "presented per the standard BRSR Core intensity format (per rupee of turnover) wherever applicable.",
  );
}

// ---------------------------------------------------------------------------
// Section 10 — Verification Statement
// ---------------------------------------------------------------------------

function buildVerification(pb: PageBuilder, report: ReportWithVerification) {
  pb.startSection(10, "Verification Statement");

  const vr = report.verificationRequest;
  const isApproved = vr?.status === "APPROVED";

  pb.paragraph(
    "BRSR Core requires reasonable assurance (a higher standard than limited assurance) on the 9 Core attributes. " +
      "Intellocarbon's built-in verification portal supports reasonable-assurance engagements end to end — the same " +
      "workflow used for CBAM and CCTS verification.",
  );

  pb.summaryBox(
    "Verification Status",
    [
      ["Assurance provider", vr?.verifier?.name ?? "—"],
      ["Provider organisation", vr?.verifierOrg ?? "—"],
      ["Accreditation number", vr?.accreditationNumber ?? "—"],
      ["Date of assurance", vr?.decidedAt ? fmtDate(vr.decidedAt) : "—"],
    ],
    { tone: isApproved ? "teal" : "neutral" },
  );

  pb.heading("Assurance opinion");
  const opinion = isApproved
    ? (vr?.statement ?? "Approved — no additional statement provided.")
    : vr?.status === "REJECTED"
      ? (vr?.comments ?? "Rejected — see comments.")
      : "Not yet issued.";
  pb.paragraph(opinion, { color: isApproved ? undefined : MUTED });

  if (!isApproved) {
    pb.watermark("PENDING VERIFICATION");
  }
}

// ---------------------------------------------------------------------------
// Section 11 — Declaration and Annexures
// ---------------------------------------------------------------------------

function buildDeclarationAnnexures(pb: PageBuilder, facility: FacilityWithCompany) {
  pb.startSection(11, "Declaration and Annexures");

  const owner = facility.company.owner;

  pb.heading("Declaration");
  pb.paragraph(
    `I/We, on behalf of ${facility.company.name}, declare that the information contained in this BRSR Core Report has ` +
      "been prepared in good faith based on data submitted through the Intellocarbon platform, and represents our best " +
      "current disclosure of the 9 BRSR Core ESG attributes for this facility and reporting period.",
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
    "Annex A — GHG footprint calculation detail (Section 03; full breakdown in the CCTS GHG Intensity Report)",
    "Annex B — Water, waste and energy disclosure detail (Sections 04-05)",
    "Annex C — Methodology and regulatory basis (Section 09)",
    "Annex D — Verification statement (Section 10)",
  ];
  for (const item of annexures) {
    pb.paragraph(`•  ${item}`, { size: 9.5 });
  }
}
