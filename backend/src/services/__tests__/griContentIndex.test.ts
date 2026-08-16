import { describe, it, expect } from "vitest";
import { buildContentIndex, assignPageNumbers, formatOmission } from "../griContentIndex.service";
import { evaluateAccordance, type GriMetrics, type GriReportWithRelations } from "../griCalculation.service";
import { GRI_TOPIC_STANDARDS, GRI_3_3_REQUIREMENTS, GRI_UNIVERSAL_DISCLOSURES, getGriTopic } from "../../data/griStandards";

/**
 * The content index is a compliance deliverable, not a summary table — GRI 1
 * requires it as a condition of both the "in accordance" and the "with
 * reference" claim. These tests pin the properties that make it a valid one:
 * every GRI 2 disclosure listed, material topics present and excluded topics
 * absent, an omission reason from GRI's closed list of four on everything not
 * reported, and page references that point at real pages.
 */

const MATERIAL = ["GRI_305", "GRI_303"];

const universalRow = (): Record<string, unknown> =>
  Object.fromEntries(GRI_UNIVERSAL_DISCLOSURES.flatMap((d) => d.fields.map((f) => [f, "stated"])));

// The GRI 3-3 fields are spread in from the registry rather than listed, so
// the return is typed as an index signature — TypeScript cannot infer keys
// from a computed spread, and tests below assign to them by name.
const materialTopicRecord = (topicCode: string, isMaterial: boolean): Record<string, unknown> => ({
  id: `mt-${topicCode}`,
  griReportId: "r1",
  topicCode,
  isMaterial,
  significanceScore: isMaterial ? 4.5 : 1.2,
  rank: isMaterial ? 1 : null,
  notMaterialRationale: isMaterial ? null : "Assessed below the disclosed materiality threshold.",
  ...Object.fromEntries(GRI_3_3_REQUIREMENTS.map((r) => [r.field, isMaterial ? "stated" : null])),
  createdAt: new Date(),
  updatedAt: new Date(),
});

/**
 * A report where the two material topics are fully populated, except GRI 305's
 * 305-6 (ODS) which is deliberately left blank so the omission path is
 * exercised on a real disclosure rather than a synthetic one.
 */
const buildReport = (overrides: Partial<Record<string, unknown>> = {}): GriReportWithRelations => {
  const report: Record<string, unknown> = {
    id: "r1",
    companyId: "c1",
    facilityId: "f1",
    reportingPeriod: "FY2025-26",
    turnoverInr: 1_000_000,
    status: "SUBMITTED",
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    materialityAssessment: {
      id: "a1",
      griReportId: "r1",
      stakeholderGroups: ["Employees"],
      stakeholderEngagementApproach: "stated",
      impactIdentificationProcess: "stated",
      prioritisationProcess: "stated",
      materialityThreshold: 3,
      completedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      impacts: [],
    },
    universalDisclosures: universalRow(),
    materialTopics: GRI_TOPIC_STANDARDS.map((s) => materialTopicRecord(s.code, MATERIAL.includes(s.code))),
  };

  for (const standard of GRI_TOPIC_STANDARDS) {
    if (!MATERIAL.includes(standard.code)) {
      report[standard.relation] = null;
      continue;
    }
    const row: Record<string, unknown> = {};
    for (const disclosure of standard.disclosures) {
      // Leave 305-6 unreported on purpose.
      if (standard.code === "GRI_305" && disclosure.number === "305-6") continue;
      row[disclosure.fields[0]] = "stated";
    }
    report[standard.relation] = row;
  }

  return { ...report, ...overrides } as unknown as GriReportWithRelations;
};

const buildMetrics = (report: GriReportWithRelations): GriMetrics => {
  const topicRows: Record<string, Record<string, unknown> | null> = {};
  for (const s of GRI_TOPIC_STANDARDS) {
    topicRows[s.code] = (report as unknown as Record<string, unknown>)[s.relation] as never;
  }
  return {
    accordance: evaluateAccordance({
      universal: report.universalDisclosures as unknown as Record<string, unknown>,
      materialityCompletedAt: report.materialityAssessment?.completedAt ?? null,
      materialTopics: report.materialTopics,
      topicRows,
    }),
  } as GriMetrics;
};

describe("buildContentIndex — coverage", () => {
  const report = buildReport();
  const index = buildContentIndex(report, buildMetrics(report));

  it("lists all 30 GRI 2 general disclosures", () => {
    const universal = index.entries.filter((e) => e.section === "UNIVERSAL");
    expect(universal).toHaveLength(30);
    expect(universal.map((e) => e.disclosureNumber)).toEqual(GRI_UNIVERSAL_DISCLOSURES.map((d) => d.number));
  });

  it("names the GRI 2 standard once, on the first row of its block", () => {
    const universal = index.entries.filter((e) => e.section === "UNIVERSAL");
    expect(universal[0].standard).toBe("GRI 2: General Disclosures 2021");
    expect(universal.slice(1).every((e) => e.standard === "")).toBe(true);
  });

  it("lists GRI 3's three disclosures", () => {
    expect(index.entries.filter((e) => e.section === "MATERIAL_TOPICS").map((e) => e.disclosureNumber)).toEqual([
      "3-1",
      "3-2",
      "3-3",
    ]);
  });

  it("includes every material topic and no excluded topic", () => {
    const topicCodes = new Set(index.entries.filter((e) => e.section === "TOPIC").map((e) => e.topicCode));
    expect([...topicCodes].sort()).toEqual([...MATERIAL].sort());
  });

  it("restates GRI 3-3 under each material topic, as GRI's own index format expects", () => {
    for (const code of MATERIAL) {
      const rows = index.entries.filter((e) => e.topicCode === code);
      expect(rows[0].disclosureNumber).toBe("3-3");
      expect(rows[0].standard).toBe(getGriTopic(code)!.edition);
      expect(rows[0].reported).toBe(true);
    }
  });

  it("lists every disclosure of each material topic after its 3-3 row", () => {
    for (const code of MATERIAL) {
      const standard = getGriTopic(code)!;
      const numbers = index.entries.filter((e) => e.topicCode === code).map((e) => e.disclosureNumber);
      expect(numbers).toEqual(["3-3", ...standard.disclosures.map((d) => d.number)]);
    }
  });

  it("lists excluded topics separately, each with the rationale GRI requires", () => {
    expect(index.excludedTopics).toHaveLength(GRI_TOPIC_STANDARDS.length - MATERIAL.length);
    expect(index.excludedTopics.every((t) => t.rationale && t.rationale !== "No rationale stated.")).toBe(true);
  });

  it("counts reported and omitted disclosures consistently with its own entries", () => {
    expect(index.reportedCount + index.omittedCount).toBe(index.entries.length);
    expect(index.reportedCount).toBe(index.entries.filter((e) => e.reported).length);
  });
});

describe("buildContentIndex — omissions", () => {
  const report = buildReport();
  const index = buildContentIndex(report, buildMetrics(report));

  it("marks an unreported disclosure with a reason from GRI's closed list of four", () => {
    const ods = index.entries.find((e) => e.disclosureNumber === "305-6")!;
    expect(ods.reported).toBe(false);
    expect(ods.omissionReason).toBe("INFORMATION_UNAVAILABLE_INCOMPLETE");
    expect(ods.omissionExplanation).toBeTruthy();
  });

  /**
   * The default has to be truthful. "Not applicable", "confidentiality" and
   * "legal prohibitions" each assert something about the disclosure that the
   * platform has no basis to claim on the facility's behalf; only
   * "information unavailable/incomplete" is honest when the user simply
   * hasn't entered the data.
   */
  it("never defaults to an omission reason the platform cannot substantiate", () => {
    const omitted = index.entries.filter((e) => !e.reported);
    expect(omitted.length).toBeGreaterThan(0);
    expect(omitted.every((e) => e.omissionReason === "INFORMATION_UNAVAILABLE_INCOMPLETE")).toBe(true);
  });

  it("leaves no omission reason on a reported disclosure", () => {
    expect(index.entries.filter((e) => e.reported).every((e) => e.omissionReason === null)).toBe(true);
    expect(formatOmission(index.entries.find((e) => e.reported)!)).toBe("");
  });

  it("flags derived figures so an assurance provider can see what was calculated", () => {
    const scope1 = index.entries.find((e) => e.disclosureNumber === "305-1")!;
    expect(scope1.derived).toBe(true);
    const narrative = index.entries.find((e) => e.disclosureNumber === "2-4")!;
    expect(narrative.derived).toBe(false);
  });

  it("explains an incomplete GRI 3-3 by naming the sub-requirements still outstanding", () => {
    const topics = GRI_TOPIC_STANDARDS.map((s) => {
      const record = materialTopicRecord(s.code, MATERIAL.includes(s.code));
      if (s.code === "GRI_305") record.actionsTaken = null;
      return record;
    });
    const incomplete = buildReport({ materialTopics: topics });
    const built = buildContentIndex(incomplete, buildMetrics(incomplete));

    const row = built.entries.find((e) => e.topicCode === "GRI_305" && e.disclosureNumber === "3-3")!;
    expect(row.reported).toBe(false);
    expect(row.omissionExplanation).toContain("Actions taken to manage the topic");
  });
});

describe("buildContentIndex — the compliance claim", () => {
  it("claims in accordance when the accordance evaluation says so", () => {
    const report = buildReport();
    // 305-6 is unreported, but an unreported topic disclosure is an omission
    // with a stated reason, not an accordance blocker.
    const index = buildContentIndex(report, buildMetrics(report));
    expect(index.claimLevel).toBe("IN_ACCORDANCE");
    expect(index.claimStatement).toContain("in accordance with the GRI Standards");
    expect(index.gri1Version).toBe("GRI 1: Foundation 2021");
  });

  it("drops to with-reference when the materiality assessment is unfinished", () => {
    const report = buildReport({
      materialityAssessment: { ...buildReport().materialityAssessment, completedAt: null },
    });
    const index = buildContentIndex(report, buildMetrics(report));
    expect(index.claimLevel).toBe("WITH_REFERENCE");
    expect(index.claimStatement).toContain("with reference to the GRI Standards");
  });

  it("marks 3-1 unreported when the assessment was never completed", () => {
    const report = buildReport({
      materialityAssessment: { ...buildReport().materialityAssessment, completedAt: null },
    });
    const index = buildContentIndex(report, buildMetrics(report));
    expect(index.entries.find((e) => e.disclosureNumber === "3-1")!.reported).toBe(false);
  });

  it("marks 3-3 unreported unless every material topic's management approach is complete", () => {
    const topics = GRI_TOPIC_STANDARDS.map((s) => {
      const record = materialTopicRecord(s.code, MATERIAL.includes(s.code));
      // Only one of the two material topics is incomplete — 3-3 still fails.
      if (s.code === "GRI_303") record.policiesCommitments = null;
      return record;
    });
    const report = buildReport({ materialTopics: topics });
    const index = buildContentIndex(report, buildMetrics(report));

    const griThreeThree = index.entries.find(
      (e) => e.section === "MATERIAL_TOPICS" && e.disclosureNumber === "3-3",
    )!;
    expect(griThreeThree.reported).toBe(false);
  });
});

describe("assignPageNumbers", () => {
  const report = buildReport();

  it("stamps a page onto every entry from its section", () => {
    const index = buildContentIndex(report, buildMetrics(report));
    expect(index.entries.every((e) => e.pageNumber === null)).toBe(true);

    assignPageNumbers(index, { UNIVERSAL: 4, MATERIAL_TOPICS: 8, GRI_305: 11, GRI_303: 13 });

    expect(index.entries.every((e) => e.pageNumber !== null)).toBe(true);
    expect(index.entries.find((e) => e.disclosureNumber === "2-1")!.pageNumber).toBe(4);
    expect(index.entries.find((e) => e.disclosureNumber === "3-2")!.pageNumber).toBe(8);
    expect(index.entries.find((e) => e.disclosureNumber === "305-1")!.pageNumber).toBe(11);
    expect(index.entries.find((e) => e.disclosureNumber === "303-3")!.pageNumber).toBe(13);
  });

  it("leaves an entry unpaged rather than citing a page that was never supplied", () => {
    // A wrong page reference in a compliance document is worse than none.
    const index = buildContentIndex(report, buildMetrics(report));
    assignPageNumbers(index, { UNIVERSAL: 4 });

    expect(index.entries.find((e) => e.disclosureNumber === "2-1")!.pageNumber).toBe(4);
    expect(index.entries.find((e) => e.disclosureNumber === "305-1")!.pageNumber).toBeNull();
  });

  it("pages an omitted disclosure too, since its section still exists in the report", () => {
    const index = buildContentIndex(report, buildMetrics(report));
    assignPageNumbers(index, { UNIVERSAL: 4, MATERIAL_TOPICS: 8, GRI_305: 11, GRI_303: 13 });
    expect(index.entries.find((e) => e.disclosureNumber === "305-6")!.pageNumber).toBe(11);
  });
});

describe("formatOmission", () => {
  it("renders GRI's exact wording for each permitted reason", () => {
    expect(
      formatOmission({ reported: false, omissionReason: "NOT_APPLICABLE" } as never),
    ).toBe("Not applicable");
    expect(
      formatOmission({ reported: false, omissionReason: "INFORMATION_UNAVAILABLE_INCOMPLETE" } as never),
    ).toBe("Information unavailable/incomplete");
  });
});
