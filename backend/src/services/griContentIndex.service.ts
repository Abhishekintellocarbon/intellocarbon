import {
  GRI_UNIVERSAL_DISCLOSURES,
  GRI_MATERIAL_TOPICS_DISCLOSURES,
  GRI_TOPIC_STANDARDS,
  GRI_3_3_REQUIREMENTS,
  GRI_OMISSION_REASON_LABELS,
  GRI_CLAIM_STATEMENTS,
  type GriClaimLevel,
  type GriOmissionReason,
} from "../data/griStandards";
import { isDisclosureReported, type GriReportWithRelations, type GriMetrics, topicRowsFrom } from "./griCalculation.service";

/**
 * The GRI content index.
 *
 * This is not a decorative appendix — GRI 1: Foundation 2021 requires a
 * content index as a condition of BOTH the "in accordance" and the "with
 * reference" claim. It must list every disclosure the organization reports,
 * the standard and disclosure number it came from, where in the report it
 * appears, and — for anything from a material topic that is NOT reported — a
 * stated omission with one of exactly four permitted reasons.
 *
 * Page numbers are resolved by the PDF builder, which is the only place that
 * knows where a section landed. This module produces the index with
 * `pageNumber: null` and the builder fills it in as it renders (see
 * assignPageNumbers below), so the index can never cite a page the report
 * doesn't have.
 */

export interface GriContentIndexEntry {
  /** e.g. "GRI 305: Emissions 2016". Blank on continuation rows within one standard. */
  standard: string;
  /** e.g. "305-1". */
  disclosureNumber: string;
  title: string;
  /** 1-based page in the generated PDF, filled in during rendering. */
  pageNumber: number | null;
  reported: boolean;
  /**
   * Set only when `reported` is false AND the disclosure belongs to a material
   * topic or to GRI 2 — GRI does not require an omission statement for a topic
   * that was assessed as not material, only the not-material rationale itself.
   */
  omissionReason: GriOmissionReason | null;
  omissionExplanation: string | null;
  /** True when the figure came from the platform's calculation engines rather than manual entry. */
  derived: boolean;
  /** Grouping key used to order and section the printed table. */
  section: "UNIVERSAL" | "MATERIAL_TOPICS" | "TOPIC";
  topicCode: string | null;
}

export interface GriContentIndex {
  entries: GriContentIndexEntry[];
  claimLevel: GriClaimLevel;
  claimStatement: string;
  /** GRI 1 requires the statement of use to name the GRI 1 version applied. */
  gri1Version: string;
  reportedCount: number;
  omittedCount: number;
  /** Topics assessed and excluded, with the rationale GRI requires alongside them. */
  excludedTopics: { standard: string; title: string; rationale: string }[];
}

const GRI_1_VERSION = "GRI 1: Foundation 2021";

/**
 * Default omission reason for a material-topic disclosure left blank. GRI
 * requires a reason from its closed list of four, and
 * "information unavailable/incomplete" is the only one that is truthful when
 * the user simply hasn't entered the data — the other three assert something
 * about the disclosure (not applicable, confidential, legally prohibited) that
 * the platform has no basis to claim on the facility's behalf.
 */
const DEFAULT_OMISSION_REASON: GriOmissionReason = "INFORMATION_UNAVAILABLE_INCOMPLETE";

const DEFAULT_OMISSION_EXPLANATION =
  "Data for this disclosure was not available for this reporting period at the time of publication.";

/**
 * Builds the full content index for a report.
 *
 * Ordering follows GRI's own presentation: GRI 2 first (always, in full),
 * then GRI 3, then each material Topic Standard in registry order. Topics
 * assessed as not material do not get disclosure rows — they are listed
 * separately with their rationale, which is what GRI 3-2 requires instead.
 */
export const buildContentIndex = (report: GriReportWithRelations, metrics: GriMetrics): GriContentIndex => {
  const entries: GriContentIndexEntry[] = [];
  const universal = report.universalDisclosures as unknown as Record<string, unknown> | null;
  const topicRows = topicRowsFrom(report);

  // --- GRI 2: General Disclosures 2021 — all 30, always listed ---
  GRI_UNIVERSAL_DISCLOSURES.forEach((disclosure, index) => {
    const reported = isDisclosureReported(universal, disclosure.fields);
    entries.push({
      standard: index === 0 ? "GRI 2: General Disclosures 2021" : "",
      disclosureNumber: disclosure.number,
      title: disclosure.title,
      pageNumber: null,
      reported,
      omissionReason: reported ? null : DEFAULT_OMISSION_REASON,
      omissionExplanation: reported ? null : DEFAULT_OMISSION_EXPLANATION,
      derived: disclosure.derived ?? false,
      section: "UNIVERSAL",
      topicCode: null,
    });
  });

  // --- GRI 3: Material Topics 2021 ---
  const assessment = report.materialityAssessment;
  const materialTopicRecords = report.materialTopics.filter((t) => t.isMaterial);

  GRI_MATERIAL_TOPICS_DISCLOSURES.forEach((disclosure, index) => {
    let reported: boolean;
    if (disclosure.number === "3-1") {
      reported =
        assessment != null &&
        assessment.completedAt != null &&
        Boolean(assessment.impactIdentificationProcess) &&
        Boolean(assessment.prioritisationProcess);
    } else if (disclosure.number === "3-2") {
      reported = materialTopicRecords.length > 0;
    } else {
      // 3-3 is reported only if EVERY material topic has a complete management
      // approach — a partially-managed set of topics does not satisfy 3-3.
      reported =
        materialTopicRecords.length > 0 &&
        metrics.accordance.topics.filter((t) => t.isMaterial).every((t) => t.managementApproachComplete);
    }

    entries.push({
      standard: index === 0 ? "GRI 3: Material Topics 2021" : "",
      disclosureNumber: disclosure.number,
      title: disclosure.title,
      pageNumber: null,
      reported,
      omissionReason: reported ? null : DEFAULT_OMISSION_REASON,
      omissionExplanation: reported ? null : DEFAULT_OMISSION_EXPLANATION,
      derived: disclosure.derived ?? false,
      section: "MATERIAL_TOPICS",
      topicCode: null,
    });
  });

  // --- Topic Standards, material ones only ---
  for (const standard of GRI_TOPIC_STANDARDS) {
    const record = report.materialTopics.find((t) => t.topicCode === standard.code);
    if (!record?.isMaterial) continue;

    const row = topicRows[standard.code];

    // GRI 3-3 is restated under each material topic, per GRI's own content
    // index format — an assurance provider reads down one topic's block and
    // expects to find its management approach there, not only under GRI 3.
    const managementComplete =
      metrics.accordance.topics.find((t) => t.topicCode === standard.code)?.managementApproachComplete ?? false;
    entries.push({
      standard: standard.edition,
      disclosureNumber: "3-3",
      title: `Management of material topics — ${standard.title}`,
      pageNumber: null,
      reported: managementComplete,
      omissionReason: managementComplete ? null : DEFAULT_OMISSION_REASON,
      omissionExplanation: managementComplete
        ? null
        : `Management approach for ${standard.label} is incomplete: ${GRI_3_3_REQUIREMENTS.filter(
            (r) => !record[r.field as keyof typeof record],
          )
            .map((r) => r.label)
            .join(", ")}.`,
      derived: false,
      section: "TOPIC",
      topicCode: standard.code,
    });

    for (const disclosure of standard.disclosures) {
      const reported = isDisclosureReported(row, disclosure.fields);
      entries.push({
        standard: "",
        disclosureNumber: disclosure.number,
        title: disclosure.title,
        pageNumber: null,
        reported,
        omissionReason: reported ? null : DEFAULT_OMISSION_REASON,
        omissionExplanation: reported ? null : DEFAULT_OMISSION_EXPLANATION,
        derived: disclosure.derived ?? false,
        section: "TOPIC",
        topicCode: standard.code,
      });
    }
  }

  const excludedTopics = report.materialTopics
    .filter((t) => !t.isMaterial)
    .map((t) => {
      const standard = GRI_TOPIC_STANDARDS.find((s) => s.code === t.topicCode);
      return {
        standard: standard?.edition ?? t.topicCode,
        title: standard?.title ?? t.topicCode,
        rationale: t.notMaterialRationale ?? "No rationale stated.",
      };
    })
    .sort((a, b) => a.standard.localeCompare(b.standard));

  const claimLevel: GriClaimLevel = metrics.accordance.inAccordance ? "IN_ACCORDANCE" : "WITH_REFERENCE";

  return {
    entries,
    claimLevel,
    claimStatement: GRI_CLAIM_STATEMENTS[claimLevel],
    gri1Version: GRI_1_VERSION,
    reportedCount: entries.filter((e) => e.reported).length,
    omittedCount: entries.filter((e) => !e.reported).length,
    excludedTopics,
  };
};

/**
 * Stamps resolved page numbers onto index entries once the PDF builder knows
 * where each section landed.
 *
 * `pages` maps a lookup key to a 1-based page number. Keys are "UNIVERSAL",
 * "MATERIAL_TOPICS", or a topic code — page granularity is per section, not
 * per disclosure, which is standard practice for a GRI content index and is
 * what "page reference" means in GRI's own template.
 *
 * Mutating in place is deliberate: the index object is built before rendering
 * and printed after, and threading a rebuilt copy through the builder would
 * make it possible for the printed table and the rendered sections to diverge.
 */
export const assignPageNumbers = (index: GriContentIndex, pages: Record<string, number>): void => {
  for (const entry of index.entries) {
    const key = entry.section === "TOPIC" ? entry.topicCode : entry.section;
    if (key && pages[key] != null) entry.pageNumber = pages[key];
  }
};

/** Formats an omission for the content index's rightmost column. */
export const formatOmission = (entry: GriContentIndexEntry): string => {
  if (entry.reported) return "";
  if (!entry.omissionReason) return "";
  return GRI_OMISSION_REASON_LABELS[entry.omissionReason];
};
