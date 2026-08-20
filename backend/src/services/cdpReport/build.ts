import { LOGO_LOCKUP_ON_DARK } from "../brandAssets";
import PDFDocument from "pdfkit";
import type { Company, Facility, SbtiStatus, User } from "@prisma/client";
import { PageBuilder } from "../cbamReport/layout";
import { buildVerifyQr } from "../cbamReport/qr";
import { MARGIN_X, CONTENT_WIDTH, MUTED, NAVY, TEAL, TEAL_DARK, BORDER, fmt, fmtInt, fmtDate, fmtDateTime } from "../cbamReport/theme";
import { donutChart, verticalBarChart, CHART_BLUE, CHART_SLATE, CHART_AMBER } from "../cbamReport/charts";
import type { ReportPhase2Data } from "../reportSections/phase2Data";
import { drawTrajectoryChart } from "../reportSections/targetsAndTrajectory";
import { drawRecCoverageBlock } from "../reportSections/esgBlocks";
import {
  CDP_MODULES,
  CDP_MATURITY_BAND_LABELS,
  CDP_MATURITY_BAND_DESCRIPTIONS,
  getCdpModule,
  type CdpModule,
  type CdpQuestion,
  type CdpMaturityBand,
} from "../../data/cdpQuestionnaire";
import type { CdpMetrics, CdpReportWithRelations } from "../cdpCalculation.service";
import type { CdpMaturityAssessment } from "../cdpMaturity.service";
import { assignPageNumbers, type CdpResponseIndex, type CdpResponseIndexEntry } from "../cdpResponseIndex.service";

const LOGO_PATH = LOGO_LOCKUP_ON_DARK;

type FacilityWithCompany = Facility & { company: Company & { owner: User } };

const NOT_ANSWERED = "Not answered";
const fmtNum = (v: number | null | undefined, unit = "", digits = 2): string =>
  v == null ? NOT_ANSWERED : `${fmt(v, digits)}${unit ? ` ${unit}` : ""}`;
const fmtCount = (v: number | null | undefined): string => (v == null ? NOT_ANSWERED : fmtInt(v));
const fmtPct = (v: number | null | undefined): string => (v == null ? NOT_ANSWERED : `${fmt(v, 1)}%`);
const fmtText = (v: string | null | undefined): string => (v && v.trim() ? v : "Not yet answered.");
const fmtBool = (v: boolean | null | undefined): string => (v == null ? NOT_ANSWERED : v ? "Yes" : "No");

/**
 * The company's own account of its SBTi position.
 *
 * "Validated" here means the company says SBTi validated it, which is why the
 * column it prints under is labelled self-declared. Nothing on this platform
 * checks it.
 */
const sbtiStatusLabel = (status: SbtiStatus | null): string => {
  switch (status) {
    case "VALIDATED":
      return "Validated";
    case "SUBMITTED":
      return "Submitted";
    case "COMMITTED":
      return "Committed";
    default:
      return "";
  }
};

/** Resolves a select answer to the label CDP shows, not the stored key. */
const fmtSelect = (question: CdpQuestion, value: unknown): string => {
  if (value == null || value === "") return NOT_ANSWERED;
  return question.options?.find((o) => o.value === value)?.label ?? String(value);
};

/** Stable 4-digit code so the same response always shows the same reference. */
const stableDigits = (id: string): string => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return String(1000 + (hash % 9000));
};

const reportReference = (report: CdpReportWithRelations): string =>
  `ICT-CDP-${report.reportingPeriod.replace("FY", "")}-${stableDigits(report.id)}`;

const BAND_TONE: Record<CdpMaturityBand, "green" | "amber" | "red"> = {
  STRONG: "green",
  ESTABLISHED: "green",
  DEVELOPING: "amber",
  NOT_STARTED: "red",
};

const SCOPE3_CATEGORY_LABELS: Record<string, string> = {
  CAT1_PURCHASED_GOODS_SERVICES: "1. Purchased goods and services",
  CAT2_CAPITAL_GOODS: "2. Capital goods",
  CAT3_FUEL_ENERGY_RELATED: "3. Fuel- and energy-related activities",
  CAT4_UPSTREAM_TRANSPORT_DISTRIBUTION: "4. Upstream transportation and distribution",
  CAT5_WASTE_GENERATED_IN_OPERATIONS: "5. Waste generated in operations",
  CAT6_BUSINESS_TRAVEL: "6. Business travel",
  CAT7_EMPLOYEE_COMMUTING: "7. Employee commuting",
  CAT8_UPSTREAM_LEASED_ASSETS: "8. Upstream leased assets",
  CAT9_DOWNSTREAM_TRANSPORT_DISTRIBUTION: "9. Downstream transportation and distribution",
  CAT10_PROCESSING_OF_SOLD_PRODUCTS: "10. Processing of sold products",
  CAT11_USE_OF_SOLD_PRODUCTS: "11. Use of sold products",
  CAT12_END_OF_LIFE_TREATMENT: "12. End-of-life treatment of sold products",
  CAT13_DOWNSTREAM_LEASED_ASSETS: "13. Downstream leased assets",
  CAT14_FRANCHISES: "14. Franchises",
  CAT15_INVESTMENTS: "15. Investments",
};

const TIME_HORIZON_LABELS: Record<string, string> = {
  SHORT_TERM: "Short term",
  MEDIUM_TERM: "Medium term",
  LONG_TERM: "Long term",
};

const DIMENSION_LABELS: Record<string, string> = {
  GAS: "By greenhouse gas",
  COUNTRY: "By country or area",
  BUSINESS_DIVISION: "By business division",
  ACTIVITY: "By activity",
};

/**
 * CDP Climate Change response pack.
 *
 * Structurally this is the GRI and CSRD report's sibling, but it is doing a
 * different job and the differences all follow from that. A GRI report is the
 * deliverable — you publish it. A CDP response pack is not: the deliverable is
 * a form filled in on CDP's own platform, and this document exists so somebody
 * can sit in front of that form and transfer answers across.
 *
 * So the ordering is the questionnaire's rather than a narrative one, the
 * response index cites a page per module for exactly that transfer, and three
 * notices sit at the very front: that CDP is voluntary and buyer-driven rather
 * than a mandate, that this document is not a submission, and that the
 * readiness bands are not CDP's A-to-D- score.
 */
export const buildCdpPdf = async (
  report: CdpReportWithRelations,
  facility: FacilityWithCompany,
  metrics: CdpMetrics,
  maturity: CdpMaturityAssessment,
  index: CdpResponseIndex,
  /**
   * Optional because it genuinely is: a company that has bought no RECs and
   * set no target has nothing to add here. The production loader always
   * supplies it.
   */
  phase2?: ReportPhase2Data,
): Promise<PDFKit.PDFDocument> => {
  const doc = new PDFDocument({ size: "A4", margins: { top: 50, left: 50, right: 50, bottom: 20 }, bufferPages: true });

  const reference = reportReference(report);
  const pb = new PageBuilder(doc, reference, facility.company.name);
  const qr = await buildVerifyQr(reference);
  const pages: Record<string, number> = {};

  buildCover(pb, report, facility, maturity, reference, qr);
  pb.startTocPage();

  let section = 1;
  buildAboutResponse(pb, section++, report, facility, metrics, index);
  buildReadinessSummary(pb, section++, maturity);

  // Module order is the questionnaire's, never the readiness ranking — this
  // document is read alongside CDP's own form, and reordering it would make
  // every answer harder to find than it needs to be.
  for (const module of CDP_MODULES) {
    pages[module.code] = buildModuleSection(pb, section++, module, report, metrics, maturity, phase2) + 1;
  }

  buildMethodology(pb, section++, metrics, index);
  assignPageNumbers(index, pages);
  buildResponseIndexSection(pb, section++, index);
  buildDeclaration(pb, section, report, facility, index);

  pb.finalize();
  return doc;
};

// ---------------------------------------------------------------------------

function buildCover(
  pb: PageBuilder,
  report: CdpReportWithRelations,
  facility: FacilityWithCompany,
  maturity: CdpMaturityAssessment,
  reference: string,
  qr: { buffer: Buffer; url: string },
) {
  pb.coverShell({
    logoPath: LOGO_PATH,
    eyebrow: "Climate Disclosure Preparation",
    title: "CDP Climate Change Response Pack",
    subtitle: `Prepared CDP Climate Change response for ${facility.name}`,
    heroLabel: "Response Completeness",
    heroValue: `${fmt(maturity.completenessPct, 1)}%`,
    heroDelta: {
      text: `Readiness: ${CDP_MATURITY_BAND_LABELS[maturity.overallBand]}`,
      tone: BAND_TONE[maturity.overallBand],
    },
    referenceBadge: reference,
    controlTitle: "Document Control",
    controlRows: [
      ["Document ID", reference],
      ["Version", "v1.0"],
      ["Classification", "Confidential — Prepared for Disclosure"],
      ["Distribution", "Company Admin, Requesting Buyers, Assurance Provider"],
      ["Questionnaire", "CDP Climate Change"],
      ["Generated", fmtDateTime(new Date())],
      ["Reporting period", report.reportingPeriod],
    ],
    qrPngBuffer: qr.buffer,
    qrCaption: "Scan to verify",
    qrUrl: qr.url,
    docIdBadge: `DOC ID  ${reference}  ·  v1.0`,
    confidentialityText:
      "This document is classified Confidential — Prepared for Disclosure and is intended solely for the named distribution list above. It is a preparation document, not a CDP submission. Unauthorised copying or distribution is prohibited. © 2026 Intellocarbon Solutions Private Limited.",
  });
}

function buildAboutResponse(
  pb: PageBuilder,
  section: number,
  report: CdpReportWithRelations,
  facility: FacilityWithCompany,
  metrics: CdpMetrics,
  index: CdpResponseIndex,
) {
  pb.startSection(section, "About This Response Pack");

  pb.heading("What this document is");
  pb.paragraph(index.preparationStatement);

  // The applicability notice sits before any figure, for the same reason the
  // CSRD statement leads with the Omnibus thresholds: a reader must not be
  // able to skim this and conclude they are under an obligation.
  pb.ensureSpace(90);
  pb.heading("CDP is voluntary and buyer-driven");
  pb.paragraph(index.applicabilityNotice);
  pb.table({
    columns: [
      { header: "Question", width: 200 },
      { header: "Answer", width: 295 },
    ],
    rows: [
      ["Is CDP a legal requirement?", "No. CDP is a voluntary disclosure system run by a non-profit."],
      ["Who sets the deadline?", "CDP and the customer or investor that requested your response."],
      ["What happens if you do not respond?", "No legal penalty. The commercial consequence is with the requesting buyer."],
      ["Who scores the response?", "CDP, on the response submitted to its own platform."],
    ],
  });
  pb.note(
    "If you cannot identify a customer or investor who asked you to respond, you very likely do not need to. Check before spending effort on this.",
  );

  pb.ensureSpace(80);
  pb.heading("This pack prepares a response — it does not submit one");
  pb.paragraph(index.submissionNotice);

  // The reconciliation caveat is a statement about this software, not about
  // the responder's answers, and is labelled as such.
  if (!index.registryReconciled) {
    pb.ensureSpace(80);
    pb.heading("Question numbering");
    pb.paragraph(
      `CDP reissues its questionnaire annually, and in 2024 consolidated its separate questionnaires into a single ` +
        `unified corporate questionnaire, which renumbered questions away from the classic C0-C15 climate change ` +
        `lettering used in this document. ${index.confirmedQuestions} of ${index.totalQuestions} question codes here have been ` +
        "reconciled against a questionnaire document CDP actually issued. Until that is complete, match questions by " +
        "subject matter rather than by number when transferring answers into CDP's platform. This is a limitation of " +
        "the preparation tool, not of the information provided — every answer given is carried in full.",
    );
  }

  pb.heading("Reporting boundary and period");
  pb.keyValueColumns(
    "ORGANIZATION",
    [
      ["Company", facility.company.name],
      ["Sector", facility.company.sector],
      ["Reporting period", report.reportingPeriod],
      [
        "Period covered (C0.2)",
        `${fmtDate(metrics.fyWindow.start)} – ${fmtDate(new Date(metrics.fyWindow.end.getTime() - 86400000))}`,
      ],
    ],
    "RESPONDING ENTITY",
    [
      ["Facility", facility.name],
      ["Reporting basis", "Facility-level, entity-controlled operations"],
      ["Reporting currency (C0.4)", report.introduction?.reportingCurrency || NOT_ANSWERED],
      ["Revenue basis (C6.10)", report.revenue != null ? fmt(report.revenue, 0) : NOT_ANSWERED],
    ],
  );
  pb.note(
    "CDP responses are normally made at organization level. This pack is prepared per facility — where the response you submit covers more than this facility, state that at C0.6 and scale the figures accordingly.",
  );
}

// ---------------------------------------------------------------------------
// Readiness
// ---------------------------------------------------------------------------

function buildReadinessSummary(pb: PageBuilder, section: number, maturity: CdpMaturityAssessment) {
  pb.startSection(section, "Response Readiness");

  // The disclaimer comes before the bands, not after, so the bands are never
  // read as a score first and qualified second.
  pb.heading("These bands are not a CDP score");
  pb.paragraph(
    "CDP scores responses from A to D- using its own methodology, applied by CDP to the response submitted on its " +
      "platform. This pack does not predict, estimate or replicate that score. The bands below are an internal " +
      "readiness indicator: how completely each module is answered, and whether it carries the supporting evidence " +
      "CDP asks for. A Strong band means the module is well prepared. It is not a CDP grade and carries no " +
      "relationship to one.",
  );

  pb.summaryBox("Readiness Summary", [
    ["Questions answered", `${fmtInt(maturity.answered)} of ${fmtInt(maturity.total)}`],
    ["Overall completeness", `${fmt(maturity.completenessPct, 1)}%`],
    ["Overall readiness band", CDP_MATURITY_BAND_LABELS[maturity.overallBand]],
    ["Modules at Strong", fmtInt(maturity.modules.filter((m) => m.band === "STRONG").length)],
    ["Modules not started", fmtInt(maturity.modules.filter((m) => m.band === "NOT_STARTED").length)],
  ]);

  pb.heading("How the bands are set");
  pb.table({
    columns: [
      { header: "Band", width: 110 },
      { header: "Meaning", width: 385 },
    ],
    rows: (["STRONG", "ESTABLISHED", "DEVELOPING", "NOT_STARTED"] as CdpMaturityBand[]).map((band) => [
      CDP_MATURITY_BAND_LABELS[band],
      CDP_MATURITY_BAND_DESCRIPTIONS[band],
    ]),
  });
  pb.note(
    "A module answered in full is still held at a lower band where the evidence CDP looks for is absent — no emissions target, or no third-party verification of the emissions data. Those are shown as evidence gaps below.",
  );

  pb.heading("Readiness by module");
  pb.table({
    columns: [
      { header: "Module", width: 42 },
      { header: "Title", width: 165 },
      { header: "Answered", width: 68, align: "right" },
      { header: "Band", width: 90 },
      { header: "Optional", width: 55 },
    ],
    rows: maturity.modules.map((m) => [
      m.label,
      m.title,
      `${m.answered} / ${m.total}`,
      CDP_MATURITY_BAND_LABELS[m.band],
      m.optional ? "Yes" : "",
    ]),
  });

  const started = maturity.modules.filter((m) => m.answered > 0);
  if (started.length > 0) {
    pb.ensureSpace(190);
    pb.y = verticalBarChart(pb.doc, {
      x: MARGIN_X,
      y: pb.y,
      width: CONTENT_WIDTH,
      height: 150,
      unit: "%",
      data: started.map((m) => ({
        label: m.label,
        value: m.total > 0 ? Math.round((m.answered / m.total) * 1000) / 10 : 0,
        color: m.band === "STRONG" ? TEAL : m.band === "ESTABLISHED" ? CHART_BLUE : CHART_AMBER,
      })),
    });
    pb.note("Percentage of each started module's questions answered. Bar colour shows the readiness band after evidence gaps are applied.");
  }

  const gaps = maturity.modules.filter((m) => m.evidenceGaps.length > 0);
  if (gaps.length > 0) {
    pb.heading("Evidence gaps holding a module below its answered level");
    pb.table({
      columns: [
        { header: "Module", width: 60 },
        { header: "What is missing", width: 435 },
      ],
      rows: gaps.flatMap((m) => m.evidenceGaps.map((gap) => [`${m.label}`, gap])),
    });
  }

  const notStarted = maturity.modules.filter((m) => m.answered === 0 && !m.optional);
  if (notStarted.length > 0) {
    pb.heading("Modules not started");
    pb.paragraph(
      "CDP accepts a partial response and scores it accordingly, so an unanswered module is not a blocker to " +
        "submitting. It is, however, the clearest thing left to work on.",
      { size: 9 },
    );
    pb.table({
      columns: [
        { header: "Module", width: 60 },
        { header: "Title", width: 200 },
        { header: "Covers", width: 235 },
      ],
      rows: notStarted.map((m) => [m.label, m.title, getCdpModule(m.moduleCode)?.blurb ?? ""]),
    });
  }
}

// ---------------------------------------------------------------------------
// Module sections
// ---------------------------------------------------------------------------

function buildModuleSection(
  pb: PageBuilder,
  section: number,
  module: CdpModule,
  report: CdpReportWithRelations,
  metrics: CdpMetrics,
  maturity: CdpMaturityAssessment,
  phase2?: ReportPhase2Data,
): number {
  const pageIndex = pb.startSection(section, `${module.label} — ${module.title}`);
  const record = maturity.modules.find((m) => m.moduleCode === module.code);

  pb.paragraph(module.blurb, { size: 9, color: MUTED });

  if (record) {
    pb.note(
      `${record.answered} of ${record.total} questions answered · readiness ${CDP_MATURITY_BAND_LABELS[record.band]}` +
        (module.optional ? " · optional module, issued by CDP only where it applies to your sector" : ""),
    );
    for (const gap of record.evidenceGaps) pb.note(`Evidence gap: ${gap}`);
  }

  renderDerivedFigures(pb, module, report, metrics, phase2);

  const row = ((report as unknown as Record<string, unknown>)[module.relation] ?? null) as Record<string, unknown> | null;
  renderQuestions(pb, module.questions, row);

  renderRepeatingBlocks(pb, module, report, metrics, phase2);

  return pageIndex;
}

/** Narratives as headed paragraphs, quantitative answers batched into a table. */
function renderQuestions(pb: PageBuilder, questions: CdpQuestion[], row: Record<string, unknown> | null) {
  let pending: [string, string][] = [];

  const flush = () => {
    if (pending.length === 0) return;
    pb.table({
      columns: [
        { header: "Question", width: 330 },
        { header: "Answer", width: 165, align: "right" },
      ],
      rows: pending,
    });
    pending = [];
  };

  for (const question of questions) {
    // Derived figures are rendered by the module's own derived block above,
    // where they can carry their basis.
    if (question.derived) continue;
    const value = row?.[question.field];

    if (question.type === "narrative") {
      flush();
      pb.heading(`${question.code} ${question.label}`);
      pb.paragraph(fmtText(value as string | null));
      continue;
    }

    const rendered =
      question.type === "select"
        ? fmtSelect(question, value)
        : question.type === "bool"
          ? fmtBool(value as boolean | null)
          : question.type === "pct"
            ? fmtPct(value as number | null)
            : question.type === "int" || question.type === "year"
              ? fmtCount(value as number | null)
              : fmtNum(value as number | null, question.unit ?? "");
    pending.push([`${question.code} ${question.label}`, rendered]);
  }
  flush();
}

/** The figures this module reuses from the platform's engines, with a chart where one helps. */
function renderDerivedFigures(
  pb: PageBuilder,
  module: CdpModule,
  report: CdpReportWithRelations,
  metrics: CdpMetrics,
  phase2?: ReportPhase2Data,
) {
  const r = metrics.rollup;

  if (module.code === "C6") {
    pb.heading("C6.1 / C6.3 / C6.5 Emissions (derived)");
    pb.paragraph(
      "Scope 1 and location-based Scope 2 are reused from this facility's submitted activity data on the IPCC AR5 " +
        "basis, which is the GHG Protocol convention CDP expects — deliberately distinct from the AR2/BUR3 basis " +
        "used for India's CCTS reporting on the same records. Market-based Scope 2 is entered manually, since it " +
        "needs supplier-specific or residual-mix factors the platform does not hold.",
      { size: 9 },
    );
    pb.summaryBox(
      "Emissions",
      [
        ["Scope 1 (C6.1)", `${fmt(r.scope1Tco2e, 2)} tCO2e`],
        ["Scope 2, location-based (C6.3)", `${fmt(r.scope2LocationTco2e, 2)} tCO2e`],
        [
          "Scope 2, market-based (C6.3a)",
          report.emissionsData?.scope2MarketTco2e != null
            ? `${fmt(report.emissionsData.scope2MarketTco2e, 2)} tCO2e`
            : NOT_ANSWERED,
        ],
        ["Scope 3 (C6.5)", r.scope3Tco2e != null ? `${fmt(r.scope3Tco2e, 2)} tCO2e` : NOT_ANSWERED],
        ["Scope 1 + 2 total", `${fmt(r.totalScope12Tco2e, 2)} tCO2e`],
        [
          "Intensity per unit revenue (C6.10)",
          metrics.intensityPerRevenue != null ? fmt(metrics.intensityPerRevenue, 10) : "Not calculable",
        ],
      ],
      { tone: "teal" },
    );

    const segments = [
      { label: "Scope 1", value: r.scope1Tco2e, color: TEAL },
      { label: "Scope 2", value: r.scope2LocationTco2e, color: CHART_SLATE },
    ];
    if (r.scope3Tco2e != null && r.scope3Tco2e > 0) {
      segments.push({ label: "Scope 3", value: r.scope3Tco2e, color: CHART_BLUE });
    }
    if (segments.reduce((s, seg) => s + seg.value, 0) > 0) {
      pb.ensureSpace(190);
      pb.y = donutChart(pb.doc, { x: MARGIN_X, y: pb.y, diameter: 120, unit: "tCO2e", centerLabel: "Total", segments });
    }

    // CDP asks for Scope 3 category by category, not as a single number, so
    // the breakdown is printed even though the total appears above.
    if (r.scope3ByCategory.length > 0) {
      pb.heading("C6.5 Scope 3 by GHG Protocol category (derived)");
      pb.table({
        columns: [
          { header: "Category", width: 355 },
          { header: "tCO2e", width: 140, align: "right" },
        ],
        rows: r.scope3ByCategory.map((c) => [
          SCOPE3_CATEGORY_LABELS[c.category] ?? String(c.category),
          fmt(c.emissionsTco2e, 2),
        ]),
      });
      pb.note(
        "Categories with no submitted entries are absent rather than zero. CDP asks for a relevance judgement on every category — record that at C6.5a for any category not listed here.",
      );
    }
    return;
  }

  if (module.code === "C8" && r.totalEnergyMwh > 0) {
    pb.heading("C8.2 Energy consumption (derived)");
    pb.paragraph(
      "Reused from this facility's activity data, in MWh as CDP states it. Imported steam converts at 3.6 GJ per " +
        "MWh. Electricity generated on site (C8.2f) is entered manually and is not included in the purchased " +
        "figures below, so the two do not double-count.",
      { size: 9 },
    );
    pb.summaryBox(
      "Energy",
      [
        ["Total energy consumption (C8.2a)", `${fmt(r.totalEnergyMwh, 3)} MWh`],
        ["Purchased electricity (C8.2b)", `${fmt(r.purchasedElectricityMwh, 3)} MWh`],
        ["Of which renewable (C8.2c)", `${fmt(r.renewableElectricityMwh, 3)} MWh`],
        ["Purchased heat and steam (C8.2e)", `${fmt(r.purchasedSteamMwh, 3)} MWh`],
        ["Renewable share (C8.2h)", r.renewableSharePct != null ? `${fmt(r.renewableSharePct, 2)}%` : "Not calculable"],
      ],
      { tone: "teal" },
    );

    if (r.purchasedElectricityMwh > 0) {
      pb.ensureSpace(190);
      pb.y = donutChart(pb.doc, {
        x: MARGIN_X,
        y: pb.y,
        diameter: 120,
        unit: "MWh",
        centerLabel: "Purchased",
        segments: [
          { label: "Renewable", value: r.renewableElectricityMwh, color: TEAL },
          {
            label: "Non-renewable",
            value: Math.max(0, r.purchasedElectricityMwh - r.renewableElectricityMwh),
            color: CHART_SLATE,
          },
        ],
      });
    }

    // C8.2d/C8.2j: CDP asks what share of purchased electricity is backed by a
    // low-carbon instrument, which is a different question from how much was
    // generated renewably. The certificate register answers it.
    if (phase2) {
      pb.heading("C8.2d / C8.2j Low-carbon electricity instruments");
      drawRecCoverageBlock(pb, phase2.recCoverage);
    }
    return;
  }

  if (module.code === "C9" && (r.wasteGeneratedTonnes != null || r.waterWithdrawalM3 != null)) {
    pb.heading("C9.2 / C9.3 Waste and water (derived)");
    pb.paragraph(
      "Reused from the GRI 306 waste disclosure and the ISO 14046 water inventory for the same reporting period, " +
        "so the figures cannot disagree with what those disclosures report.",
      { size: 9 },
    );
    pb.summaryBox(
      "Other metrics",
      [
        ["Waste generated (C9.2)", r.wasteGeneratedTonnes != null ? `${fmt(r.wasteGeneratedTonnes, 3)} t` : NOT_ANSWERED],
        ["Water withdrawn (C9.3)", r.waterWithdrawalM3 != null ? `${fmt(r.waterWithdrawalM3, 3)} m3` : NOT_ANSWERED],
      ],
      { tone: "teal" },
    );
    return;
  }

  if (module.code === "C11") {
    const exposure = metrics.carbonPricingExposure;
    pb.heading("C11.1 / C11.2a Carbon pricing exposure (observed)");
    pb.paragraph(
      "What this platform can see about carbon pricing exposure from your CBAM, CCTS and offsets records. This is " +
        "a prompt, not an answer: whether an operation is actually regulated by a carbon pricing system turns on " +
        "entity-level facts the platform does not hold, so C11.1 above is answered by you rather than pre-filled.",
      { size: 9 },
    );
    pb.summaryBox(
      "Observed exposure",
      [
        ["CBAM enabled on this company", exposure.appliesCbam ? "Yes" : "No"],
        ["CCTS enabled on this company", exposure.appliesCcts ? "Yes" : "No"],
        ["CCTS intensity target on activity data", exposure.hasCctsTarget ? "Yes" : "No"],
        [
          "Highest carbon price recorded as paid",
          exposure.carbonPricePaidEurPerTonne != null
            ? `EUR ${fmt(exposure.carbonPricePaidEurPerTonne, 2)} / tCO2e`
            : "None recorded",
        ],
        [
          "Carbon credits cancelled (C11.2a)",
          r.carbonCreditsCancelledTco2e != null ? `${fmt(r.carbonCreditsCancelledTco2e, 2)} tCO2e` : "None recorded",
        ],
      ],
      { tone: "teal" },
    );
    if (exposure.observedSystems.length > 0) {
      pb.heading("Carbon pricing systems observed");
      pb.table({
        columns: [{ header: "System", width: 495 }],
        rows: exposure.observedSystems.map((s) => [s]),
      });
      pb.note("Confirm each of these against your own regulatory position before entering them at C11.1a.");
    }
  }
}

/** C2's risks and opportunities, C4's targets, C7's breakdown rows. */
function renderRepeatingBlocks(
  pb: PageBuilder,
  module: CdpModule,
  report: CdpReportWithRelations,
  metrics: CdpMetrics,
  phase2?: ReportPhase2Data,
) {
  if (module.code === "C2") {
    for (const kind of ["RISK", "OPPORTUNITY"] as const) {
      const rows = report.risks.filter((r) => r.kind === kind);
      const heading = kind === "RISK" ? "C2.3 Climate-related risks identified" : "C2.4 Climate-related opportunities identified";
      pb.heading(heading);
      if (rows.length === 0) {
        pb.paragraph(
          kind === "RISK"
            ? "No climate-related risks have been entered. CDP asks for each identified risk as a separate entry."
            : "No climate-related opportunities have been entered. CDP asks for opportunities as well as risks.",
        );
        continue;
      }
      pb.table({
        columns: [
          { header: "Type", width: 88 },
          { header: "Description", width: 175 },
          { header: "Horizon", width: 62 },
          { header: "Likelihood", width: 60 },
          { header: "Financial effect", width: 110, align: "right" },
        ],
        rows: rows.map((r) => [
          r.riskType,
          r.description,
          r.timeHorizon ? TIME_HORIZON_LABELS[r.timeHorizon] ?? r.timeHorizon : "—",
          r.likelihood ?? "—",
          formatRange(r.financialImpactMin, r.financialImpactMax),
        ]),
      });

      // The management response is what CDP actually marks, and it is prose
      // rather than a cell, so it gets its own block rather than a column
      // that would truncate it.
      for (const r of rows.filter((row) => row.responseStrategy || row.impactDescription)) {
        pb.ensureSpace(40);
        pb.doc.fillColor(TEAL_DARK).font("Helvetica-Bold").fontSize(9).text(r.riskType, MARGIN_X, pb.y);
        pb.y += 13;
        if (r.impactDescription) pb.paragraph(r.impactDescription, { size: 9.5 });
        if (r.responseStrategy) pb.paragraph(`Response: ${r.responseStrategy}`, { size: 9.5 });
      }
    }
    return;
  }

  if (module.code === "C4") {
    pb.heading("C4.1a / C4.1b Emissions reduction targets");
    const { rows: targets, fromCompanyTarget } = metrics.targets;
    if (targets.length === 0) {
      pb.paragraph(
        "No emissions reduction target has been entered. A target with a base year, a target year and a stated " +
          "reduction is the single thing a requesting buyer most often looks for in this module.",
      );
      return;
    }
    if (fromCompanyTarget) {
      pb.paragraph(
        "No target was entered against this response, so the targets below are the ones recorded in the " +
          "organization's own target register. Any SBTi position shown is the organization's own account of where " +
          "it stands and has not been verified here.",
        { size: 9.5 },
      );
    }
    pb.table({
      columns: [
        { header: "Type", width: 60 },
        { header: "Scopes covered", width: 120 },
        { header: "Base year", width: 55, align: "right" },
        { header: "Target year", width: 60, align: "right" },
        { header: "Reduction", width: 65, align: "right" },
        { header: "Achieved", width: 60, align: "right" },
        { header: fromCompanyTarget ? "SBTi (self-declared)" : "SBTi", width: 40 },
      ],
      rows: targets.map((t) => [
        t.kind === "ABSOLUTE" ? "Absolute" : "Intensity",
        t.scopesCovered,
        String(t.baseYear),
        String(t.targetYear),
        t.reductionPct != null ? `${fmt(t.reductionPct, 1)}%` : "—",
        t.percentAchieved != null ? `${fmt(t.percentAchieved, 1)}%` : "—",
        fromCompanyTarget ? sbtiStatusLabel(t.sbtiStatus) : t.isScienceBased ? "Yes" : "",
      ]),
    });

    // C4.2 asks how performance is tracked against the target. The table above
    // answers it in numbers; this answers it in a shape a requesting buyer can
    // read at a glance. Only drawn where a trackable absolute target exists —
    // an intensity-only or undated target has no path to plot, and
    // netZeroTrajectory says so rather than inventing one.
    if (phase2?.trajectory.hasData) {
      pb.heading("C4.2 Progress against the target path");
      drawTrajectoryChart(pb, phase2.trajectory);
    }

    const intensity = targets.filter((t) => t.kind === "INTENSITY");
    if (intensity.length > 0) {
      pb.heading("Intensity target denominators");
      pb.table({
        columns: [
          { header: "Metric", width: 235 },
          { header: "Base year intensity", width: 130, align: "right" },
          { header: "Target intensity", width: 130, align: "right" },
        ],
        rows: intensity.map((t) => [
          t.intensityMetric ?? "—",
          t.baseYearIntensity != null ? fmt(t.baseYearIntensity, 4) : "—",
          t.targetIntensity != null ? fmt(t.targetIntensity, 4) : "—",
        ]),
      });
    }

    return;
  }

  if (module.code === "C7") {
    if (report.breakdownRows.length === 0) {
      pb.heading("C7.1 / C7.2 / C7.3 Emissions breakdown");
      pb.paragraph(
        "No breakdown rows have been entered. CDP asks for Scope 1 split by greenhouse gas and by country, and " +
          "accepts further splits by business division and activity.",
      );
      return;
    }
    for (const dimension of ["GAS", "COUNTRY", "BUSINESS_DIVISION", "ACTIVITY"] as const) {
      const rows = report.breakdownRows.filter((r) => r.dimension === dimension);
      if (rows.length === 0) continue;
      pb.heading(`Emissions breakdown — ${DIMENSION_LABELS[dimension].toLowerCase()}`);
      pb.table({
        columns: [
          { header: "Label", width: 275 },
          { header: "Scope", width: 90 },
          { header: "tCO2e", width: 130, align: "right" },
        ],
        rows: rows.map((r) => [r.label, r.scope === "SCOPE_1" ? "Scope 1" : "Scope 2", fmt(r.emissionsTco2e, 2)]),
      });
    }
  }
}

const formatRange = (min: number | null, max: number | null): string => {
  if (min == null && max == null) return "—";
  if (min != null && max != null) return `${fmt(min, 0)} – ${fmt(max, 0)}`;
  return fmt((min ?? max)!, 0);
};

// ---------------------------------------------------------------------------

function buildMethodology(pb: PageBuilder, section: number, metrics: CdpMetrics, index: CdpResponseIndex) {
  pb.startSection(section, "Methodology and Basis");

  pb.heading("Questionnaire version");
  pb.paragraph(
    "This pack follows the classic CDP Climate Change questionnaire module structure — C0 Introduction through C15 " +
      "Sign off — because that is the structure requesting buyers and consultants name when they ask a supplier for " +
      "a CDP climate response. CDP consolidated its separate climate, water and forests questionnaires into a single " +
      "unified corporate questionnaire in 2024, which renumbered questions. Check the numbering against the " +
      "questionnaire CDP issued to your organization before transferring answers.",
  );

  pb.heading("Question reconciliation");
  pb.paragraph(
    `${index.confirmedQuestions} of ${index.totalQuestions} question codes used by this tool have been reconciled against a ` +
      "CDP questionnaire document. The response index records the status of each. While any remain unreconciled, " +
      "match questions by subject matter rather than by number.",
  );

  pb.heading("Reused and derived figures");
  pb.table({
    columns: [
      { header: "Question", width: 110 },
      { header: "Source and basis", width: 385 },
    ],
    rows: [
      ["C0.2", "Reporting window resolved from the reporting period and the company's financial year start month."],
      ["C6.1, C6.3", "Scope 1 and location-based Scope 2 from this facility's activity data on the IPCC AR5 (100-yr) GWP basis, per GHG Protocol."],
      ["C6.5", "Rolled up from submitted Scope 3 value-chain entries for the same reporting period, and split by GHG Protocol category."],
      ["C6.10", "Combined Scope 1 and 2 divided by the revenue figure entered on this response."],
      ["C8.2a-c, C8.2e", "Electricity and imported steam from activity data, converted to MWh at 3.6 GJ/MWh. Fuel energy is entered manually."],
      ["C9.2", "Reused from the GRI 306 waste disclosure for the same period, where one exists."],
      ["C9.3", "Reused from the ISO 14046 water inventory, where one exists."],
      ["C11.2a", "Carbon credits cancelled, from the voluntary offsets log."],
    ],
  });

  pb.heading("Reporting period");
  pb.paragraph(
    `All derived figures cover ${metrics.fyWindow.label} (${fmtDate(metrics.fyWindow.start)} to ${fmtDate(new Date(metrics.fyWindow.end.getTime() - 86400000))}), resolved against the organization's financial year.`,
  );
  pb.note(
    "Where CDP's requested reporting year differs from your financial year, say so at C0.2 — CDP allows a non-calendar reporting year but expects the dates to be stated.",
  );
}

const INDEX_COLUMNS = [
  { header: "Module", width: 92 },
  { header: "Code", width: 46 },
  { header: "Question", width: 205 },
  { header: "Page", width: 32, align: "right" as const },
  { header: "Answered", width: 55 },
  { header: "Source", width: 65 },
];

const indexRow = (e: CdpResponseIndexEntry): string[] => [
  e.module,
  e.code,
  e.label,
  e.pageNumber != null ? String(e.pageNumber) : "—",
  e.answered ? "Yes" : "",
  e.derived ? "Calculated" : "Entered",
];

function buildResponseIndexSection(pb: PageBuilder, section: number, index: CdpResponseIndex) {
  pb.startSection(section, "CDP Response Index");

  pb.heading("How to use this index");
  pb.paragraph(
    "CDP responses are entered question by question into CDP's own online platform. This index is ordered exactly " +
      "as the questionnaire is, so it can be worked through from top to bottom while filling that form in. For each " +
      "question it gives the page this pack answers it on, whether an answer exists at all, and whether the figure " +
      "was calculated by the platform or entered by hand — the last matters if a reviewer asks where a number came " +
      "from.",
  );

  pb.summaryBox("Index Summary", [
    ["Questions answered", `${fmtInt(index.answeredCount)} of ${fmtInt(index.answeredCount + index.unansweredCount)}`],
    ["Not yet answered", fmtInt(index.unansweredCount)],
    ["Of which answered by calculation", fmtInt(index.derivedCount)],
    ["Question codes reconciled with CDP", `${index.confirmedQuestions} of ${index.totalQuestions}`],
    ["Modules with nothing entered", fmtInt(index.emptyModules.length)],
  ]);

  // One table per module: table() paginates rows but draws its header once, so
  // a single long table would continue headerless onto later pages.
  for (const module of CDP_MODULES) {
    const rows = index.entries.filter((e) => e.moduleCode === module.code);
    if (rows.length === 0) continue;
    pb.heading(`${module.label}: ${module.title}${module.optional ? " (optional)" : ""}`);
    pb.table({ columns: INDEX_COLUMNS, rows: rows.map(indexRow) });
  }

  if (index.emptyModules.length > 0) {
    pb.heading("Modules with nothing entered");
    pb.paragraph(
      "Listed so the transfer can skip them knowingly rather than by accident. CDP accepts a partial response.",
      { size: 9 },
    );
    pb.table({
      columns: [
        { header: "Module", width: 265 },
        { header: "Status", width: 230 },
      ],
      rows: index.emptyModules.map((m) => [
        m.module,
        m.optional ? "Optional — CDP issues this only where it applies to your sector" : "Not started",
      ]),
    });
  }
}

function buildDeclaration(
  pb: PageBuilder,
  section: number,
  report: CdpReportWithRelations,
  facility: FacilityWithCompany,
  index: CdpResponseIndex,
) {
  pb.startSection(section, "Sign Off and Declaration");
  const owner = facility.company.owner;

  pb.heading("C15.1 Person submitting this response");
  pb.keyValueColumns(
    "SUBMITTER",
    [
      ["Job title", report.signoff?.submitterJobTitle || NOT_ANSWERED],
      [
        "Job category",
        fmtSelect(
          getCdpModule("C15")!.questions.find((question) => question.field === "submitterJobCategory")!,
          report.signoff?.submitterJobCategory,
        ),
      ],
    ],
    "ORGANIZATION",
    [
      ["Company", facility.company.name],
      ["Reporting period", report.reportingPeriod],
    ],
  );

  if (report.signoff?.finalStatement) {
    pb.heading("C15.2 Final statement");
    pb.paragraph(report.signoff.finalStatement);
  }

  pb.heading("Declaration");
  pb.paragraph(
    `I/We, on behalf of ${facility.company.name}, declare that the information in this response pack has been ` +
      "prepared in good faith based on data submitted through the Intellocarbon platform, for the purpose of " +
      "responding to a CDP Climate Change questionnaire request for the reporting period stated.",
  );

  pb.note(
    "This pack is not a CDP submission and has not been scored by CDP. The response itself must be entered on CDP's online response platform. Nothing in this document should be presented as evidence of a completed CDP disclosure.",
  );
  if (!index.registryReconciled) {
    pb.note(
      "Question codes in this pack have not been reconciled against a CDP questionnaire document — match by subject matter rather than by number when transferring answers.",
    );
  }

  pb.ensureSpace(70);
  pb.doc.moveTo(MARGIN_X, pb.y + 30).lineTo(MARGIN_X + 220, pb.y + 30).strokeColor(BORDER).lineWidth(1).stroke();
  pb.doc.fillColor(MUTED).font("Helvetica").fontSize(8).text("Signature", MARGIN_X, pb.y + 34);
  pb.doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(9.5).text(`${owner.name} — Company Administrator`, MARGIN_X, pb.y + 48);
  pb.doc.fillColor(MUTED).font("Helvetica").fontSize(8.5).text(`Date: ${fmtDate(new Date())}`, MARGIN_X, pb.y + 62);
  pb.y += 84;
}
