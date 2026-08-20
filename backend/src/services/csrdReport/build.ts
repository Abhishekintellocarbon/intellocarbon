import { LOGO_LOCKUP_ON_DARK } from "../brandAssets";
import PDFDocument from "pdfkit";
import type { Company, Facility, User, CsrdMaterialTopic } from "@prisma/client";
import { PageBuilder } from "../cbamReport/layout";
import { buildVerifyQr } from "../cbamReport/qr";
import { MARGIN_X, CONTENT_WIDTH, MUTED, NAVY, TEAL, TEAL_DARK, BORDER, fmt, fmtInt, fmtDate, fmtDateTime } from "../cbamReport/theme";
import { donutChart, scatterMatrix, CHART_BLUE, CHART_SLATE, CHART_AMBER, CHART_RED, type ScatterPoint } from "../cbamReport/charts";
import {
  ESRS_2_DATAPOINTS,
  ESRS_STANDARDS,
  CSRD_OMISSION_REASON_LABELS,
  CSRD_EMPLOYEE_THRESHOLD,
  CSRD_TURNOVER_THRESHOLD_EUR,
  getEsrsStandard,
  type EsrsStandard,
  type EsrsDatapoint,
} from "../../data/esrsStandards";
import type { CsrdMetrics, CsrdReportWithRelations } from "../csrdCalculation.service";
import { assignPageNumbers, type CsrdDisclosureIndex, type CsrdDisclosureIndexEntry } from "../csrdDisclosureIndex.service";
import type { ReportPhase2Data } from "../reportSections/phase2Data";
import {
  drawEnergyMixBlock,
  drawProductFootprintBlock,
  drawGovernanceBlock,
  drawSupplierScorecardBlock,
} from "../reportSections/esgBlocks";
import { drawTargetsTable, drawTrajectoryChart, hasTargetsToReport } from "../reportSections/targetsAndTrajectory";

const LOGO_PATH = LOGO_LOCKUP_ON_DARK;

type FacilityWithCompany = Facility & { company: Company & { owner: User } };

const NOT_REPORTED = "Not reported";
const fmtNum = (v: number | null | undefined, unit = "", digits = 2): string =>
  v == null ? NOT_REPORTED : `${fmt(v, digits)}${unit ? ` ${unit}` : ""}`;
const fmtCount = (v: number | null | undefined): string => (v == null ? NOT_REPORTED : fmtInt(v));
const fmtPct = (v: number | null | undefined): string => (v == null ? NOT_REPORTED : `${fmt(v, 1)}%`);
const fmtText = (v: string | null | undefined): string => (v && v.trim() ? v : "Not yet reported.");
const fmtBool = (v: boolean | null | undefined): string => (v == null ? NOT_REPORTED : v ? "Yes" : "No");

/** Stable 4-digit code so the same statement always shows the same reference. */
const stableDigits = (id: string): string => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return String(1000 + (hash % 9000));
};

const reportReference = (report: CsrdReportWithRelations): string =>
  `ICT-CSRD-${report.reportingPeriod.replace("FY", "")}-${stableDigits(report.id)}`;

const SHORT_OMISSION: Record<string, string> = {
  NOT_MATERIAL: "Not material",
  PHASE_IN_RELIEF: "Phase-in",
  DATA_UNAVAILABLE: "Unavailable",
  CONFIDENTIALITY: "Confidential",
};

/**
 * CSRD/ESRS sustainability statement.
 *
 * Two things distinguish this from the GRI report it shares an architecture
 * with. The materiality section carries a genuinely two-axis matrix, because
 * ESRS materiality is two independent assessments rather than one. And the
 * front of the document carries two notices GRI needs no equivalent of: the
 * Omnibus applicability threshold, so a reader below it is not led to think
 * they are in mandatory scope, and the datapoint reconciliation status, so
 * nobody mistakes an unreconciled statement for a conformant one.
 */
export const buildCsrdPdf = async (
  report: CsrdReportWithRelations,
  facility: FacilityWithCompany,
  metrics: CsrdMetrics,
  index: CsrdDisclosureIndex,
  /**
   * Optional because it genuinely is: a company that has entered none of this
   * renders a normal statement with honest "not reported" states. The
   * production loader always supplies it.
   */
  phase2?: ReportPhase2Data,
): Promise<PDFKit.PDFDocument> => {
  const doc = new PDFDocument({ size: "A4", margins: { top: 50, left: 50, right: 50, bottom: 20 }, bufferPages: true });

  const reference = reportReference(report);
  const pb = new PageBuilder(doc, reference, facility.company.name);
  const qr = await buildVerifyQr(reference);
  const pages: Record<string, number> = {};

  buildCover(pb, report, facility, metrics, index, reference, qr);
  pb.startTocPage();

  let section = 1;
  buildAboutStatement(pb, section++, report, facility, metrics, index);
  pages.GENERAL = buildGeneralDisclosures(pb, section++, report, phase2) + 1;
  buildMaterialityAssessment(pb, section++, report);

  const material = ESRS_STANDARDS.map((standard) => ({
    standard,
    record: report.materialTopics.find((t) => t.standardCode === standard.code),
  })).filter((s): s is { standard: EsrsStandard; record: CsrdMaterialTopic } => s.record?.isMaterial === true);

  // Ordered by the stronger axis, so the statement opens on the most
  // significant matter whichever direction carried it.
  material.sort(
    (a, b) =>
      Math.max(b.record.impactScore ?? 0, b.record.financialScore ?? 0) -
      Math.max(a.record.impactScore ?? 0, a.record.financialScore ?? 0),
  );

  for (const { standard, record } of material) {
    pages[standard.code] = buildStandardSection(pb, section++, standard, record, report, metrics, phase2) + 1;
  }

  buildMethodology(pb, section++, metrics, index);
  assignPageNumbers(index, pages);
  buildDisclosureIndexSection(pb, section++, index);

  // Optional annex — present only where this facility has entered SKU-level
  // production. Outside the disclosure index and outside the conformity claim,
  // because ESRS has no product carbon footprint datapoint.
  if (phase2?.productFootprint.hasData) {
    buildProductFootprintAnnex(pb, section++, phase2);
  }

  buildDeclaration(pb, section, facility, index);

  pb.finalize();
  return doc;
};

// ---------------------------------------------------------------------------

function buildCover(
  pb: PageBuilder,
  report: CsrdReportWithRelations,
  facility: FacilityWithCompany,
  metrics: CsrdMetrics,
  index: CsrdDisclosureIndex,
  reference: string,
  qr: { buffer: Buffer; url: string },
) {
  const conformant = index.claimLevel === "ESRS_CONFORMANT";
  pb.coverShell({
    logoPath: LOGO_PATH,
    eyebrow: "Sustainability Statement",
    title: "CSRD / ESRS Sustainability Statement",
    subtitle: `European Sustainability Reporting Standards disclosure for ${facility.name}`,
    heroLabel: "Material ESRS Standards",
    heroValue: `${metrics.conformity.materialStandardCount} of ${ESRS_STANDARDS.length}`,
    heroDelta: conformant
      ? { text: "Prepared in accordance with ESRS", tone: "green" as const }
      : { text: "Prepared with reference to ESRS", tone: "amber" as const },
    referenceBadge: reference,
    controlTitle: "Document Control",
    controlRows: [
      ["Document ID", reference],
      ["Version", "v1.0"],
      ["Classification", "Confidential — Stakeholder Disclosure"],
      ["Distribution", "Company Admin, Stakeholders, Assurance Provider"],
      ["Standards applied", "ESRS (2026)"],
      ["Generated", fmtDateTime(new Date())],
      ["Reporting period", report.reportingPeriod],
    ],
    qrPngBuffer: qr.buffer,
    qrCaption: "Scan to verify",
    qrUrl: qr.url,
    docIdBadge: `DOC ID  ${reference}  ·  v1.0`,
    confidentialityText:
      "This document is classified Confidential — Stakeholder Disclosure and is intended solely for the named distribution list above. Unauthorised copying or distribution is prohibited. © 2026 Intellocarbon Solutions Private Limited.",
  });
}

function buildAboutStatement(
  pb: PageBuilder,
  section: number,
  report: CsrdReportWithRelations,
  facility: FacilityWithCompany,
  metrics: CsrdMetrics,
  index: CsrdDisclosureIndex,
) {
  pb.startSection(section, "About This Statement");

  pb.heading("Basis of preparation");
  pb.paragraph(index.claimStatement);

  // The applicability notice sits at the very front, before any figure, so a
  // reader below the Omnibus thresholds cannot skim the document and conclude
  // they are in mandatory scope.
  pb.ensureSpace(90);
  pb.heading("Applicability — who must report under CSRD");
  pb.paragraph(index.applicabilityNotice);
  pb.table({
    columns: [
      { header: "Mandatory-scope test (Omnibus I)", width: 320 },
      { header: "Threshold", width: 175, align: "right" },
    ],
    rows: [
      ["Employees", `more than ${fmtInt(CSRD_EMPLOYEE_THRESHOLD)}`],
      ["Net turnover", `more than EUR ${fmtInt(CSRD_TURNOVER_THRESHOLD_EUR)}`],
      ["First reporting period", "Financial years beginning in 2027"],
    ],
  });
  pb.note(
    "Both thresholds must be exceeded. An undertaking below them is outside CSRD's mandatory scope and may use this statement voluntarily — for instance to answer a customer's value-chain request — but it is not evidence of a filing obligation.",
  );

  // The reconciliation caveat is a statement about this software, not about
  // the preparer's data, and is labelled as such.
  if (!index.registryReconciled) {
    pb.ensureSpace(80);
    pb.heading("Datapoint reconciliation status");
    pb.paragraph(
      `The revised ESRS (2026) delegated act applies to financial years beginning on or after 1 January 2027. ` +
        `${index.confirmedDatapoints} of ${index.totalDatapoints} datapoint definitions in this tool have been reconciled against that adopted text. ` +
        "Until reconciliation is complete this statement is issued as prepared with reference to the ESRS, and must not be filed as a conformant sustainability statement. " +
        "This is a limitation of the reporting tool, not of the information the undertaking has provided.",
    );
  }

  if (metrics.conformity.blockers.length > 0) {
    pb.heading("Outstanding items");
    pb.table({
      columns: [
        { header: "#", width: 25 },
        { header: "Outstanding", width: 470 },
      ],
      rows: metrics.conformity.blockers.map((b, i) => [String(i + 1), b]),
    });
  }

  pb.heading("Reporting boundary and period");
  pb.keyValueColumns(
    "UNDERTAKING",
    [
      ["Company", facility.company.name],
      ["Sector", facility.company.sector],
      ["Reporting period", report.reportingPeriod],
      [
        "Period covered",
        `${fmtDate(metrics.fyWindow.start)} – ${fmtDate(new Date(metrics.fyWindow.end.getTime() - 86400000))}`,
      ],
    ],
    "REPORTING ENTITY",
    [
      ["Facility", facility.name],
      ["Reporting basis", "Facility-level, entity-controlled operations"],
      ["Net revenue basis", report.netRevenueEur != null ? `EUR ${fmt(report.netRevenueEur, 0)}` : NOT_REPORTED],
      ["Standards applied", `ESRS 2 and ${metrics.conformity.materialStandardCount} topical standards`],
    ],
  );
}

function buildGeneralDisclosures(
  pb: PageBuilder,
  section: number,
  report: CsrdReportWithRelations,
  phase2: ReportPhase2Data | undefined,
): number {
  const pageIndex = pb.startSection(section, "ESRS 2 — General Disclosures");
  const g = report.generalDisclosures as unknown as Record<string, unknown> | null;

  pb.paragraph(
    "ESRS 2 applies to every undertaking regardless of the outcome of the double materiality assessment. It covers " +
      "the basis of preparation, governance, strategy and business model, the process for identifying impacts, " +
      "risks and opportunities, and the minimum requirements for reporting policies, actions, targets and metrics.",
  );

  renderDatapoints(pb, ESRS_2_DATAPOINTS, g);

  // GOV-1 to GOV-5 are answered above from this statement's own entry. This
  // adds the cross-framework view: which governance commitments the
  // undertaking has disclosed anywhere on this platform — under ESRS 2/G1,
  // GRI 2 or CDP C1 — with the source named for each, which no single
  // framework's section can answer.
  if (phase2) {
    pb.heading("Governance and policy coverage across frameworks (supplementary)");
    drawGovernanceBlock(pb, phase2.governance);
  }

  return pageIndex;
}

/** Shared datapoint rendering — narratives as headed paragraphs, quantitative ones batched into a table. */
function renderDatapoints(pb: PageBuilder, datapoints: EsrsDatapoint[], row: Record<string, unknown> | null) {
  let pending: [string, string][] = [];

  const flush = () => {
    if (pending.length === 0) return;
    pb.table({
      columns: [
        { header: "Datapoint", width: 330 },
        { header: "Value", width: 165, align: "right" },
      ],
      rows: pending,
    });
    pending = [];
  };

  for (const dp of datapoints) {
    if (dp.derived) continue; // Derived figures are rendered by the standard's own section.
    const value = row?.[dp.field];

    if (dp.type === "narrative") {
      flush();
      pb.heading(`${dp.code} ${dp.label}`);
      pb.paragraph(fmtText(value as string | null));
      if (dp.phaseIn) pb.note(`Phase-in: ${dp.phaseIn}`);
      continue;
    }

    const rendered =
      dp.type === "bool"
        ? fmtBool(value as boolean | null)
        : dp.type === "pct"
          ? fmtPct(value as number | null)
          : dp.type === "int" || dp.type === "year"
            ? fmtCount(value as number | null)
            : fmtNum(value as number | null, dp.unit ?? "");
    pending.push([`${dp.code} ${dp.label}`, rendered]);
  }
  flush();
}

// ---------------------------------------------------------------------------
// Double materiality
// ---------------------------------------------------------------------------

const IMPACT_TYPE_LABEL: Record<string, string> = {
  NEGATIVE_ACTUAL: "Negative, actual",
  NEGATIVE_POTENTIAL: "Negative, potential",
  POSITIVE_ACTUAL: "Positive, actual",
  POSITIVE_POTENTIAL: "Positive, potential",
};

function buildMaterialityAssessment(pb: PageBuilder, section: number, report: CsrdReportWithRelations) {
  pb.startSection(section, "Double Materiality Assessment");
  const assessment = report.materialityAssessment;
  const impactThreshold = assessment?.impactThreshold ?? 3;
  const financialThreshold = assessment?.financialThreshold ?? 3;

  pb.paragraph(
    "ESRS requires a double materiality assessment: sustainability matters are assessed both for the undertaking's " +
      "impacts on people and the environment (impact materiality, looking outwards) and for their effects on the " +
      "undertaking's own financial position, performance and cash flows (financial materiality, looking inwards). " +
      "A matter is material, and its standard must be reported, if it clears the threshold on EITHER axis.",
  );

  pb.heading("IRO-1 Process to identify and assess impacts, risks and opportunities");
  pb.paragraph(fmtText(assessment?.iroIdentificationProcess));
  pb.paragraph(fmtText(assessment?.prioritisationProcess));

  if (assessment?.stakeholderGroups?.length) {
    pb.heading("Stakeholder groups engaged");
    pb.paragraph(assessment.stakeholderGroups.join("  ·  "));
  }
  if (assessment?.engagementApproach) pb.paragraph(assessment.engagementApproach);

  pb.heading("Scoring method");
  pb.paragraph(
    "Impact materiality follows the severity construction ESRS aligns with GRI: scale, scope and — for negative " +
      "impacts — irremediability, weighted by likelihood where the impact has not yet occurred. Financial " +
      "materiality is the magnitude of the financial effect weighted by the likelihood it materialises; severity " +
      "does not apply, since a financial effect has a size and a probability rather than a scope. A standard takes " +
      "the highest score of its matters on each axis, not an average, so a cluster of minor matters cannot dilute " +
      "a severe one.",
  );
  pb.formulaBlock(
    "Materiality determination",
    [
      ["Impact severity", "mean(scale, scope, irremediability)"],
      ["Financial score", "magnitude"],
      ["Likelihood weighting", "x (0.5 + 0.5 x likelihood / 5)   [0.6 to 1.0]"],
      ["Impact threshold (disclosed)", fmt(impactThreshold, 2)],
      ["Financial threshold (disclosed)", fmt(financialThreshold, 2)],
    ],
    "Standard is material when",
    `impact >= ${fmt(impactThreshold, 2)} OR financial >= ${fmt(financialThreshold, 2)}`,
  );

  const iros = assessment?.iros ?? [];
  if (iros.length > 0) {
    pb.ensureSpace(280);
    pb.heading("Double materiality matrix");
    pb.paragraph(
      "Financial materiality on the horizontal axis, impact materiality on the vertical. Shading marks the region " +
        "material on either axis; the darker overlap in the upper right is material on both. A matter scored on " +
        "only one axis is plotted at the axis minimum on the other.",
      { size: 9 },
    );

    const points: ScatterPoint[] = iros.map((iro) => {
      const standard = getEsrsStandard(iro.standardCode);
      const bothAxes = iro.impactScore != null && iro.financialScore != null;
      return {
        x: iro.financialScore ?? 1,
        y: iro.impactScore ?? 1,
        label: standard?.label.replace("ESRS ", "") ?? iro.standardCode,
        color: bothAxes ? TEAL_DARK : iro.financialScore != null ? CHART_BLUE : CHART_RED,
      };
    });

    pb.y = scatterMatrix(pb.doc, {
      x: MARGIN_X,
      y: pb.y,
      width: CONTENT_WIDTH,
      height: 230,
      points,
      xLabel: "Financial materiality  (magnitude x likelihood)",
      yLabel: "Impact materiality",
      thresholdY: impactThreshold,
      thresholdLabel: `Impact threshold — ${fmt(impactThreshold, 2)}`,
      thresholdX: financialThreshold,
      thresholdXLabel: `Financial threshold — ${fmt(financialThreshold, 2)}`,
    });
    pb.note("Teal markers are scored on both axes; blue on financial materiality only; red on impact materiality only.");

    pb.heading("Identified impacts, risks and opportunities");
    pb.table({
      columns: [
        { header: "Standard", width: 52 },
        { header: "Matter", width: 200 },
        { header: "Type", width: 86 },
        { header: "Impact", width: 44, align: "right" },
        { header: "Financial", width: 52, align: "right" },
        { header: "Chain", width: 61 },
      ],
      rows: iros
        .slice()
        .sort((a, b) => Math.max(b.impactScore ?? 0, b.financialScore ?? 0) - Math.max(a.impactScore ?? 0, a.financialScore ?? 0))
        .map((iro) => {
          const standard = getEsrsStandard(iro.standardCode);
          const type = iro.impactType
            ? IMPACT_TYPE_LABEL[iro.impactType]
            : iro.financialEffectType === "OPPORTUNITY"
              ? "Opportunity"
              : "Risk";
          return [
            standard?.label.replace("ESRS ", "") ?? iro.standardCode,
            iro.description,
            type,
            iro.impactScore != null ? fmt(iro.impactScore, 2) : "—",
            iro.financialScore != null ? fmt(iro.financialScore, 2) : "—",
            iro.valueChainLocation === "OWN_OPERATIONS" ? "Own ops" : iro.valueChainLocation === "UPSTREAM" ? "Upstream" : "Downstream",
          ];
        }),
    });
  }

  pb.heading("Material ESRS standards");
  const materialTopics = report.materialTopics
    .filter((t) => t.isMaterial)
    .sort((a, b) => Math.max(b.impactScore ?? 0, b.financialScore ?? 0) - Math.max(a.impactScore ?? 0, a.financialScore ?? 0));

  if (materialTopics.length === 0) {
    pb.paragraph(
      "No ESRS standard reached the disclosed threshold on either axis for this reporting period. An ESRS " +
        "statement with no material topical standard is unusual and should be reviewed before publication.",
    );
  } else {
    pb.table({
      columns: [
        { header: "Standard", width: 75 },
        { header: "Topic", width: 220 },
        { header: "Impact", width: 65, align: "right" },
        { header: "Financial", width: 70, align: "right" },
        { header: "Material via", width: 65 },
      ],
      rows: materialTopics.map((t) => {
        const standard = getEsrsStandard(t.standardCode);
        const via = t.impactMaterial && t.financialMaterial ? "Both" : t.impactMaterial ? "Impact" : "Financial";
        return [
          standard?.label ?? t.standardCode,
          standard?.title ?? t.standardCode,
          t.impactScore != null ? fmt(t.impactScore, 2) : "—",
          t.financialScore != null ? fmt(t.financialScore, 2) : "—",
          via,
        ];
      }),
    });
  }

  const excluded = report.materialTopics.filter((t) => !t.isMaterial);
  if (excluded.length > 0) {
    pb.heading("Standards assessed and determined not material");
    pb.paragraph(
      "ESRS requires the statement to be explicit about what was assessed and excluded rather than silently " +
        "omitting it. Each standard below was considered and did not reach the threshold on either axis.",
      { size: 9 },
    );
    pb.table({
      columns: [
        { header: "Standard", width: 75 },
        { header: "Topic", width: 140 },
        { header: "Rationale", width: 280 },
      ],
      rows: excluded
        .sort((a, b) => a.standardCode.localeCompare(b.standardCode))
        .map((t) => {
          const standard = getEsrsStandard(t.standardCode);
          return [standard?.label ?? t.standardCode, standard?.title ?? t.standardCode, t.notMaterialRationale ?? "No rationale stated."];
        }),
    });
  }
}

// ---------------------------------------------------------------------------
// Per-standard sections
// ---------------------------------------------------------------------------

function buildStandardSection(
  pb: PageBuilder,
  section: number,
  standard: EsrsStandard,
  record: CsrdMaterialTopic,
  report: CsrdReportWithRelations,
  metrics: CsrdMetrics,
  phase2: ReportPhase2Data | undefined,
): number {
  const pageIndex = pb.startSection(section, `${standard.label} — ${standard.title}`);

  const via = record.impactMaterial && record.financialMaterial ? "impact and financial materiality" : record.impactMaterial ? "impact materiality" : "financial materiality";
  pb.note(
    `Determined material in this reporting period via ${via}` +
      (record.impactScore != null ? ` (impact ${fmt(record.impactScore, 2)}` : "") +
      (record.financialScore != null ? `${record.impactScore != null ? ", " : " ("}financial ${fmt(record.financialScore, 2)}` : "") +
      (record.impactScore != null || record.financialScore != null ? ")." : "."),
  );

  // ESRS 2's minimum disclosure requirements, restated per material standard.
  pb.heading("Minimum disclosure requirements");
  for (const [label, value] of [
    ["MDR-P Policies", record.policies],
    ["MDR-A Actions", record.actions],
    ["MDR-T Targets", record.targets],
    ["MDR-M Metrics", record.metrics],
  ] as [string, string | null][]) {
    pb.ensureSpace(30);
    pb.doc.fillColor(TEAL_DARK).font("Helvetica-Bold").fontSize(9).text(label, MARGIN_X, pb.y);
    pb.y += 13;
    pb.paragraph(fmtText(value), { size: 9.5 });
  }

  renderDerivedFigures(pb, standard, metrics, phase2);

  const row = ((report as unknown as Record<string, unknown>)[standard.relation] ?? null) as Record<string, unknown> | null;
  renderDatapoints(pb, standard.datapoints, row);

  return pageIndex;
}

/** The figures this standard reuses from the platform's engines, with a chart where one helps. */
function renderDerivedFigures(
  pb: PageBuilder,
  standard: EsrsStandard,
  metrics: CsrdMetrics,
  phase2: ReportPhase2Data | undefined,
) {
  const r = metrics.rollup;
  const i = metrics.intensities;

  if (standard.code === "ESRS_E1") {
    pb.heading("E1-5 / E1-6 Energy and GHG emissions (derived)");
    pb.paragraph(
      "Scope 1 and Scope 2 are reused from this facility's activity data on the IPCC AR5 basis, which is the GHG " +
        "Protocol convention ESRS follows — deliberately distinct from the AR2/BUR3 basis used for India's BRSR and " +
        "CCTS reporting on the same records. Energy is stated in MWh as ESRS specifies.",
      { size: 9 },
    );
    pb.summaryBox(
      "Climate metrics",
      [
        ["Scope 1 (E1-6)", `${fmt(r.scope1Tco2e, 2)} tCO2e`],
        ["Scope 2, location-based (E1-6a)", `${fmt(r.scope2LocationTco2e, 2)} tCO2e`],
        ["Scope 3 (E1-6c)", r.scope3Tco2e != null ? `${fmt(r.scope3Tco2e, 2)} tCO2e` : NOT_REPORTED],
        ["Total GHG (E1-6d)", `${fmt(r.totalGhgTco2e, 2)} tCO2e`],
        ["Total energy (E1-5)", `${fmt(r.totalEnergyMwh, 3)} MWh`],
        ["Renewable energy (E1-5c)", `${fmt(r.renewableEnergyMwh, 3)} MWh`],
        ["GHG intensity (E1-6e)", i.ghgPerRevenue != null ? `${fmt(i.ghgPerRevenue, 8)} tCO2e/EUR` : "Not calculable"],
        ["Carbon credits cancelled (E1-7b)", r.carbonCreditsCancelledTco2e != null ? `${fmt(r.carbonCreditsCancelledTco2e, 2)} tCO2e` : NOT_REPORTED],
      ],
      { tone: "teal" },
    );

    const segments = [
      { label: "Scope 1", value: r.scope1Tco2e, color: TEAL },
      { label: "Scope 2", value: r.scope2LocationTco2e, color: CHART_SLATE },
    ];
    if (r.scope3Tco2e != null && r.scope3Tco2e > 0) segments.push({ label: "Scope 3", value: r.scope3Tco2e, color: CHART_BLUE });
    if (segments.reduce((s, seg) => s + seg.value, 0) > 0) {
      pb.ensureSpace(190);
      pb.y = donutChart(pb.doc, { x: MARGIN_X, y: pb.y, diameter: 120, unit: "tCO2e", centerLabel: "Total", segments });
    }

    // E1-5 states this period's renewable share. Whether it is moving is a
    // separate question and needs more than one period, so the trend draws
    // only where the undertaking has filed more than one.
    if (phase2 && phase2.energyMix.points.length > 1) {
      pb.heading("E1-5 Renewable share over time (supplementary)");
      drawEnergyMixBlock(pb, phase2.energyMix);
    }

    // E1-4 asks for GHG reduction targets and E1-1 for the transition plan
    // they sit in. These are the undertaking's targets from its own register,
    // set at entity level and reproduced unchanged — this facility's share of
    // them is not apportioned, because no such apportionment has been stated.
    if (phase2 && hasTargetsToReport(phase2)) {
      pb.heading("E1-4 Reduction targets and progress (entity-level, supplementary)");
      drawTargetsTable(pb, phase2);
      drawTrajectoryChart(pb, phase2.trajectory);
    }
    return;
  }

  if (standard.code === "ESRS_E3" && metrics.rollup.hasWaterData) {
    pb.heading("E3-4 Water (derived)");
    pb.paragraph(
      "Reused from this facility's ISO 14046 water inventory, in cubic metres as ESRS states it. Consumption is " +
        "derived as withdrawal minus discharge and never stored separately, so the three figures reconcile.",
      { size: 9 },
    );
    pb.summaryBox(
      "Water metrics",
      [
        ["Withdrawal (E3-4a)", `${fmt(r.waterWithdrawalM3, 3)} m3`],
        ["Discharge (E3-4b)", `${fmt(r.waterDischargeM3, 3)} m3`],
        ["Consumption (E3-4)", `${fmt(r.waterConsumptionM3, 3)} m3`],
        ["Recycled and reused (E3-4d)", `${fmt(r.waterRecycledM3, 3)} m3`],
        ["Water intensity (E3-4e)", i.waterPerRevenue != null ? `${fmt(i.waterPerRevenue, 8)} m3/EUR` : "Not calculable"],
      ],
      { tone: "teal" },
    );
    return;
  }

  if (standard.code === "ESRS_E5" && metrics.rollup.wasteGeneratedTonnes != null) {
    pb.heading("E5-5 Resource outflows (derived)");
    pb.paragraph(
      "Reused from this facility's GRI 306 waste disclosure for the same reporting period, so the two statements " +
        "cannot disagree on the same underlying figures.",
      { size: 9 },
    );
    pb.summaryBox(
      "Waste metrics",
      [
        ["Waste generated (E5-5a)", `${fmt(r.wasteGeneratedTonnes ?? 0, 3)} t`],
        ["Diverted from disposal (E5-5b)", `${fmt(r.wasteDivertedTonnes ?? 0, 3)} t`],
        ["Directed to disposal (E5-5c)", `${fmt(r.wasteDisposalTonnes ?? 0, 3)} t`],
        ["Hazardous waste (E5-5d)", `${fmt(r.hazardousWasteTonnes ?? 0, 3)} t`],
      ],
      { tone: "teal" },
    );
    if ((r.wasteGeneratedTonnes ?? 0) > 0) {
      pb.ensureSpace(190);
      pb.y = donutChart(pb.doc, {
        x: MARGIN_X,
        y: pb.y,
        diameter: 120,
        unit: "t",
        centerLabel: "Generated",
        segments: [
          { label: "Diverted", value: r.wasteDivertedTonnes ?? 0, color: TEAL },
          { label: "Disposal", value: r.wasteDisposalTonnes ?? 0, color: CHART_AMBER },
        ],
      });
    }

    // Only the rate, not the whole circularity block. E5-5 above already gives
    // the tonnages and the diverted/disposal split, from the same GRI 306
    // disclosure the rollup reads — repeating them under a second heading with
    // a second donut would be the same numbers twice. The rate is the one
    // figure E5-5 does not state, and stating it saves a reader deriving it by
    // hand from two rows.
    if (phase2?.circularity.hasData && phase2.circularity.circularityRatePct != null) {
      pb.keyValueRow(
        "Circularity rate — diverted from disposal as a share of waste generated (derived)",
        `${fmt(phase2.circularity.circularityRatePct, 1)}%`,
      );
    }
    return;
  }

  // ESRS S2 covers workers in the value chain. The supplier register is the
  // undertaking's own record of who those value-chain relationships are with
  // and what ESG disclosure it holds for each — the evidence base behind an
  // S2-1 policy statement rather than a substitute for it.
  if (standard.code === "ESRS_S2" && phase2) {
    pb.heading("Supplier register and disclosure coverage (supplementary)");
    drawSupplierScorecardBlock(pb, phase2.suppliers);
  }
}

// ---------------------------------------------------------------------------

function buildMethodology(pb: PageBuilder, section: number, metrics: CsrdMetrics, index: CsrdDisclosureIndex) {
  pb.startSection(section, "Methodology and Standards Basis");

  pb.heading("Standards applied");
  pb.paragraph(
    "This statement applies the European Sustainability Reporting Standards as revised by the delegated act adopted " +
      "on 3 July 2026 (“ESRS (2026)”), which apply to financial years beginning on or after 1 January 2027 and " +
      "reduce the datapoint set of the original 2023 standards by roughly 70 per cent.",
  );

  pb.heading("Datapoint reconciliation");
  pb.paragraph(
    `${index.confirmedDatapoints} of ${index.totalDatapoints} datapoint definitions used by this tool have been ` +
      "reconciled against the adopted text. The disclosure index records the status of each. While any remain " +
      "unreconciled, this statement is issued as prepared with reference to the ESRS and must not be filed as a " +
      "conformant sustainability statement.",
  );

  pb.heading("Reused and derived figures");
  pb.table({
    columns: [
      { header: "Datapoint", width: 130 },
      { header: "Source and basis", width: 365 },
    ],
    rows: [
      ["E1-6, E1-6a", "Scope 1 and location-based Scope 2 from this facility's activity data on the IPCC AR5 (100-yr) GWP basis, per GHG Protocol."],
      ["E1-6c", "Rolled up from submitted Scope 3 value-chain entries for the same reporting period."],
      ["E1-5", "Electricity and imported steam from activity data, converted to MWh at 3.6 GJ/MWh. Fuel energy is entered manually."],
      ["E1-7b", "Carbon credits cancelled, from the voluntary offsets log."],
      ["E3-4", "ISO 14046 water inventory in cubic metres. Consumption derived as withdrawal minus discharge."],
      ["E5-5", "Reused from the GRI 306 waste disclosure for the same period, so the two statements cannot diverge."],
    ],
  });

  pb.heading("Reporting period");
  pb.paragraph(
    `All figures cover ${metrics.fyWindow.label} (${fmtDate(metrics.fyWindow.start)} to ${fmtDate(new Date(metrics.fyWindow.end.getTime() - 86400000))}), resolved against the undertaking's financial year.`,
  );
}

const INDEX_COLUMNS = [
  { header: "Standard", width: 92 },
  { header: "Code", width: 46 },
  { header: "Datapoint", width: 200 },
  { header: "Page", width: 32, align: "right" as const },
  { header: "Omission", width: 70 },
  { header: "Status", width: 55 },
];

const indexRow = (e: CsrdDisclosureIndexEntry): string[] => [
  e.standard,
  e.code,
  e.label,
  e.pageNumber != null ? String(e.pageNumber) : "—",
  e.reported ? "" : SHORT_OMISSION[e.omissionReason ?? ""] ?? "",
  e.status === "CONFIRMED" ? "Confirmed" : "Unrecon.",
];

function buildDisclosureIndexSection(pb: PageBuilder, section: number, index: CsrdDisclosureIndex) {
  pb.startSection(section, "ESRS Disclosure Index");

  pb.heading("Basis of preparation");
  pb.paragraph(index.claimStatement);
  pb.paragraph(
    "ESRS 2 IRO-2 requires the statement to list the disclosure requirements it covers, and ESRS 1 requires " +
      "omissions to be explained rather than left blank. The Status column records whether each datapoint's " +
      "definition has been reconciled against the adopted ESRS (2026) text.",
    { size: 9 },
  );

  pb.summaryBox("Index Summary", [
    ["Datapoints reported", fmtInt(index.reportedCount)],
    ["Omitted with a stated reason", fmtInt(index.omittedCount)],
    ["Of which phase-in relief", fmtInt(index.phaseInCount)],
    ["Definitions reconciled with ESRS (2026)", `${index.confirmedDatapoints} of ${index.totalDatapoints}`],
    ["Standards assessed and not material", fmtInt(index.excludedStandards.length)],
  ]);

  // One table per block: table() paginates rows but draws its header once, so
  // a single long table would continue headerless onto later pages.
  const general = index.entries.filter((e) => e.section === "GENERAL");
  pb.heading("ESRS 2: General disclosures");
  pb.table({ columns: INDEX_COLUMNS, rows: general.map(indexRow) });

  const codes = Array.from(new Set(index.entries.filter((e) => e.section === "STANDARD").map((e) => e.standardCode!)));
  for (const code of codes) {
    const standard = getEsrsStandard(code);
    pb.heading(standard ? `${standard.label}: ${standard.title}` : code);
    pb.table({ columns: INDEX_COLUMNS, rows: index.entries.filter((e) => e.standardCode === code).map(indexRow) });
  }

  pb.heading("Omission reasons");
  pb.table({
    columns: [
      { header: "Abbreviation", width: 150 },
      { header: "Reason", width: 345 },
    ],
    rows: Object.entries(SHORT_OMISSION).map(([key, short]) => [
      short,
      CSRD_OMISSION_REASON_LABELS[key as keyof typeof CSRD_OMISSION_REASON_LABELS],
    ]),
  });

  if (index.excludedStandards.length > 0) {
    pb.heading("Standards assessed and determined not material");
    pb.table({
      columns: [
        { header: "Standard", width: 175 },
        { header: "Rationale", width: 320 },
      ],
      rows: index.excludedStandards.map((s) => [s.standard, s.rationale]),
    });
  }
}

/**
 * Annex — product carbon footprint per product.
 *
 * An allocation of this facility's Scope 1 and 2 emissions across its listed
 * products by output volume, not a life-cycle assessment. ESRS E1-6e states a
 * GHG intensity per net revenue; this is a different denominator and a
 * different figure, and neither substitutes for the other. Kept as an annex
 * because ESRS has no product footprint datapoint — placing it among the
 * numbered standard sections would imply one exists.
 */
function buildProductFootprintAnnex(pb: PageBuilder, section: number, phase2: ReportPhase2Data) {
  pb.startSection(section, "Annex — Product Carbon Footprint by Product");

  pb.paragraph(
    "This annex allocates the facility's Scope 1 and Scope 2 emissions across the products it has listed for this " +
      "reporting period, in proportion to output volume. It is not a life-cycle assessment and not a cradle-to-gate " +
      "product carbon footprint: no upstream or downstream emissions are included, and these figures are not " +
      "comparable to a footprint produced under ISO 14067 or a product category rule.",
  );
  pb.note(
    "Not an ESRS datapoint. E1-6e reports GHG intensity per net revenue, which is a different denominator; this " +
      "annex sits outside the disclosure index and outside the conformity claim.",
  );

  drawProductFootprintBlock(pb, phase2.productFootprint);
}

function buildDeclaration(
  pb: PageBuilder,
  section: number,
  facility: FacilityWithCompany,
  index: CsrdDisclosureIndex,
) {
  pb.startSection(section, "Assurance and Declaration");
  const owner = facility.company.owner;
  const conformant = index.claimLevel === "ESRS_CONFORMANT";

  // CSRD requires limited assurance over the sustainability statement. This
  // platform holds no assurance record against a CSRD statement — the verifier
  // workflow covers CBAM, CCTS and BRSR only — so the position is stated as
  // the absence it is, in the same block every other report uses. Leaving the
  // question unanswered in a document whose whole subject is a regulated
  // assurance regime would be the worse silence.
  pb.verificationBlock({
    title: "Assurance status",
    verifierName: null,
    verifierOrg: null,
    accreditationRef: null,
    statementLabel: "Limited assurance engagement",
    statement: null,
    verifiedAt: null,
    unverifiedNote:
      "This statement has not been assured. CSRD requires limited assurance over the sustainability statement by an " +
      "accredited independent assurance services provider, and no such engagement is recorded on the Intellocarbon " +
      "platform against this statement. Where a provider is engaged separately, their assurance report is the record " +
      "of it and this document is not.",
  });

  pb.heading("Declaration");
  pb.paragraph(
    `I/We, on behalf of ${facility.company.name}, declare that the information in this sustainability statement has ` +
      "been prepared in good faith based on data submitted through the Intellocarbon platform, and that this " +
      `statement has been prepared ${conformant ? "in accordance with" : "with reference to"} the European ` +
      "Sustainability Reporting Standards for the reporting period stated.",
  );

  if (!conformant) {
    pb.note(
      "This statement makes the 'prepared with reference to' claim. The requirements outstanding for a conformant " +
        "ESRS statement are listed in the About This Statement section, and it must not be filed as a conformant " +
        "sustainability statement.",
    );
  }

  pb.ensureSpace(70);
  pb.doc.moveTo(MARGIN_X, pb.y + 30).lineTo(MARGIN_X + 220, pb.y + 30).strokeColor(BORDER).lineWidth(1).stroke();
  pb.doc.fillColor(MUTED).font("Helvetica").fontSize(8).text("Signature", MARGIN_X, pb.y + 34);
  pb.doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(9.5).text(`${owner.name} — Company Administrator`, MARGIN_X, pb.y + 48);
  pb.doc.fillColor(MUTED).font("Helvetica").fontSize(8.5).text(`Date: ${fmtDate(new Date())}`, MARGIN_X, pb.y + 62);
  pb.y += 84;
}
