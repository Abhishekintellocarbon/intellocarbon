import { LOGO_LOCKUP_ON_DARK } from "../brandAssets";
import PDFDocument from "pdfkit";
import type { Company, Facility, User, GriMaterialTopic } from "@prisma/client";
import { PageBuilder } from "../cbamReport/layout";
import { buildVerifyQr } from "../cbamReport/qr";
import { MARGIN_X, CONTENT_WIDTH, MUTED, NAVY, TEAL, TEAL_DARK, BORDER, fmt, fmtInt, fmtDate, fmtDateTime } from "../cbamReport/theme";
import {
  donutChart,
  verticalBarChart,
  horizontalGroupedBars,
  scatterMatrix,
  CHART_BLUE,
  CHART_SLATE,
  CHART_AMBER,
  CHART_RED,
  type ScatterPoint,
} from "../cbamReport/charts";
import {
  GRI_TOPIC_STANDARDS,
  GRI_3_3_REQUIREMENTS,
  GRI_OMISSION_REASON_LABELS,
  getGriTopic,
  type GriTopicStandard,
} from "../../data/griStandards";
import type { GriMetrics, GriReportWithRelations } from "../griCalculation.service";
import { assignPageNumbers, type GriContentIndex, type GriContentIndexEntry } from "../griContentIndex.service";
import type { ReportPhase2Data } from "../reportSections/phase2Data";
import {
  drawCircularityBlock,
  drawProductFootprintBlock,
  drawEnergyMixBlock,
  drawGovernanceBlock,
  drawRecCoverageBlock,
  drawSupplierScorecardBlock,
} from "../reportSections/esgBlocks";

// Cover band is the dark gradient — see brandAssets for why interior pages
// use the on-light lockup instead.
const LOGO_PATH = LOGO_LOCKUP_ON_DARK;

type FacilityWithCompany = Facility & { company: Company & { owner: User } };

// "Rs." rather than the Rupee glyph — pdfkit's standard fonts are WinAnsi-only
// and U+20B9 isn't in that encoding (same fix as brsrReport/issbReport).
const NOT_DISCLOSED = "Not disclosed";
const NOT_YET = "Not yet disclosed.";

const fmtNum = (v: number | null | undefined, unit = "", digits = 2): string =>
  v == null ? NOT_DISCLOSED : `${fmt(v, digits)}${unit ? ` ${unit}` : ""}`;
const fmtCount = (v: number | null | undefined): string => (v == null ? NOT_DISCLOSED : fmtInt(v));
const fmtPct = (v: number | null | undefined): string => (v == null ? NOT_DISCLOSED : `${fmt(v, 1)}%`);
const fmtCo2e = (v: number | null | undefined): string => (v == null ? NOT_DISCLOSED : `${fmt(v, 2)} tCO2e`);
const fmtInr = (v: number | null | undefined): string => (v == null ? NOT_DISCLOSED : `Rs. ${fmt(v, 0)}`);
const fmtText = (v: string | null | undefined): string => (v && v.trim() ? v : NOT_YET);
const fmtBool = (v: boolean | null | undefined): string => (v == null ? NOT_DISCLOSED : v ? "Yes" : "No");

/** Stable 4-digit code derived from the report id, so the same report always shows the same reference number. */
const stableDigits = (id: string): string => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return String(1000 + (hash % 9000));
};

const reportReference = (report: GriReportWithRelations): string =>
  `ICT-GRI-${report.reportingPeriod.replace("FY", "")}-${stableDigits(report.id)}`;

/**
 * Compact omission labels for the content index's rightmost column. The full
 * GRI wording is too wide for a five-column table at 9pt, so the table prints
 * these and a legend beneath maps them back to GRI's exact terms — the
 * abbreviation is presentational only, never what the claim rests on.
 */
const SHORT_OMISSION: Record<string, string> = {
  NOT_APPLICABLE: "Not applicable",
  CONFIDENTIALITY_CONSTRAINTS: "Confidentiality",
  LEGAL_PROHIBITIONS: "Legal prohibition",
  INFORMATION_UNAVAILABLE_INCOMPLETE: "Info unavailable",
};

/**
 * Full GRI Standards 2021 report.
 *
 * Section order follows GRI's own presentation: the statement of use and claim
 * first, then GRI 2 (General Disclosures), then GRI 3 (the materiality
 * assessment that decides everything after it), then one section per material
 * topic, then methodology, then the content index.
 *
 * The content index sits at the BACK deliberately. It has to cite the page
 * each disclosure appears on, and those pages are only known once the sections
 * have been laid out — rendering it last means the page references are read
 * off the real layout rather than reserved and hoped for. GRI requires the
 * index to be in one findable location, which the table of contents points to;
 * it does not require it to be at the front.
 */
export const buildGriPdf = async (
  report: GriReportWithRelations,
  facility: FacilityWithCompany,
  metrics: GriMetrics,
  contentIndex: GriContentIndex,
  /**
   * Optional because it genuinely is: a company that has entered none of this
   * renders a normal report with honest "not reported" states. The production
   * loader always supplies it.
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

  // Page numbers collected as sections render, then stamped onto the content
  // index before it is printed.
  const pages: Record<string, number> = {};

  buildCoverPage(pb, report, facility, metrics, contentIndex, reference, qr);
  pb.startTocPage();

  let section = 1;
  buildAboutThisReport(pb, section++, report, facility, metrics, contentIndex);

  pages.UNIVERSAL = buildOrganizationalProfile(pb, section++, report, facility) + 1;
  buildGovernanceAndPolicies(pb, section++, report, phase2);

  pages.MATERIAL_TOPICS = buildMaterialityAssessment(pb, section++, report) + 1;

  const materialTopics = GRI_TOPIC_STANDARDS.map((standard) => ({
    standard,
    record: report.materialTopics.find((t) => t.topicCode === standard.code),
  })).filter((t): t is { standard: GriTopicStandard; record: GriMaterialTopic } => t.record?.isMaterial === true);

  // Ordered by the materiality ranking rather than registry order — the report
  // should open on the topic with the most significant impact.
  materialTopics.sort((a, b) => (a.record.rank ?? 999) - (b.record.rank ?? 999));

  for (const { standard, record } of materialTopics) {
    pages[standard.code] = buildTopicSection(pb, section++, standard, record, report, metrics, phase2) + 1;
  }

  buildMethodology(pb, section++, report, metrics);

  assignPageNumbers(contentIndex, pages);
  buildContentIndexSection(pb, section++, contentIndex);

  // Optional annex — present only where this facility has entered SKU-level
  // production. Not part of the GRI content index, and deliberately not
  // numbered as a disclosure, because it is not one.
  if (phase2?.productFootprint.hasData) {
    buildProductFootprintAnnex(pb, section++, phase2);
  }

  buildDeclaration(pb, section, facility, contentIndex);

  pb.finalize();
  return doc;
};

// ---------------------------------------------------------------------------
// Cover
// ---------------------------------------------------------------------------

function buildCoverPage(
  pb: PageBuilder,
  report: GriReportWithRelations,
  facility: FacilityWithCompany,
  metrics: GriMetrics,
  contentIndex: GriContentIndex,
  reference: string,
  qr: { buffer: Buffer; url: string },
) {
  const materialCount = metrics.accordance.materialTopicCount;
  const inAccordance = contentIndex.claimLevel === "IN_ACCORDANCE";

  pb.coverShell({
    logoPath: LOGO_PATH,
    eyebrow: "Sustainability Reporting",
    title: "GRI Standards 2021 Report",
    subtitle: `Materiality-driven sustainability disclosure for ${facility.name}`,
    heroLabel: "Material Topics Reported",
    heroValue: `${materialCount} of ${GRI_TOPIC_STANDARDS.length}`,
    heroDelta: inAccordance
      ? { text: "In accordance with GRI Standards", tone: "green" as const }
      : { text: "Reported with reference to GRI Standards", tone: "amber" as const },
    referenceBadge: reference,
    controlTitle: "Document Control",
    controlRows: [
      ["Document ID", reference],
      ["Version", "v1.0"],
      ["Classification", "Confidential — Stakeholder Disclosure"],
      ["Distribution", "Company Admin, Stakeholders, Assurance Provider"],
      ["Standards applied", contentIndex.gri1Version],
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

// ---------------------------------------------------------------------------
// Section 01 — About this report (the GRI 1 statement of use and claim)
// ---------------------------------------------------------------------------

function buildAboutThisReport(
  pb: PageBuilder,
  section: number,
  report: GriReportWithRelations,
  facility: FacilityWithCompany,
  metrics: GriMetrics,
  contentIndex: GriContentIndex,
) {
  pb.startSection(section, "About This Report");

  const inAccordance = contentIndex.claimLevel === "IN_ACCORDANCE";

  pb.heading("Statement of use");
  pb.paragraph(contentIndex.claimStatement);
  pb.paragraph(`GRI 1 used: ${contentIndex.gri1Version}`, { bold: true, size: 9.5 });

  // The claim is stated once, prominently, and never asserted more strongly
  // than the underlying data supports — the whole point of the accordance
  // evaluation in griCalculation.service.ts.
  pb.ensureSpace(80);
  pb.statBox(
    inAccordance ? "IN ACCORDANCE WITH THE GRI STANDARDS" : "WITH REFERENCE TO THE GRI STANDARDS",
    `${metrics.accordance.materialTopicCount} material topics`,
    inAccordance
      ? "All nine GRI 1 reporting requirements are met for this reporting period."
      : "Not all GRI 1 reporting requirements are met — the outstanding items are listed below.",
  );

  if (!inAccordance) {
    pb.heading("Why this report claims 'with reference' rather than 'in accordance'");
    pb.paragraph(
      "GRI 1 permits the 'in accordance' claim only when every one of its nine reporting requirements is met. " +
        "The following are outstanding for this reporting period and are stated here rather than omitted, so that " +
        "readers can judge the completeness of the disclosure for themselves.",
    );
    pb.table({
      columns: [
        { header: "#", width: 25 },
        { header: "Outstanding requirement", width: 470 },
      ],
      rows: metrics.accordance.blockers.map((blocker, i) => [String(i + 1), blocker]),
    });
  }

  pb.heading("Reporting boundary and period");
  pb.keyValueColumns(
    "ORGANIZATION",
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
      ["Frameworks applied", `GRI 2, GRI 3, and ${metrics.accordance.materialTopicCount} Topic Standards`],
      ["Content index", "See the GRI Content Index section of this report"],
    ],
  );

  pb.note(
    "This is a facility-level GRI report. Where a disclosure is defined at organization level (for example GRI 2-1 " +
      "organizational details), it is reported for the company that owns this facility, and the reporting boundary " +
      "is stated alongside the figure.",
  );
}

// ---------------------------------------------------------------------------
// Section 02 — GRI 2: Organizational profile (2-1 to 2-8)
// ---------------------------------------------------------------------------

function buildOrganizationalProfile(
  pb: PageBuilder,
  section: number,
  report: GriReportWithRelations,
  facility: FacilityWithCompany,
): number {
  const pageIndex = pb.startSection(section, "General Disclosures — Organizational Profile");
  const u = report.universalDisclosures;
  const { company } = facility;

  pb.paragraph(
    "Disclosures 2-1 to 2-8 of GRI 2: General Disclosures 2021 — who the reporting organization is, what it does, " +
      "and who works for it.",
  );

  pb.heading("2-1 Organizational details");
  pb.table({
    columns: [
      { header: "Item", width: 200 },
      { header: "Disclosure", width: 295, align: "right" },
    ],
    rows: [
      ["Legal name", u?.legalName || company.name],
      ["Nature of ownership and legal form", u?.ownershipLegalForm || NOT_DISCLOSED],
      [
        "Location of headquarters",
        u?.headquartersLocation || [company.city, company.state, company.country].filter(Boolean).join(", ") || NOT_DISCLOSED,
      ],
      ["Countries of operation", u?.countriesOfOperation || company.country || NOT_DISCLOSED],
      ["Registration number", company.registrationNumber || NOT_DISCLOSED],
    ],
  });

  pb.heading("2-2 / 2-3 Entities included, reporting period and contact point");
  pb.table({
    columns: [
      { header: "Item", width: 200 },
      { header: "Disclosure", width: 295, align: "right" },
    ],
    rows: [
      ["Entities included in this report", u?.entitiesIncluded || facility.name],
      ["Reporting period", report.reportingPeriod],
      ["Reporting frequency", u?.reportingFrequency || NOT_DISCLOSED],
      ["Publication date", u?.publicationDate ? fmtDate(u.publicationDate) : fmtDate(new Date())],
      ["Contact point", u?.contactPoint || NOT_DISCLOSED],
    ],
  });

  pb.heading("2-4 Restatements of information");
  pb.paragraph(fmtText(u?.restatements));

  pb.heading("2-5 External assurance");
  pb.table({
    columns: [
      { header: "Item", width: 200 },
      { header: "Disclosure", width: 295, align: "right" },
    ],
    rows: [
      ["Assurance provider", u?.assuranceProvider || NOT_DISCLOSED],
      ["Level of assurance", u?.assuranceLevel || NOT_DISCLOSED],
    ],
  });
  if (u?.externalAssurancePolicy) {
    pb.paragraph(u.externalAssurancePolicy);
  }

  pb.heading("2-6 Activities, value chain and other business relationships");
  pb.paragraph(fmtText(u?.sectorsServed));
  pb.paragraph(fmtText(u?.valueChainDescription));
  if (u?.significantChangesToValueChain) {
    pb.paragraph(`Significant changes during the period: ${u.significantChangesToValueChain}`);
  }

  pb.heading("2-7 Employees");
  pb.table({
    columns: [
      { header: "Category", width: 260 },
      { header: "Head count", width: 235, align: "right" },
    ],
    rows: [
      ["Total employees", fmtCount(u?.employeesTotal)],
      ["Female", fmtCount(u?.employeesFemale)],
      ["Male", fmtCount(u?.employeesMale)],
      ["Permanent", fmtCount(u?.employeesPermanent)],
      ["Temporary", fmtCount(u?.employeesTemporary)],
      ["Full-time", fmtCount(u?.employeesFullTime)],
      ["Part-time", fmtCount(u?.employeesPartTime)],
    ],
  });
  if (u?.employeeDataMethodology) {
    pb.note(`Methodology and assumptions: ${u.employeeDataMethodology}`);
  }

  pb.heading("2-8 Workers who are not employees");
  pb.keyValueRow("Total workers who are not employees", fmtCount(u?.nonEmployeeWorkersTotal));
  pb.paragraph(fmtText(u?.nonEmployeeWorkersDescription));

  return pageIndex;
}

// ---------------------------------------------------------------------------
// Section 03 — GRI 2: Governance, strategy, policies (2-9 to 2-30)
// ---------------------------------------------------------------------------

function buildGovernanceAndPolicies(
  pb: PageBuilder,
  section: number,
  report: GriReportWithRelations,
  phase2: ReportPhase2Data | undefined,
) {
  pb.startSection(section, "General Disclosures — Governance, Strategy and Policies");
  const u = report.universalDisclosures;

  pb.paragraph(
    "Disclosures 2-9 to 2-30 of GRI 2: General Disclosures 2021 — governance of impacts, strategy and policy " +
      "commitments, and the organization's approach to stakeholders.",
  );

  const narrative = (label: string, value: string | null | undefined) => {
    pb.heading(label);
    pb.paragraph(fmtText(value));
  };

  narrative("2-9 Governance structure and composition", u?.governanceStructure);
  if (u?.governanceCommittees) pb.paragraph(`Committees: ${u.governanceCommittees}`);
  narrative("2-10 Nomination and selection of the highest governance body", u?.governanceNominationProcess);

  pb.heading("2-11 Chair of the highest governance body");
  pb.keyValueRow("Chair is also a senior executive", fmtBool(u?.chairIsSeniorExecutive));
  pb.paragraph(fmtText(u?.chairRoleDescription));

  narrative("2-12 Role of the highest governance body in overseeing the management of impacts", u?.governanceImpactOversight);
  narrative("2-13 Delegation of responsibility for managing impacts", u?.impactResponsibilityDelegation);
  narrative("2-14 Role of the highest governance body in sustainability reporting", u?.governanceReportingRole);
  narrative("2-15 Conflicts of interest", u?.conflictsOfInterestProcess);

  pb.heading("2-16 Communication of critical concerns");
  pb.keyValueRow("Critical concerns communicated during the period", fmtCount(u?.criticalConcernsCount));
  pb.paragraph(fmtText(u?.criticalConcernsProcess));

  narrative("2-17 Collective knowledge of the highest governance body", u?.governanceCollectiveKnowledge);
  narrative("2-18 Evaluation of the performance of the highest governance body", u?.governancePerformanceEvaluation);
  narrative("2-19 Remuneration policies", u?.remunerationPolicies);
  narrative("2-20 Process to determine remuneration", u?.remunerationProcess);

  pb.heading("2-21 Annual total compensation ratio");
  pb.table({
    columns: [
      { header: "Metric", width: 320 },
      { header: "Value", width: 175, align: "right" },
    ],
    rows: [
      [
        "Ratio of highest-paid individual's total annual compensation to the median for all other employees",
        u?.compensationRatio != null ? `${fmt(u.compensationRatio, 2)} : 1` : NOT_DISCLOSED,
      ],
      ["Percentage increase in that ratio year on year", fmtPct(u?.compensationRatioIncreasePct)],
    ],
  });

  narrative("2-22 Statement on sustainable development strategy", u?.sustainableDevelopmentStatement);
  narrative("2-23 Policy commitments", u?.policyCommitments);
  if (u?.humanRightsPolicyCommitment) {
    pb.paragraph(`Human rights policy commitment: ${u.humanRightsPolicyCommitment}`);
  }
  narrative("2-24 Embedding policy commitments", u?.policyEmbedding);
  narrative("2-25 Processes to remediate negative impacts", u?.remediationProcesses);
  narrative("2-26 Mechanisms for seeking advice and raising concerns", u?.adviceAndConcernsMechanisms);

  // 2-27 absorbed the withdrawn GRI 307 and GRI 419, so it covers both
  // environmental and socioeconomic non-compliance — worth saying explicitly,
  // since a reader looking for a "GRI 307" section needs to find it here.
  pb.heading("2-27 Compliance with laws and regulations");
  pb.table({
    columns: [
      { header: "Metric", width: 320 },
      { header: "Value", width: 175, align: "right" },
    ],
    rows: [
      ["Significant instances of non-compliance resulting in a fine", fmtCount(u?.significantFinesCount)],
      ["Total monetary value of fines paid", fmtInr(u?.significantFinesValueInr)],
      ["Significant instances resulting in a non-monetary sanction", fmtCount(u?.nonMonetarySanctionsCount)],
    ],
  });
  pb.paragraph(fmtText(u?.complianceIncidentsDescription));
  pb.note(
    "Disclosure 2-27 covers compliance with all laws and regulations, environmental and socioeconomic alike. It " +
      "replaced GRI 307: Environmental Compliance 2016 and GRI 419: Socioeconomic Compliance 2016, both of which " +
      "were withdrawn with the 2021 Universal Standards.",
  );

  narrative("2-28 Membership associations", u?.membershipAssociations);
  narrative("2-29 Approach to stakeholder engagement", u?.stakeholderEngagementApproach);

  pb.heading("2-30 Collective bargaining agreements");
  pb.keyValueRow("Employees covered by collective bargaining agreements", fmtPct(u?.collectiveBargainingCoveragePct));
  pb.paragraph(fmtText(u?.collectiveBargainingDescription));

  // A cross-framework view of the same governance ground GRI 2 covers.
  //
  // It is not a restatement of the disclosures above: it reports which
  // governance and policy commitments the organization has disclosed anywhere
  // on this platform — under GRI 2, ESRS 2/G1 or CDP C1 — and names the source
  // for each. That is the question a reader of a single framework's governance
  // section cannot answer, and every "not disclosed" row means no framework the
  // organization has filed carries it.
  if (phase2) {
    pb.heading("Governance and policy coverage across frameworks (supplementary)");
    drawGovernanceBlock(pb, phase2.governance);
  }
}

// ---------------------------------------------------------------------------
// Section 04 — GRI 3: Material topics and the materiality assessment
// ---------------------------------------------------------------------------

const IMPACT_TYPE_LABEL: Record<string, string> = {
  NEGATIVE_ACTUAL: "Negative, actual",
  NEGATIVE_POTENTIAL: "Negative, potential",
  POSITIVE_ACTUAL: "Positive, actual",
  POSITIVE_POTENTIAL: "Positive, potential",
};

const VALUE_CHAIN_LABEL: Record<string, string> = {
  OWN_OPERATIONS: "Own operations",
  UPSTREAM: "Upstream",
  DOWNSTREAM: "Downstream",
};

function buildMaterialityAssessment(pb: PageBuilder, section: number, report: GriReportWithRelations): number {
  const pageIndex = pb.startSection(section, "Material Topics — GRI 3");
  const assessment = report.materialityAssessment;
  const threshold = assessment?.materialityThreshold ?? 3;

  pb.paragraph(
    "GRI 3: Material Topics 2021 requires the organization to determine its material topics — those representing " +
      "its most significant impacts on the economy, environment and people — and to report which Topic Standards " +
      "follow from that determination. The assessment below is what decides the contents of this report.",
  );

  pb.heading("3-1 Process to determine material topics");
  pb.paragraph(fmtText(assessment?.impactIdentificationProcess));
  pb.paragraph(fmtText(assessment?.prioritisationProcess));

  if (assessment?.stakeholderGroups?.length) {
    pb.heading("Stakeholder groups identified");
    pb.paragraph(assessment.stakeholderGroups.join("  ·  "));
  }
  if (assessment?.stakeholderEngagementApproach) {
    pb.paragraph(assessment.stakeholderEngagementApproach);
  }

  // The scoring method is stated in the report itself, not buried in code — an
  // assurance provider has to be able to reproduce the ranking from what is
  // printed here.
  pb.heading("Significance scoring method");
  pb.paragraph(
    "Each identified impact is scored on GRI 3's attributes, all on a 1-5 scale. For negative impacts, significance " +
      "is the severity of the impact, determined from its scale (how grave), scope (how widespread) and " +
      "irremediability (how hard to counteract). For positive impacts, severity does not apply and significance is " +
      "determined from scale and scope. For potential impacts of either direction, the result is weighted by " +
      "likelihood. A topic takes the significance of its single most significant impact, not an average, so that a " +
      "cluster of minor impacts cannot dilute a severe one. The likelihood weighting is bounded so that it can " +
      "discount an uncertain impact by at most 40% but can never, on its own, remove a severe impact from the " +
      "report — severity takes precedence over likelihood, as GRI requires.",
  );
  pb.formulaBlock(
    "Topic significance",
    [
      ["Negative impact severity", "mean(scale, scope, irremediability)"],
      ["Positive impact significance", "mean(scale, scope)"],
      ["Potential impact weighting", "x (0.5 + 0.5 x likelihood / 5)   [0.6 to 1.0]"],
      ["Topic score", "max(significance) across the topic's impacts"],
      ["Materiality threshold (disclosed)", fmt(threshold, 2)],
    ],
    "Topic is material when",
    `topic score >= ${fmt(threshold, 2)}`,
  );

  // --- Materiality matrix ---
  const impacts = assessment?.impacts ?? [];
  if (impacts.length > 0) {
    pb.ensureSpace(260);
    pb.heading("Materiality matrix");
    pb.paragraph(
      "Severity (or, for positive impacts, magnitude) against likelihood. Impacts that have already occurred are " +
        "plotted at maximum likelihood. The shaded band is at or above the disclosed materiality threshold.",
      { size: 9 },
    );

    const points: ScatterPoint[] = impacts.map((impact) => {
      const isNegative = impact.impactType.startsWith("NEGATIVE");
      const attrs = [impact.scale, impact.scope];
      if (isNegative && impact.irremediability != null) attrs.push(impact.irremediability);
      const severity = attrs.reduce((s, v) => s + v, 0) / attrs.length;
      // An actual impact is certain by definition, so it sits at the top of
      // the likelihood axis rather than being left unplotted.
      const likelihood = impact.impactType.endsWith("_ACTUAL") ? 5 : (impact.likelihood ?? 5);
      const topic = getGriTopic(impact.topicCode);
      return {
        x: likelihood,
        y: severity,
        label: topic?.label ?? impact.topicCode,
        color: isNegative ? CHART_RED : TEAL,
      };
    });

    pb.y = scatterMatrix(pb.doc, {
      x: MARGIN_X,
      y: pb.y,
      width: CONTENT_WIDTH,
      height: 220,
      points,
      xLabel: "Likelihood  (1 = remote, 5 = certain / already occurred)",
      yLabel: "Severity / magnitude",
      thresholdY: threshold,
      thresholdLabel: `Materiality threshold — ${fmt(threshold, 2)}`,
    });

    pb.note("Red markers are negative impacts; teal markers are positive impacts.");

    // The matrix shows where impacts sit; this table says what they actually
    // are. GRI 3-1 requires the impacts themselves to be reported, not only
    // the topic scores they produce, and an assurance provider has to be able
    // to reproduce the ranking from the attributes printed here.
    pb.heading("Identified impacts");
    pb.table({
      columns: [
        // Type and Value chain are sized to fit their longest possible values
        // ("Negative, potential" and "Own operations") without ellipsis — the
        // categorical columns must stay readable, so Impact absorbs the
        // remaining width and truncates instead.
        { header: "Topic", width: 55 },
        { header: "Impact", width: 200 },
        { header: "Type", width: 88 },
        { header: "Value chain", width: 74 },
        { header: "Score", width: 34, align: "right" },
        { header: "Attrs", width: 44, align: "right" },
      ],
      rows: impacts
        .slice()
        .sort((a, b) => b.significanceScore - a.significanceScore)
        .map((impact) => {
          const topic = getGriTopic(impact.topicCode);
          // Compact attribute trace — scale/scope/irremediability/likelihood,
          // with a dash where an attribute doesn't apply to this impact type.
          const attrs = [
            impact.scale,
            impact.scope,
            impact.irremediability ?? "-",
            impact.likelihood ?? "-",
          ].join("/");
          return [
            topic?.label ?? impact.topicCode,
            impact.description,
            IMPACT_TYPE_LABEL[impact.impactType] ?? impact.impactType,
            VALUE_CHAIN_LABEL[impact.valueChainLocation] ?? impact.valueChainLocation,
            fmt(impact.significanceScore, 2),
            attrs,
          ];
        }),
    });
    pb.note(
      "Attributes are shown as scale/scope/irremediability/likelihood. Irremediability applies to negative impacts " +
        "only and likelihood to potential impacts only; a dash means the attribute does not apply to that impact.",
    );
  }

  // --- 3-2 List of material topics ---
  pb.heading("3-2 List of material topics");
  const ranked = report.materialTopics
    .filter((t) => t.isMaterial)
    .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));

  if (ranked.length === 0) {
    pb.paragraph(
      "No topic reached the disclosed materiality threshold for this reporting period. GRI 3-2 requires at least " +
        "one material topic, so this report cannot claim to be in accordance with the GRI Standards.",
    );
  } else {
    pb.table({
      columns: [
        { header: "Rank", width: 40, align: "right" },
        { header: "Standard", width: 75 },
        { header: "Material topic", width: 250 },
        { header: "Significance", width: 130, align: "right" },
      ],
      rows: ranked.map((topic) => {
        const standard = getGriTopic(topic.topicCode);
        return [
          String(topic.rank ?? "-"),
          standard?.label ?? topic.topicCode,
          standard?.title ?? topic.topicCode,
          topic.significanceScore != null ? fmt(topic.significanceScore, 2) : NOT_DISCLOSED,
        ];
      }),
    });
  }

  // --- Topics assessed and excluded ---
  const excluded = report.materialTopics.filter((t) => !t.isMaterial);
  if (excluded.length > 0) {
    pb.heading("Topics assessed and determined not material");
    pb.paragraph(
      "GRI requires the report to be explicit about what was assessed and excluded, rather than silently omitting " +
        "it. Each topic below was considered during the materiality assessment and did not reach the threshold.",
      { size: 9 },
    );
    pb.table({
      columns: [
        { header: "Standard", width: 75 },
        { header: "Topic", width: 150 },
        { header: "Rationale for exclusion", width: 270 },
      ],
      rows: excluded
        .sort((a, b) => a.topicCode.localeCompare(b.topicCode))
        .map((topic) => {
          const standard = getGriTopic(topic.topicCode);
          return [
            standard?.label ?? topic.topicCode,
            standard?.title ?? topic.topicCode,
            topic.notMaterialRationale ?? "No rationale stated.",
          ];
        }),
    });
  }

  return pageIndex;
}

// ---------------------------------------------------------------------------
// Topic Standard sections
// ---------------------------------------------------------------------------

/** GRI 3-3, restated under each material topic as GRI's own content index format expects. */
function buildManagementApproach(pb: PageBuilder, record: GriMaterialTopic) {
  pb.heading("3-3 Management of material topics");
  for (const requirement of GRI_3_3_REQUIREMENTS) {
    const value = (record as unknown as Record<string, unknown>)[requirement.field] as string | null;
    pb.ensureSpace(30);
    pb.doc.fillColor(TEAL_DARK).font("Helvetica-Bold").fontSize(9).text(requirement.label, MARGIN_X, pb.y);
    pb.y += 13;
    pb.paragraph(fmtText(value), { size: 9.5 });
  }
}

function buildTopicSection(
  pb: PageBuilder,
  section: number,
  standard: GriTopicStandard,
  record: GriMaterialTopic,
  report: GriReportWithRelations,
  metrics: GriMetrics,
  phase2: ReportPhase2Data | undefined,
): number {
  const pageIndex = pb.startSection(section, `${standard.label} — ${standard.title}`);

  pb.paragraph(standard.edition, { bold: true, size: 9 });
  if (record.significanceScore != null) {
    pb.note(
      `Determined material in this reporting period with an impact significance of ${fmt(record.significanceScore, 2)} (rank ${record.rank ?? "-"}).`,
    );
  }

  buildManagementApproach(pb, record);
  renderTopicDisclosures(pb, standard, report, metrics, phase2);

  return pageIndex;
}

/** Per-topic disclosure rendering. Each branch prints only what the topic actually has — no placeholder padding. */
function renderTopicDisclosures(
  pb: PageBuilder,
  standard: GriTopicStandard,
  report: GriReportWithRelations,
  metrics: GriMetrics,
  phase2: ReportPhase2Data | undefined,
) {
  switch (standard.code) {
    case "GRI_301":
      return renderMaterials(pb, report);
    case "GRI_302":
      return renderEnergy(pb, report, metrics, phase2);
    case "GRI_303":
      return renderWater(pb, report, metrics);
    case "GRI_101":
      return renderBiodiversity(pb, report);
    case "GRI_305":
      return renderEmissions(pb, report, metrics);
    case "GRI_306":
      return renderWaste(pb, report, metrics, phase2);
    case "GRI_308":
      return renderSupplierAssessment(pb, report.supplierEnvDisclosure, "environmental", "308", phase2, true);
    case "GRI_401":
      return renderEmployment(pb, report);
    case "GRI_403":
      return renderOhs(pb, report, metrics);
    case "GRI_404":
      return renderTraining(pb, report);
    case "GRI_405":
      return renderDiversity(pb, report);
    case "GRI_406":
      return renderNonDiscrimination(pb, report);
    case "GRI_413":
      return renderLocalCommunities(pb, report);
    case "GRI_414":
      // 414 carries the register only where 308 was not assessed material, so
      // it prints exactly once whichever of the two topics the organization
      // reports.
      return renderSupplierAssessment(
        pb,
        report.supplierSocialDisclosure,
        "social",
        "414",
        phase2,
        report.materialTopics.find((t) => t.topicCode === "GRI_308")?.isMaterial !== true,
      );
    case "GRI_416":
      return renderCustomerHs(pb, report);
    case "GRI_418":
      return renderCustomerPrivacy(pb, report);
    default:
      return undefined;
  }
}

function renderMaterials(pb: PageBuilder, report: GriReportWithRelations) {
  const d = report.materialsDisclosure;
  pb.heading("301-1 Materials used by weight or volume");
  pb.table({
    columns: [
      { header: "Material category", width: 320 },
      { header: "Weight", width: 175, align: "right" },
    ],
    rows: [
      ["Renewable materials used", fmtNum(d?.renewableMaterialsTonnes, "t")],
      ["Non-renewable materials used", fmtNum(d?.nonRenewableMaterialsTonnes, "t")],
    ],
  });
  if (d?.materialsMethodology) pb.note(`Methodology: ${d.materialsMethodology}`);

  if (d?.renewableMaterialsTonnes != null && d?.nonRenewableMaterialsTonnes != null) {
    const total = d.renewableMaterialsTonnes + d.nonRenewableMaterialsTonnes;
    if (total > 0) {
      pb.ensureSpace(190);
      pb.y = donutChart(pb.doc, {
        x: MARGIN_X,
        y: pb.y,
        diameter: 120,
        unit: "t",
        centerLabel: "Total",
        segments: [
          { label: "Renewable", value: d.renewableMaterialsTonnes, color: TEAL },
          { label: "Non-renewable", value: d.nonRenewableMaterialsTonnes, color: CHART_SLATE },
        ],
      });
    }
  }

  pb.heading("301-2 / 301-3 Recycled inputs and reclaimed products");
  pb.table({
    columns: [
      { header: "Metric", width: 320 },
      { header: "Value", width: 175, align: "right" },
    ],
    rows: [
      ["Recycled input materials used", fmtPct(d?.recycledInputPct)],
      ["Reclaimed products and packaging", fmtPct(d?.reclaimedProductsPct)],
    ],
  });
  if (d?.reclaimedByCategory) pb.paragraph(d.reclaimedByCategory);
}

function renderEnergy(
  pb: PageBuilder,
  report: GriReportWithRelations,
  metrics: GriMetrics,
  phase2: ReportPhase2Data | undefined,
) {
  const d = report.energyDisclosure;

  pb.heading("302-1 Energy consumption within the organization");
  pb.paragraph(
    "Electricity and imported steam are reused directly from this facility's submitted activity data. Fuel energy " +
      "is a manual disclosure: the platform's fuel library carries emission factors but not calorific values, so " +
      "fuel consumption in GJ cannot be derived from the same records.",
    { size: 9 },
  );
  pb.table({
    columns: [
      { header: "Energy source", width: 300 },
      { header: "Consumption", width: 195, align: "right" },
    ],
    rows: [
      ["Non-renewable fuel consumed", fmtNum(d?.nonRenewableFuelGj, "GJ")],
      ["Renewable fuel consumed", fmtNum(d?.renewableFuelGj, "GJ")],
      ["Electricity consumed", fmtNum(d?.electricityConsumedGj, "GJ")],
      ["Heating consumed", fmtNum(d?.heatingConsumedGj, "GJ")],
      ["Cooling consumed", fmtNum(d?.coolingConsumedGj, "GJ")],
      ["Steam consumed", fmtNum(d?.steamConsumedGj, "GJ")],
      ["Electricity sold", fmtNum(d?.electricitySoldGj, "GJ")],
      ["Electricity and steam from activity data (derived)", fmtNum(metrics.ghg.electricityAndSteamEnergyGj, "GJ")],
    ],
  });
  if (d?.energyStandardsUsed) pb.note(`Standards, methodologies and assumptions: ${d.energyStandardsUsed}`);

  if (metrics.ghg.electricityAndSteamEnergyGj > 0) {
    const renewable = metrics.ghg.renewableElectricityGj;
    const nonRenewable = Math.max(0, metrics.ghg.electricityAndSteamEnergyGj - renewable);
    pb.ensureSpace(190);
    pb.heading("Electricity and steam composition (derived)");
    pb.y = donutChart(pb.doc, {
      x: MARGIN_X,
      y: pb.y,
      diameter: 120,
      unit: "GJ",
      centerLabel: "Total",
      segments: [
        { label: "Renewable electricity", value: renewable, color: TEAL },
        { label: "Grid electricity and steam", value: nonRenewable, color: CHART_SLATE },
      ],
    });
  }

  // The multi-period renewable share, and the certificates behind any
  // market-based claim. Neither is a GRI 302 disclosure in its own right: 302-1
  // asks for this period's consumption by source, which the table above gives.
  // These answer the question a reader of that table asks next — whether the
  // share is moving, and whether the renewable share is generated or purchased
  // as an attribute — and are labelled as supplementary so neither is mistaken
  // for a required disclosure.
  if (phase2) {
    pb.heading("Renewable share over time (supplementary)");
    drawEnergyMixBlock(pb, phase2.energyMix);

    pb.heading("Renewable energy certificates (supplementary)");
    pb.paragraph(
      "GRI 302-1 reports energy consumed by source. Certificates are a separate market-based claim over that " +
        "consumption and are reported here rather than added to the figures above, so nothing is counted twice.",
      { size: 9 },
    );
    drawRecCoverageBlock(pb, phase2.recCoverage);
  }

  pb.heading("302-2 / 302-3 Energy outside the organization, and energy intensity");
  pb.table({
    columns: [
      { header: "Metric", width: 320 },
      { header: "Value", width: 175, align: "right" },
    ],
    rows: [
      ["Energy consumed outside the organization", fmtNum(d?.energyOutsideOrgGj, "GJ")],
      [
        "Energy intensity per tonne of product (derived)",
        metrics.intensity.energyPerTonneProduct != null
          ? `${fmt(metrics.intensity.energyPerTonneProduct, 4)} GJ/t`
          : "Not calculable",
      ],
      [
        "Energy intensity per rupee of turnover (derived)",
        metrics.intensity.energyPerRupeeTurnover != null
          ? `${fmt(metrics.intensity.energyPerRupeeTurnover, 8)} GJ/Rs.`
          : "Not calculable",
      ],
      ["Intensity ratio includes energy outside the organization", fmtBool(d?.intensityIncludesOutsideOrg)],
    ],
  });
  if (d?.intensityDenominatorDescription) pb.note(`Denominator: ${d.intensityDenominatorDescription}`);

  pb.heading("302-4 / 302-5 Reductions");
  pb.table({
    columns: [
      { header: "Metric", width: 320 },
      { header: "Value", width: 175, align: "right" },
    ],
    rows: [
      ["Reduction in energy consumption", fmtNum(d?.energyReductionGj, "GJ")],
      ["Base year for the reduction", d?.energyReductionBaseYear != null ? String(d.energyReductionBaseYear) : NOT_DISCLOSED],
      ["Reduction in energy requirements of products and services", fmtNum(d?.productEnergyReductionGj, "GJ")],
    ],
  });
  if (d?.energyReductionBasis) pb.paragraph(d.energyReductionBasis);
  if (d?.productEnergyReductionBasis) pb.paragraph(d.productEnergyReductionBasis);
}

function renderWater(pb: PageBuilder, report: GriReportWithRelations, metrics: GriMetrics) {
  const d = report.waterDisclosure;

  pb.heading("303-1 Interactions with water as a shared resource");
  pb.paragraph(fmtText(d?.interactionsNarrative));
  if (d?.waterStressAssessmentTool) {
    pb.note(`Water stress assessed using: ${d.waterStressAssessmentTool}`);
  }

  pb.heading("303-2 Management of water discharge-related impacts");
  pb.paragraph(fmtText(d?.dischargeImpactManagement));
  if (d?.minimumEffluentStandards) {
    pb.paragraph(`Minimum standards set for effluent quality: ${d.minimumEffluentStandards}`);
  }

  pb.heading("303-3 to 303-5 Withdrawal, discharge and consumption");
  pb.paragraph(
    "Totals below are reused from this facility's ISO 14046 water inventory for the reporting period, converted " +
      "from cubic metres to megalitres. Consumption is derived as withdrawal minus discharge and is never stored " +
      "separately, so the three figures always reconcile. The water-stressed split is a manual disclosure — no " +
      "water-stress dataset is wired into the platform.",
    { size: 9 },
  );

  const derived = metrics.water;
  pb.table({
    columns: [
      { header: "Metric", width: 250 },
      { header: "All areas", width: 122, align: "right" },
      { header: "Water-stressed areas", width: 123, align: "right" },
    ],
    rows: [
      [
        "Water withdrawal",
        fmtNum(d?.withdrawalTotalMl ?? (derived.hasData ? derived.withdrawalTotalMl : null), "ML", 3),
        fmtNum(d?.withdrawalWaterStressedMl, "ML", 3),
      ],
      [
        "Water discharge",
        fmtNum(d?.dischargeTotalMl ?? (derived.hasData ? derived.dischargeTotalMl : null), "ML", 3),
        fmtNum(d?.dischargeWaterStressedMl, "ML", 3),
      ],
      [
        "Water consumption",
        fmtNum(d?.consumptionTotalMl ?? (derived.hasData ? derived.consumptionTotalMl : null), "ML", 3),
        fmtNum(d?.consumptionWaterStressedMl, "ML", 3),
      ],
      [
        "Freshwater withdrawal",
        fmtNum(d?.withdrawalFreshwaterMl ?? (derived.hasData ? derived.withdrawalFreshwaterMl : null), "ML", 3),
        "—",
      ],
      ["Change in water storage", fmtNum(d?.storageChangeMl, "ML", 3), "—"],
    ],
  });

  if (derived.hasData) {
    pb.ensureSpace(130);
    pb.y = horizontalGroupedBars(pb.doc, {
      x: MARGIN_X,
      y: pb.y,
      width: CONTENT_WIDTH,
      data: [
        { label: "Withdrawal", value: derived.withdrawalTotalMl, unit: "ML", color: CHART_BLUE },
        { label: "Discharge", value: derived.dischargeTotalMl, unit: "ML", color: CHART_SLATE },
        { label: "Consumption", value: derived.consumptionTotalMl, unit: "ML", color: TEAL },
      ],
    });
    pb.note(
      `Derived from ${derived.entriesWithWater} activity data ${derived.entriesWithWater === 1 ? "entry" : "entries"} carrying a water inventory for ${metrics.fyWindow.label}.`,
    );
  }

  if (d?.prioritySubstancesOfConcern) {
    pb.heading("Priority substances of concern in discharge");
    pb.paragraph(d.prioritySubstancesOfConcern);
  }
}

function renderBiodiversity(pb: PageBuilder, report: GriReportWithRelations) {
  const d = report.biodiversityDisclosure;

  pb.paragraph(
    "GRI 101: Biodiversity 2024 replaced GRI 304: Biodiversity 2016 and is required for all biodiversity reporting " +
      "published on or after 1 January 2026. It is structured around the direct drivers of biodiversity loss rather " +
      "than protected-area proximity alone.",
    { size: 9 },
  );

  pb.heading("101-1 Policies to halt and reverse biodiversity loss");
  pb.paragraph(fmtText(d?.policiesNarrative));

  pb.heading("101-2 Management of biodiversity impacts");
  pb.paragraph(fmtText(d?.mitigationHierarchy));
  pb.keyValueRow("Land restored during the reporting period", fmtNum(d?.landRestoredHa, "ha"));

  pb.heading("101-3 Access and benefit-sharing");
  pb.paragraph(fmtText(d?.accessBenefitSharing));

  pb.heading("101-4 Identification of biodiversity impacts");
  pb.paragraph(fmtText(d?.impactIdentificationProcess));

  pb.heading("101-5 Locations with biodiversity impacts");
  pb.table({
    columns: [
      { header: "Metric", width: 320 },
      { header: "Value", width: 175, align: "right" },
    ],
    rows: [
      ["Sites with biodiversity impacts", fmtCount(d?.sitesTotalCount)],
      ["Sites in or adjacent to protected areas", fmtCount(d?.sitesInProtectedAreasCount)],
      ["Sites near areas of high biodiversity value", fmtCount(d?.sitesNearProtectedAreasCount)],
    ],
  });
  if (d?.siteLocationsDescription) pb.paragraph(d.siteLocationsDescription);

  pb.heading("101-6 Direct drivers of biodiversity loss");
  const drivers: [string, string | null | undefined][] = [
    ["Land and sea use change", d?.driverLandUseChange],
    ["Resource exploitation", d?.driverResourceExploitation],
    ["Climate change", d?.driverClimateChange],
    ["Pollution", d?.driverPollution],
    ["Invasive alien species", d?.driverInvasiveSpecies],
  ];
  for (const [label, value] of drivers) {
    pb.ensureSpace(28);
    pb.doc.fillColor(TEAL_DARK).font("Helvetica-Bold").fontSize(9).text(label, MARGIN_X, pb.y);
    pb.y += 13;
    pb.paragraph(fmtText(value), { size: 9.5 });
  }
  pb.keyValueRow("Land converted during the reporting period", fmtNum(d?.landUseChangeHa, "ha"));

  pb.heading("101-7 Changes to the state of biodiversity");
  pb.paragraph(fmtText(d?.stateOfBiodiversityChanges));

  pb.heading("101-8 Ecosystem services");
  pb.paragraph(fmtText(d?.ecosystemServicesAffected));
}

function renderEmissions(pb: PageBuilder, report: GriReportWithRelations, metrics: GriMetrics) {
  const d = report.emissionsDisclosure;
  const ghg = metrics.ghg;

  pb.paragraph(
    "Scope 1 and Scope 2 (location-based) figures are reused directly from this facility's existing activity data " +
      "on the IPCC AR5 (100-year) Global Warming Potential basis, which is the GHG Protocol convention GRI 305 " +
      "follows — deliberately distinct from the AR2/BUR3 basis used for India's domestic BRSR and CCTS reporting on " +
      "the same underlying records. Scope 3 is rolled up from submitted value-chain entries for the same period.",
    { size: 9 },
  );

  pb.heading("305-1 to 305-3 GHG emissions by scope");
  pb.summaryBox(
    "GHG Emissions",
    [
      ["Scope 1 — direct (AR5)", fmtCo2e(ghg.scope1Co2e)],
      ["Scope 2 — energy indirect, location-based", fmtCo2e(ghg.scope2LocationBasedCo2e)],
      ["Scope 2 — energy indirect, market-based", fmtCo2e(d?.scope2MarketBasedTco2e)],
      ["Scope 3 — other indirect", fmtCo2e(ghg.scope3Co2e)],
      ["Biogenic CO2 emissions", fmtNum(d?.biogenicCo2Tonnes, "t CO2")],
    ],
    { tone: "teal" },
  );
  pb.note(
    `Scope 1 and 2 rolled up from ${ghg.activityDataCount} submitted activity data ${ghg.activityDataCount === 1 ? "entry" : "entries"}; Scope 3 from ${ghg.scope3CategoryCount} value-chain ${ghg.scope3CategoryCount === 1 ? "category" : "categories"} for ${metrics.fyWindow.label}.`,
  );

  const segments = [
    { label: "Scope 1", value: ghg.scope1Co2e, color: TEAL },
    { label: "Scope 2 (location-based)", value: ghg.scope2LocationBasedCo2e, color: CHART_SLATE },
  ];
  if (ghg.scope3Co2e != null && ghg.scope3Co2e > 0) {
    segments.push({ label: "Scope 3", value: ghg.scope3Co2e, color: CHART_BLUE });
  }
  if (segments.reduce((s, seg) => s + seg.value, 0) > 0) {
    pb.ensureSpace(190);
    pb.y = donutChart(pb.doc, {
      x: MARGIN_X,
      y: pb.y,
      diameter: 120,
      unit: "tCO2e",
      centerLabel: "Total",
      segments,
    });
  }

  pb.heading("305-4 GHG emissions intensity");
  pb.table({
    columns: [
      { header: "Metric", width: 320 },
      { header: "Value", width: 175, align: "right" },
    ],
    rows: [
      [
        "Emissions intensity per tonne of product",
        metrics.intensity.emissionsPerTonneProduct != null
          ? `${fmt(metrics.intensity.emissionsPerTonneProduct, 4)} tCO2e/t`
          : "Not calculable",
      ],
      [
        "Emissions intensity per rupee of turnover",
        metrics.intensity.emissionsPerRupeeTurnover != null
          ? `${fmt(metrics.intensity.emissionsPerRupeeTurnover, 8)} tCO2e/Rs.`
          : "Not calculable",
      ],
      ["Gases included in the intensity ratio", d?.intensityGasesIncluded || NOT_DISCLOSED],
    ],
  });
  if (d?.intensityDenominatorDescription) pb.note(`Denominator: ${d.intensityDenominatorDescription}`);

  pb.heading("305-5 Reduction of GHG emissions");
  pb.table({
    columns: [
      { header: "Metric", width: 320 },
      { header: "Value", width: 175, align: "right" },
    ],
    rows: [
      ["Base year", d?.baseYear != null ? String(d.baseYear) : NOT_DISCLOSED],
      ["Base year emissions", fmtCo2e(d?.baseYearEmissionsTco2e)],
      ["Reduction achieved", fmtCo2e(d?.reductionTco2e)],
      ["Scopes included in the reduction", d?.reductionScopesIncluded || NOT_DISCLOSED],
      ["Consolidation approach", d?.consolidationApproach || NOT_DISCLOSED],
      ["Gases included", d?.gasesIncluded || NOT_DISCLOSED],
    ],
  });
  if (d?.emissionsStandardsUsed) pb.note(`Standards, methodologies and assumptions: ${d.emissionsStandardsUsed}`);

  pb.heading("305-6 / 305-7 Ozone-depleting substances and other air emissions");
  pb.table({
    columns: [
      { header: "Substance", width: 320 },
      { header: "Emissions", width: 175, align: "right" },
    ],
    rows: [
      ["Ozone-depleting substances (CFC-11 equivalent)", fmtNum(d?.odsCfc11EquivalentTonnes, "t")],
      ["Nitrogen oxides (NOx)", fmtNum(d?.noxTonnes, "t")],
      ["Sulfur oxides (SOx)", fmtNum(d?.soxTonnes, "t")],
      ["Volatile organic compounds (VOC)", fmtNum(d?.vocTonnes, "t")],
      ["Particulate matter (PM)", fmtNum(d?.particulateMatterTonnes, "t")],
      ["Persistent organic pollutants (POP)", fmtNum(d?.persistentOrganicPollutantsTonnes, "t")],
      ["Hazardous air pollutants (HAP)", fmtNum(d?.hazardousAirPollutantsTonnes, "t")],
    ],
  });
  if (d?.odsSubstancesIncluded) pb.note(`ODS included: ${d.odsSubstancesIncluded}`);
}

function renderWaste(
  pb: PageBuilder,
  report: GriReportWithRelations,
  metrics: GriMetrics,
  phase2: ReportPhase2Data | undefined,
) {
  const d = report.wasteDisclosure;
  const totals = metrics.waste;

  pb.heading("306-1 / 306-2 Waste generation and management");
  pb.paragraph(fmtText(d?.wasteImpactsNarrative));
  pb.paragraph(fmtText(d?.wasteManagementNarrative));
  if (d?.thirdPartyWasteManagement) {
    pb.paragraph(`Third-party waste management: ${d.thirdPartyWasteManagement}`);
  }

  pb.heading("306-3 Waste generated");
  pb.paragraph(
    "Waste generated is the sum of waste diverted from disposal (306-4) and waste directed to disposal (306-5). It " +
      "is derived rather than entered separately, so the three disclosures always reconcile.",
    { size: 9 },
  );
  pb.summaryBox(
    "Waste Totals",
    [
      ["Total waste generated", fmtNum(totals.totalGeneratedT, "t", 3)],
      ["Diverted from disposal", fmtNum(totals.totalDivertedT, "t", 3)],
      ["Directed to disposal", fmtNum(totals.totalDisposalT, "t", 3)],
      ["Diversion rate", fmtPct(totals.diversionRatePct)],
    ],
    { tone: "teal" },
  );
  if (d?.wasteCompositionDescription) pb.paragraph(d.wasteCompositionDescription);

  if (totals.hasData && totals.totalGeneratedT > 0) {
    pb.ensureSpace(190);
    pb.y = donutChart(pb.doc, {
      x: MARGIN_X,
      y: pb.y,
      diameter: 120,
      unit: "t",
      centerLabel: "Generated",
      segments: [
        { label: "Diverted from disposal", value: totals.totalDivertedT, color: TEAL },
        { label: "Directed to disposal", value: totals.totalDisposalT, color: CHART_AMBER },
      ],
    });
  }

  pb.heading("306-4 Waste diverted from disposal");
  pb.table({
    columns: [
      { header: "Recovery operation", width: 245 },
      { header: "Hazardous", width: 125, align: "right" },
      { header: "Non-hazardous", width: 125, align: "right" },
    ],
    rows: [
      ["Preparation for reuse", fmtNum(d?.hazardousDivertedReuseT, "t", 3), fmtNum(d?.nonHazardousDivertedReuseT, "t", 3)],
      ["Recycling", fmtNum(d?.hazardousDivertedRecyclingT, "t", 3), fmtNum(d?.nonHazardousDivertedRecyclingT, "t", 3)],
      [
        "Other recovery operations",
        fmtNum(d?.hazardousDivertedOtherRecoveryT, "t", 3),
        fmtNum(d?.nonHazardousDivertedOtherRecoveryT, "t", 3),
      ],
      ["Total diverted", fmtNum(totals.hazardousDivertedT, "t", 3), fmtNum(totals.nonHazardousDivertedT, "t", 3)],
    ],
    highlightRowIndex: 3,
  });

  pb.heading("306-5 Waste directed to disposal");
  pb.table({
    columns: [
      { header: "Disposal operation", width: 245 },
      { header: "Hazardous", width: 125, align: "right" },
      { header: "Non-hazardous", width: 125, align: "right" },
    ],
    rows: [
      [
        "Incineration with energy recovery",
        fmtNum(d?.hazardousDisposalIncinerationWithRecoveryT, "t", 3),
        fmtNum(d?.nonHazardousDisposalIncinerationWithRecoveryT, "t", 3),
      ],
      [
        "Incineration without energy recovery",
        fmtNum(d?.hazardousDisposalIncinerationNoRecoveryT, "t", 3),
        fmtNum(d?.nonHazardousDisposalIncinerationNoRecoveryT, "t", 3),
      ],
      ["Landfilling", fmtNum(d?.hazardousDisposalLandfillT, "t", 3), fmtNum(d?.nonHazardousDisposalLandfillT, "t", 3)],
      ["Other disposal operations", fmtNum(d?.hazardousDisposalOtherT, "t", 3), fmtNum(d?.nonHazardousDisposalOtherT, "t", 3)],
      ["Total directed to disposal", fmtNum(totals.hazardousDisposalT, "t", 3), fmtNum(totals.nonHazardousDisposalT, "t", 3)],
    ],
    highlightRowIndex: 4,
  });

  if (d?.onsiteOffsiteBreakdown) {
    pb.heading("Onsite and offsite breakdown");
    pb.paragraph(d.onsiteOffsiteBreakdown);
  }

  // The circularity rate the 306-4/306-5 tonnages above imply, with the
  // definition behind it. Reported as supplementary because GRI asks for the
  // tonnages, not a rate — but a reader comparing periods or facilities wants
  // the rate, and deriving it by hand from two tables invites arithmetic
  // nobody checks.
  if (phase2) {
    pb.heading("Circularity rate (supplementary)");
    drawCircularityBlock(pb, phase2.circularity);
  }
}

type SupplierRow = {
  newSuppliersScreenedPct: number | null;
  newSuppliersTotalCount: number | null;
  screeningCriteria: string | null;
  suppliersAssessedCount: number | null;
  suppliersWithNegativeImpactsCount: number | null;
  suppliersWithImprovementsAgreedCount: number | null;
  suppliersTerminatedCount: number | null;
  negativeImpactsDescription: string | null;
} | null;

/** GRI 308 and GRI 414 are structurally identical — one renderer, parameterised by which criteria set applies. */
function renderSupplierAssessment(
  pb: PageBuilder,
  d: SupplierRow,
  criteria: string,
  prefix: string,
  phase2: ReportPhase2Data | undefined,
  /** Whether this topic section is the one that prints the supplier register. */
  ownsSupplierRegister: boolean,
) {
  pb.heading(`${prefix}-1 New suppliers screened using ${criteria} criteria`);
  pb.table({
    columns: [
      { header: "Metric", width: 320 },
      { header: "Value", width: 175, align: "right" },
    ],
    rows: [
      [`New suppliers screened using ${criteria} criteria`, fmtPct(d?.newSuppliersScreenedPct)],
      ["Total new suppliers engaged in the period", fmtCount(d?.newSuppliersTotalCount)],
    ],
  });
  if (d?.screeningCriteria) pb.note(`Screening criteria applied: ${d.screeningCriteria}`);

  pb.heading(`${prefix}-2 Negative ${criteria} impacts in the supply chain and actions taken`);
  pb.table({
    columns: [
      { header: "Metric", width: 320 },
      { header: "Value", width: 175, align: "right" },
    ],
    rows: [
      [`Suppliers assessed for ${criteria} impacts`, fmtCount(d?.suppliersAssessedCount)],
      ["Suppliers identified as having significant actual or potential negative impacts", fmtCount(d?.suppliersWithNegativeImpactsCount)],
      ["Suppliers with which improvements were agreed", fmtCount(d?.suppliersWithImprovementsAgreedCount)],
      ["Suppliers with which relationships were terminated", fmtCount(d?.suppliersTerminatedCount)],
    ],
  });
  pb.paragraph(fmtText(d?.negativeImpactsDescription));

  // The named-supplier register, which answers a different question from the
  // screening percentages above. GRI 308-1/414-1 report the share of *new*
  // suppliers screened in the period; this reports which suppliers the
  // organization has actually listed, what disclosure is on file for each, and
  // how many high-risk ones have none. The block states in its own words that
  // coverage is of the listed suppliers rather than the whole supply base.
  //
  // Printed once. GRI 308 and 414 share this renderer and are frequently both
  // material, and there is one supplier register, not an environmental one and
  // a social one — so 414 cross-references 308 rather than repeating it.
  if (phase2) {
    if (ownsSupplierRegister) {
      pb.heading("Supplier register and disclosure coverage (supplementary)");
      drawSupplierScorecardBlock(pb, phase2.suppliers);
    } else {
      pb.note(
        "The supplier register and its disclosure coverage are reported once, under GRI 308 Supplier Environmental " +
          "Assessment. The same register covers social criteria; it is not repeated here.",
      );
    }
  }
}

function renderEmployment(pb: PageBuilder, report: GriReportWithRelations) {
  const d = report.employmentDisclosure;

  pb.heading("401-1 New employee hires and employee turnover");
  pb.table({
    columns: [
      { header: "Breakdown", width: 245 },
      { header: "New hires", width: 125, align: "right" },
      { header: "Turnover", width: 125, align: "right" },
    ],
    rows: [
      ["Total", fmtCount(d?.newHiresTotal), fmtCount(d?.turnoverTotal)],
      ["Female", fmtCount(d?.newHiresFemale), fmtCount(d?.turnoverFemale)],
      ["Under 30 years", fmtCount(d?.newHiresUnder30), fmtCount(d?.turnoverUnder30)],
      ["30 to 50 years", fmtCount(d?.newHires30To50), fmtCount(d?.turnover30To50)],
      ["Over 50 years", fmtCount(d?.newHiresOver50), fmtCount(d?.turnoverOver50)],
    ],
  });
  if (d?.hiresTurnoverRegionalBreakdown) pb.note(`Regional breakdown: ${d.hiresTurnoverRegionalBreakdown}`);

  if (d?.newHiresTotal != null || d?.turnoverTotal != null) {
    pb.ensureSpace(180);
    pb.y = verticalBarChart(pb.doc, {
      x: MARGIN_X,
      y: pb.y,
      width: 240,
      height: 110,
      unit: "people",
      data: [
        { label: "New hires", value: d?.newHiresTotal ?? 0, color: TEAL },
        { label: "Turnover", value: d?.turnoverTotal ?? 0, color: CHART_AMBER },
      ],
    });
  }

  pb.heading("401-2 Benefits provided to full-time employees");
  pb.paragraph(fmtText(d?.benefitsDescription));

  pb.heading("401-3 Parental leave");
  pb.table({
    columns: [
      { header: "Metric", width: 245 },
      { header: "Male", width: 125, align: "right" },
      { header: "Female", width: 125, align: "right" },
    ],
    rows: [
      ["Entitled to parental leave", fmtCount(d?.parentalLeaveEntitledMale), fmtCount(d?.parentalLeaveEntitledFemale)],
      ["Took parental leave", fmtCount(d?.parentalLeaveTookMale), fmtCount(d?.parentalLeaveTookFemale)],
      ["Returned to work after leave", fmtCount(d?.parentalLeaveReturnedMale), fmtCount(d?.parentalLeaveReturnedFemale)],
      [
        "Still employed 12 months after returning",
        fmtCount(d?.parentalLeaveRetainedMale),
        fmtCount(d?.parentalLeaveRetainedFemale),
      ],
    ],
  });
}

function renderOhs(pb: PageBuilder, report: GriReportWithRelations, metrics: GriMetrics) {
  const d = report.ohsDisclosure;
  const rates = metrics.safety;

  pb.heading("403-1 Occupational health and safety management system");
  pb.keyValueRow("Certified to ISO 45001", fmtBool(d?.managementSystemIsIso45001));
  pb.paragraph(fmtText(d?.managementSystemDescription));

  const narratives: [string, string | null | undefined][] = [
    ["403-2 Hazard identification, risk assessment, and incident investigation", d?.hazardIdentificationProcess],
    ["403-3 Occupational health services", d?.occupationalHealthServices],
    ["403-4 Worker participation, consultation and communication", d?.workerParticipation],
    ["403-5 Worker training on occupational health and safety", d?.workerOhsTraining],
    ["403-6 Promotion of worker health", d?.workerHealthPromotion],
    ["403-7 Prevention and mitigation of impacts linked by business relationships", d?.businessRelationshipOhsImpacts],
  ];
  for (const [label, value] of narratives) {
    pb.heading(label);
    pb.paragraph(fmtText(value));
  }

  pb.heading("403-8 Workers covered by an OHS management system");
  pb.table({
    columns: [
      { header: "Metric", width: 320 },
      { header: "Value", width: 175, align: "right" },
    ],
    rows: [
      ["Workers covered by the system", fmtCount(d?.workersCoveredCount)],
      ["Percentage of all workers covered", fmtPct(d?.workersCoveredPct)],
    ],
  });

  pb.heading("403-9 Work-related injuries");
  pb.table({
    columns: [
      { header: "Metric", width: 245 },
      { header: "Employees", width: 125, align: "right" },
      { header: "Other workers", width: 125, align: "right" },
    ],
    rows: [
      ["Fatalities from work-related injury", fmtCount(d?.fatalitiesEmployees), fmtCount(d?.fatalitiesNonEmployees)],
      [
        "High-consequence work-related injuries",
        fmtCount(d?.highConsequenceInjuriesEmployees),
        fmtCount(d?.highConsequenceInjuriesNonEmployees),
      ],
      [
        "Recordable work-related injuries",
        fmtCount(d?.recordableInjuriesEmployees),
        fmtCount(d?.recordableInjuriesNonEmployees),
      ],
    ],
  });

  if (rates.hasData) {
    pb.table({
      columns: [
        { header: "Rate", width: 320 },
        { header: `Per ${fmtInt(rates.rateBasisHours)} hours worked`, width: 175, align: "right" },
      ],
      rows: [
        ["Fatality rate", rates.fatalityRate != null ? fmt(rates.fatalityRate, 3) : NOT_DISCLOSED],
        [
          "High-consequence injury rate",
          rates.highConsequenceInjuryRate != null ? fmt(rates.highConsequenceInjuryRate, 3) : NOT_DISCLOSED,
        ],
        [
          "Recordable injury rate",
          rates.recordableInjuryRate != null ? fmt(rates.recordableInjuryRate, 3) : NOT_DISCLOSED,
        ],
      ],
    });
    pb.note(
      `Rates are derived from ${fmt(d?.hoursWorked ?? 0, 0)} hours worked and cover employees and other workers combined. GRI 403-9 permits either a 200,000- or 1,000,000-hour basis; the basis used is stated in the column header.`,
    );
  } else {
    pb.note("Injury rates are not calculable — hours worked was not disclosed for this reporting period.");
  }

  if (d?.mainInjuryTypes) {
    pb.paragraph(`Main types of work-related injury: ${d.mainInjuryTypes}`);
  }

  pb.heading("403-10 Work-related ill health");
  pb.table({
    columns: [
      { header: "Metric", width: 245 },
      { header: "Employees", width: 125, align: "right" },
      { header: "Other workers", width: 125, align: "right" },
    ],
    rows: [
      [
        "Fatalities from work-related ill health",
        fmtCount(d?.illHealthFatalitiesEmployees),
        fmtCount(d?.illHealthFatalitiesNonEmployees),
      ],
      ["Cases of recordable work-related ill health", fmtCount(d?.illHealthCasesEmployees), fmtCount(d?.illHealthCasesNonEmployees)],
    ],
  });
  if (d?.illHealthHazards) pb.paragraph(`Hazards posing a risk of ill health: ${d.illHealthHazards}`);
}

function renderTraining(pb: PageBuilder, report: GriReportWithRelations) {
  const d = report.trainingDisclosure;

  pb.heading("404-1 Average hours of training per year per employee");
  pb.table({
    columns: [
      { header: "Category", width: 320 },
      { header: "Average hours", width: 175, align: "right" },
    ],
    rows: [
      ["All employees", fmtNum(d?.avgTrainingHoursPerEmployee, "hrs", 1)],
      ["Male", fmtNum(d?.avgTrainingHoursMale, "hrs", 1)],
      ["Female", fmtNum(d?.avgTrainingHoursFemale, "hrs", 1)],
      ["Management", fmtNum(d?.avgTrainingHoursManagement, "hrs", 1)],
      ["Non-management", fmtNum(d?.avgTrainingHoursNonManagement, "hrs", 1)],
    ],
  });

  const bars = [
    { label: "Male", value: d?.avgTrainingHoursMale ?? 0, color: CHART_BLUE },
    { label: "Female", value: d?.avgTrainingHoursFemale ?? 0, color: TEAL },
    { label: "Management", value: d?.avgTrainingHoursManagement ?? 0, color: CHART_SLATE },
    { label: "Non-mgmt", value: d?.avgTrainingHoursNonManagement ?? 0, color: CHART_AMBER },
  ];
  if (bars.some((b) => b.value > 0)) {
    pb.ensureSpace(200);
    pb.y = verticalBarChart(pb.doc, {
      x: MARGIN_X,
      y: pb.y,
      width: 320,
      height: 110,
      unit: "hrs",
      data: bars,
    });
  }

  pb.heading("404-2 Programs for upgrading employee skills and transition assistance");
  pb.paragraph(fmtText(d?.skillsProgramsDescription));
  pb.paragraph(fmtText(d?.transitionAssistanceDescription));

  pb.heading("404-3 Employees receiving regular performance and career development reviews");
  pb.table({
    columns: [
      { header: "Category", width: 320 },
      { header: "Percentage", width: 175, align: "right" },
    ],
    rows: [
      ["All employees", fmtPct(d?.performanceReviewPct)],
      ["Male", fmtPct(d?.performanceReviewMalePct)],
      ["Female", fmtPct(d?.performanceReviewFemalePct)],
    ],
  });
}

function renderDiversity(pb: PageBuilder, report: GriReportWithRelations) {
  const d = report.diversityDisclosure;

  pb.heading("405-1 Diversity of governance bodies and employees");
  pb.table({
    columns: [
      { header: "Governance body composition", width: 320 },
      { header: "Count", width: 175, align: "right" },
    ],
    rows: [
      ["Total members", fmtCount(d?.governanceBodyTotal)],
      ["Female members", fmtCount(d?.governanceBodyFemale)],
      ["Under 30 years", fmtCount(d?.governanceBodyUnder30)],
      ["30 to 50 years", fmtCount(d?.governanceBody30To50)],
      ["Over 50 years", fmtCount(d?.governanceBodyOver50)],
    ],
  });

  if (d?.governanceBodyTotal != null && d.governanceBodyTotal > 0 && d.governanceBodyFemale != null) {
    pb.ensureSpace(190);
    pb.y = donutChart(pb.doc, {
      x: MARGIN_X,
      y: pb.y,
      diameter: 120,
      unit: "members",
      centerLabel: "Board",
      segments: [
        { label: "Female", value: d.governanceBodyFemale, color: TEAL },
        { label: "Male", value: Math.max(0, d.governanceBodyTotal - d.governanceBodyFemale), color: CHART_SLATE },
      ],
    });
  }

  pb.table({
    columns: [
      { header: "Employee composition", width: 320 },
      { header: "Percentage", width: 175, align: "right" },
    ],
    rows: [
      ["Female", fmtPct(d?.employeesFemalePct)],
      ["Under 30 years", fmtPct(d?.employeesUnder30Pct)],
      ["30 to 50 years", fmtPct(d?.employees30To50Pct)],
      ["Over 50 years", fmtPct(d?.employeesOver50Pct)],
    ],
  });
  if (d?.otherDiversityIndicators) pb.paragraph(d.otherDiversityIndicators);

  pb.heading("405-2 Ratio of basic salary and remuneration of women to men");
  pb.paragraph("A ratio of 1.00 indicates parity; a ratio below 1.00 indicates women are paid less than men.", {
    size: 9,
  });
  pb.table({
    columns: [
      { header: "Employee category", width: 320 },
      { header: "Women : men", width: 175, align: "right" },
    ],
    rows: [
      ["All employees", d?.salaryRatioOverall != null ? `${fmt(d.salaryRatioOverall, 2)} : 1` : NOT_DISCLOSED],
      ["Management", d?.salaryRatioManagement != null ? `${fmt(d.salaryRatioManagement, 2)} : 1` : NOT_DISCLOSED],
      ["Non-management", d?.salaryRatioNonManagement != null ? `${fmt(d.salaryRatioNonManagement, 2)} : 1` : NOT_DISCLOSED],
    ],
  });
  if (d?.salaryRatioBasis) pb.note(`Basis of calculation: ${d.salaryRatioBasis}`);
}

function renderNonDiscrimination(pb: PageBuilder, report: GriReportWithRelations) {
  const d = report.nonDiscriminationDisclosure;

  pb.heading("406-1 Incidents of discrimination and corrective actions taken");
  pb.table({
    columns: [
      { header: "Metric", width: 320 },
      { header: "Count", width: 175, align: "right" },
    ],
    rows: [
      ["Total incidents of discrimination during the period", fmtCount(d?.incidentsCount)],
      ["Incidents reviewed by the organization", fmtCount(d?.incidentsReviewedCount)],
      ["Remediation plans implemented", fmtCount(d?.remediationPlansImplementedCount)],
      ["Incidents no longer subject to action", fmtCount(d?.incidentsNoLongerSubjectToActionCount)],
    ],
  });
  pb.paragraph(fmtText(d?.correctiveActionsDescription));
}

function renderLocalCommunities(pb: PageBuilder, report: GriReportWithRelations) {
  const d = report.localCommunitiesDisclosure;

  pb.heading("413-1 Operations with local community engagement, impact assessments and development programs");
  pb.table({
    columns: [
      { header: "Metric", width: 320 },
      { header: "Percentage of operations", width: 175, align: "right" },
    ],
    rows: [
      ["With local community engagement programs", fmtPct(d?.operationsWithEngagementPct)],
      ["With community impact assessments", fmtPct(d?.operationsWithImpactAssessmentPct)],
      ["With local development programs", fmtPct(d?.operationsWithDevelopmentProgramsPct)],
    ],
  });
  pb.paragraph(fmtText(d?.engagementDescription));

  pb.heading("413-2 Operations with significant negative impacts on local communities");
  pb.keyValueRow("Operations with significant actual or potential negative impacts", fmtCount(d?.operationsWithNegativeImpactsCount));
  pb.paragraph(fmtText(d?.negativeImpactsDescription));
}

function renderCustomerHs(pb: PageBuilder, report: GriReportWithRelations) {
  const d = report.customerHsDisclosure;

  pb.heading("416-1 Assessment of health and safety impacts of product and service categories");
  pb.keyValueRow("Product and service categories assessed for health and safety impacts", fmtPct(d?.productCategoriesAssessedPct));
  pb.paragraph(fmtText(d?.assessmentDescription));

  pb.heading("416-2 Incidents of non-compliance concerning health and safety impacts");
  pb.table({
    columns: [
      { header: "Type of non-compliance", width: 320 },
      { header: "Count", width: 175, align: "right" },
    ],
    rows: [
      ["Resulting in a fine or penalty", fmtCount(d?.nonComplianceFinesCount)],
      ["Resulting in a warning", fmtCount(d?.nonComplianceWarningsCount)],
      ["With voluntary codes", fmtCount(d?.nonComplianceVoluntaryCodesCount)],
    ],
  });
  pb.paragraph(fmtText(d?.nonComplianceDescription));
}

function renderCustomerPrivacy(pb: PageBuilder, report: GriReportWithRelations) {
  const d = report.customerPrivacyDisclosure;

  pb.heading("418-1 Substantiated complaints concerning breaches of customer privacy and losses of customer data");
  pb.table({
    columns: [
      { header: "Metric", width: 320 },
      { header: "Count", width: 175, align: "right" },
    ],
    rows: [
      ["Substantiated complaints received from outside parties", fmtCount(d?.complaintsFromThirdPartiesCount)],
      ["Substantiated complaints from regulatory bodies", fmtCount(d?.complaintsFromRegulatorsCount)],
      ["Identified leaks, thefts or losses of customer data", fmtCount(d?.dataBreachesCount)],
      ["Customers affected", fmtCount(d?.customersAffectedCount)],
    ],
  });
  pb.paragraph(fmtText(d?.breachDescription));
}

// ---------------------------------------------------------------------------
// Methodology
// ---------------------------------------------------------------------------

function buildMethodology(pb: PageBuilder, section: number, report: GriReportWithRelations, metrics: GriMetrics) {
  pb.startSection(section, "Methodology and Standards Basis");

  pb.heading("Standards applied");
  pb.paragraph(
    "This report applies GRI 1: Foundation 2021, GRI 2: General Disclosures 2021, GRI 3: Material Topics 2021, and " +
      "the Topic Standards determined material by the assessment in this report. The edition of each Topic Standard " +
      "applied is cited in the GRI Content Index.",
  );

  // Version currency is a compliance matter, not a footnote — a content index
  // citing a withdrawn standard is a false claim, so the substitutions are
  // stated in the report itself.
  pb.heading("Standard versions and substitutions");
  pb.table({
    columns: [
      { header: "Standard", width: 130 },
      { header: "Treatment in this report", width: 365 },
    ],
    rows: [
      [
        "GRI 307 / GRI 419",
        "Withdrawn with the 2021 Universal Standards. Compliance with laws and regulations is reported under Disclosure 2-27 instead, covering environmental and socioeconomic non-compliance together.",
      ],
      [
        "GRI 101 / GRI 304",
        "GRI 101: Biodiversity 2024 replaced GRI 304: Biodiversity 2016 for reporting published on or after 1 January 2026. Biodiversity is reported under GRI 101; GRI 304 is not applied.",
      ],
      [
        "GRI 302 / GRI 305",
        "Both remain in force for this reporting period. GRI 103: Energy 2025 and GRI 102: Climate Change 2025 replace them for reporting periods beginning on or after 1 January 2027.",
      ],
    ],
  });

  pb.heading("Reused and derived figures");
  pb.paragraph(
    "Figures marked as derived in the GRI Content Index are computed from data already submitted to this platform " +
      "rather than entered again for this report. Nothing is recalculated at report-build time.",
  );
  pb.table({
    columns: [
      { header: "Disclosure", width: 130 },
      { header: "Source and basis", width: 365 },
    ],
    rows: [
      [
        "305-1 / 305-2",
        "Scope 1 and Scope 2 (location-based) from this facility's activity data on the IPCC AR5 (100-year) GWP basis, per GHG Protocol convention.",
      ],
      ["305-3", "Rolled up from submitted Scope 3 value-chain entries for the same reporting period."],
      ["302-1", "Electricity and imported steam converted from MWh at 3.6 GJ/MWh. Fuel energy is manually disclosed."],
      ["303-3 to 303-5", "ISO 14046 water inventory converted from cubic metres at 1 ML = 1,000 m3. Consumption derived as withdrawal minus discharge."],
      ["306-3", "Derived as the sum of waste diverted from disposal (306-4) and directed to disposal (306-5)."],
      ["403-9", "Injury rates derived from disclosed counts and hours worked; the rate basis is stated with the figures."],
    ],
  });

  pb.heading("Reporting period");
  pb.paragraph(
    `All figures cover ${metrics.fyWindow.label} (${fmtDate(metrics.fyWindow.start)} to ${fmtDate(new Date(metrics.fyWindow.end.getTime() - 86400000))}), resolved against the reporting organization's financial year.`,
  );

  if (report.notes) {
    pb.heading("Additional notes from the reporting organization");
    pb.paragraph(report.notes);
  }
}

// ---------------------------------------------------------------------------
// GRI Content Index — mandatory under GRI 1
// ---------------------------------------------------------------------------

const CONTENT_INDEX_COLUMNS = [
  { header: "Standard", width: 62 },
  { header: "No.", width: 40 },
  { header: "Disclosure", width: 250 },
  { header: "Page", width: 33, align: "right" as const },
  { header: "Omission", width: 110 },
];

/**
 * "GRI 303: Water and Effluents 2018" -> "GRI 303". The full edition is too
 * wide for the Standard column and would truncate mid-title; it is printed in
 * full as the heading above each block instead, so nothing is lost.
 */
const shortStandard = (full: string): string => (full ? full.split(":")[0].trim() : "");

const indexRow = (entry: GriContentIndexEntry): string[] => [
  shortStandard(entry.standard),
  entry.disclosureNumber,
  entry.title,
  entry.pageNumber != null ? String(entry.pageNumber) : "—",
  entry.reported ? "" : SHORT_OMISSION[entry.omissionReason ?? ""] ?? "",
];

function buildContentIndexSection(pb: PageBuilder, section: number, index: GriContentIndex) {
  pb.startSection(section, "GRI Content Index");

  pb.heading("Statement of use");
  pb.paragraph(index.claimStatement);
  pb.paragraph(`GRI 1 used: ${index.gri1Version}`, { bold: true, size: 9.5 });

  pb.paragraph(
    "This content index is required by GRI 1 as a condition of the claim above. It lists every disclosure reported, " +
      "the GRI Standard and disclosure number it corresponds to, the page of this report on which it appears, and " +
      "the reason for omission where a disclosure has not been reported.",
    { size: 9 },
  );

  pb.summaryBox("Index Summary", [
    ["Disclosures reported", fmtInt(index.reportedCount)],
    ["Disclosures omitted with a stated reason", fmtInt(index.omittedCount)],
    ["Topics assessed and determined not material", fmtInt(index.excludedTopics.length)],
  ]);

  // Rendered as one table per block rather than a single long one: table()
  // paginates rows but only draws its header once, so a single 80-row table
  // would continue onto later pages without column headings.
  const universal = index.entries.filter((e) => e.section === "UNIVERSAL");
  const materialTopics = index.entries.filter((e) => e.section === "MATERIAL_TOPICS");

  pb.heading("GRI 2: General Disclosures 2021");
  pb.table({ columns: CONTENT_INDEX_COLUMNS, rows: universal.map(indexRow) });

  pb.heading("GRI 3: Material Topics 2021");
  pb.table({ columns: CONTENT_INDEX_COLUMNS, rows: materialTopics.map(indexRow) });

  const topicCodes = Array.from(
    new Set(index.entries.filter((e) => e.section === "TOPIC").map((e) => e.topicCode!)),
  );
  for (const code of topicCodes) {
    const standard = getGriTopic(code);
    const rows = index.entries.filter((e) => e.topicCode === code);
    pb.heading(standard ? standard.edition : code);
    pb.table({ columns: CONTENT_INDEX_COLUMNS, rows: rows.map(indexRow) });
  }

  pb.heading("Omission reasons");
  pb.paragraph(
    "GRI permits exactly four reasons for omission. Abbreviations used in the tables above map to GRI's terms as " +
      "follows.",
    { size: 9 },
  );
  pb.table({
    columns: [
      { header: "Abbreviation", width: 150 },
      { header: "GRI reason for omission", width: 345 },
    ],
    rows: Object.entries(SHORT_OMISSION).map(([key, short]) => [
      short,
      GRI_OMISSION_REASON_LABELS[key as keyof typeof GRI_OMISSION_REASON_LABELS],
    ]),
  });

  if (index.excludedTopics.length > 0) {
    pb.heading("Topics assessed and determined not material");
    pb.paragraph(
      "These Topic Standards were considered during the materiality assessment and did not reach the disclosed " +
        "threshold. GRI does not require an omission statement for a topic determined not material, but does " +
        "require the determination to be explained.",
      { size: 9 },
    );
    pb.table({
      columns: [
        { header: "GRI Standard", width: 175 },
        { header: "Rationale for determination", width: 320 },
      ],
      rows: index.excludedTopics.map((t) => [t.standard, t.rationale]),
    });
  }
}

// ---------------------------------------------------------------------------
// Declaration
// ---------------------------------------------------------------------------

/**
 * Annex — product carbon footprint per SKU.
 *
 * An allocation of this facility's Scope 1 and 2 emissions across the products
 * it has listed, by output volume. It is NOT a life-cycle assessment and NOT a
 * cradle-to-gate product carbon footprint: it carries no upstream or
 * downstream emissions, and a per-unit figure derived this way is not
 * comparable to one produced under ISO 14067 or a PEF category rule. The annex
 * says so at the top and the block says so again at the bottom, because a
 * "kgCO2e per tonne" figure on a page invites exactly that comparison.
 *
 * An annex rather than a disclosure section because GRI has no product
 * footprint disclosure; presenting it among the numbered topic sections would
 * imply a standard it does not sit under.
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
    "Not a GRI disclosure. GRI has no product carbon footprint standard, so this annex sits outside the content " +
      "index and outside the in-accordance claim.",
  );

  drawProductFootprintBlock(pb, phase2.productFootprint);
}

function buildDeclaration(
  pb: PageBuilder,
  section: number,
  facility: FacilityWithCompany,
  contentIndex: GriContentIndex,
) {
  pb.startSection(section, "Declaration");

  const owner = facility.company.owner;
  const inAccordance = contentIndex.claimLevel === "IN_ACCORDANCE";

  pb.heading("Declaration");
  pb.paragraph(
    `I/We, on behalf of ${facility.company.name}, declare that the information contained in this GRI Standards ` +
      "report has been prepared in good faith based on data submitted through the Intellocarbon platform, and " +
      `that this facility has reported ${inAccordance ? "in accordance with" : "with reference to"} the GRI ` +
      `Standards for the reporting period stated in this report.`,
  );

  if (!inAccordance) {
    pb.note(
      "This report makes the 'with reference to' claim under GRI 1. The requirements outstanding for an 'in " +
        "accordance' claim are listed in the About This Report section.",
    );
  }

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
