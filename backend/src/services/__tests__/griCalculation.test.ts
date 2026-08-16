import { describe, it, expect } from "vitest";
import type { GriMaterialTopic } from "@prisma/client";
import {
  computeImpactSignificance,
  rankTopicsByImpacts,
  computeWasteTotals,
  computeSafetyRates,
  computeIntensityRatios,
  evaluateAccordance,
  isDisclosureReported,
} from "../griCalculation.service";
import { GRI_UNIVERSAL_DISCLOSURES, GRI_3_3_REQUIREMENTS, GRI_TOPIC_STANDARDS } from "../../data/griStandards";

// ---------------------------------------------------------------------------
// GRI 3 impact scoring
// ---------------------------------------------------------------------------

describe("computeImpactSignificance", () => {
  it("scores a negative impact on severity — the mean of scale, scope and irremediability", () => {
    // mean(5, 5, 4) = 4.666... -> 4.67
    expect(
      computeImpactSignificance({ impactType: "NEGATIVE_ACTUAL", scale: 5, scope: 5, irremediability: 4 }),
    ).toBe(4.67);
  });

  it("excludes irremediability from a positive impact, where severity does not apply", () => {
    // Same attributes, but irremediability must be ignored: mean(3, 3) = 3.00
    expect(
      computeImpactSignificance({ impactType: "POSITIVE_ACTUAL", scale: 3, scope: 3, irremediability: 5 }),
    ).toBe(3);
  });

  it("drops a missing irremediability from the mean rather than counting it as zero", () => {
    // mean(4, 2) = 3.00, not mean(4, 2, 0) = 2.00 — treating a blank as zero
    // would understate severity and push topics out of the report.
    expect(computeImpactSignificance({ impactType: "NEGATIVE_ACTUAL", scale: 4, scope: 2 })).toBe(3);
  });

  it("does not weight an actual impact by likelihood — it has already occurred", () => {
    expect(
      computeImpactSignificance({ impactType: "NEGATIVE_ACTUAL", scale: 4, scope: 4, irremediability: 4, likelihood: 1 }),
    ).toBe(4);
  });

  it("weights a potential impact by likelihood", () => {
    // severity mean(5, 3, 5) = 4.333; weight 0.5 + 0.5*(3/5) = 0.8 -> 3.47
    expect(
      computeImpactSignificance({
        impactType: "NEGATIVE_POTENTIAL",
        scale: 5,
        scope: 3,
        irremediability: 5,
        likelihood: 3,
      }),
    ).toBe(3.47);
  });

  /**
   * The regression that matters most. A raw `likelihood / 5` weight spans
   * 0.2-1.0 and lets likelihood swing a score fivefold, which inverts GRI 3's
   * stated priority that severity takes precedence. Under it a maximally
   * severe fatality hazard rated merely "possible" scored 2.6 against a
   * threshold of 3 and dropped out of the report entirely.
   */
  it("bounds the likelihood discount at 40% so it can never veto a severe impact on its own", () => {
    const maximallySevere = { impactType: "NEGATIVE_POTENTIAL", scale: 5, scope: 5, irremediability: 5 } as const;

    // Even at the lowest likelihood, a severity-5 impact stays at the default
    // threshold of 3 rather than collapsing to 1.0.
    expect(computeImpactSignificance({ ...maximallySevere, likelihood: 1 })).toBe(3);
    expect(computeImpactSignificance({ ...maximallySevere, likelihood: 5 })).toBe(5);
  });

  it("scores a potential impact with no stated likelihood at full weight", () => {
    // Conservative reading — assuming it is unlikely would suppress it.
    expect(
      computeImpactSignificance({ impactType: "NEGATIVE_POTENTIAL", scale: 4, scope: 4, irremediability: 4 }),
    ).toBe(4);
  });

  it("keeps every score on the 1-5 scale the threshold is expressed in", () => {
    const types = ["NEGATIVE_ACTUAL", "NEGATIVE_POTENTIAL", "POSITIVE_ACTUAL", "POSITIVE_POTENTIAL"] as const;
    for (const impactType of types) {
      for (const v of [1, 3, 5]) {
        const score = computeImpactSignificance({
          impactType,
          scale: v,
          scope: v,
          irremediability: v,
          likelihood: v,
        });
        expect(score, `${impactType} at ${v}`).toBeGreaterThanOrEqual(0.6);
        expect(score, `${impactType} at ${v}`).toBeLessThanOrEqual(5);
      }
    }
  });
});

describe("rankTopicsByImpacts", () => {
  const impacts = [
    { topicCode: "GRI_305", significanceScore: 4.67 },
    // A cluster of trivial impacts on the same topic must not dilute the severe one.
    { topicCode: "GRI_305", significanceScore: 1.0 },
    { topicCode: "GRI_305", significanceScore: 1.2 },
    { topicCode: "GRI_303", significanceScore: 3.67 },
    { topicCode: "GRI_418", significanceScore: 0.8 },
  ];

  it("takes the maximum significance per topic, not the mean", () => {
    // Mean for GRI_305 would be 2.29 and would fall below a threshold of 3.
    const ranked = rankTopicsByImpacts(impacts, 3);
    expect(ranked.find((r) => r.topicCode === "GRI_305")?.significanceScore).toBe(4.67);
    expect(ranked.find((r) => r.topicCode === "GRI_305")?.meetsThreshold).toBe(true);
  });

  it("counts every impact for a topic, not just the highest", () => {
    expect(rankTopicsByImpacts(impacts, 3).find((r) => r.topicCode === "GRI_305")?.impactCount).toBe(3);
  });

  it("ranks by significance descending, starting at 1", () => {
    const ranked = rankTopicsByImpacts(impacts, 3);
    expect(ranked.map((r) => r.topicCode)).toEqual(["GRI_305", "GRI_303", "GRI_418"]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it("ranks all topics with impacts, so ranks stay stable when the threshold moves", () => {
    // GRI_418 is below threshold but still ranked — moving the threshold later
    // must not renumber the topics above it.
    const low = rankTopicsByImpacts(impacts, 3);
    const high = rankTopicsByImpacts(impacts, 4);
    expect(low.map((r) => [r.topicCode, r.rank])).toEqual(high.map((r) => [r.topicCode, r.rank]));
    expect(low.filter((r) => r.meetsThreshold)).toHaveLength(2);
    expect(high.filter((r) => r.meetsThreshold)).toHaveLength(1);
  });

  it("treats a score exactly at the threshold as material", () => {
    expect(rankTopicsByImpacts([{ topicCode: "GRI_404", significanceScore: 3 }], 3)[0].meetsThreshold).toBe(true);
  });

  it("breaks ties deterministically so a regenerated report does not reshuffle", () => {
    const tied = [
      { topicCode: "GRI_413", significanceScore: 3.5 },
      { topicCode: "GRI_301", significanceScore: 3.5 },
      { topicCode: "GRI_406", significanceScore: 3.5 },
    ];
    const first = rankTopicsByImpacts(tied, 3).map((r) => r.topicCode);
    const second = rankTopicsByImpacts([...tied].reverse(), 3).map((r) => r.topicCode);
    expect(first).toEqual(second);
    expect(first).toEqual(["GRI_301", "GRI_406", "GRI_413"]);
  });

  it("returns nothing when no impacts were identified", () => {
    expect(rankTopicsByImpacts([], 3)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Derived topic figures
// ---------------------------------------------------------------------------

describe("computeWasteTotals", () => {
  const waste = {
    hazardousDivertedRecyclingT: 120,
    hazardousDisposalLandfillT: 45,
    nonHazardousDivertedRecyclingT: 9_400,
    nonHazardousDivertedReuseT: 610,
    nonHazardousDisposalLandfillT: 1_250,
  };

  it("derives GRI 306-3 waste generated as diverted plus directed to disposal", () => {
    // Storing a generated total too would let a facility submit a set that
    // doesn't reconcile — the first thing an assurance provider checks.
    const totals = computeWasteTotals(waste);
    expect(totals.totalDivertedT).toBe(10_130);
    expect(totals.totalDisposalT).toBe(1_295);
    expect(totals.totalGeneratedT).toBe(11_425);
  });

  it("splits totals by hazardous and non-hazardous", () => {
    const totals = computeWasteTotals(waste);
    expect(totals.hazardousDivertedT).toBe(120);
    expect(totals.hazardousDisposalT).toBe(45);
    expect(totals.nonHazardousDivertedT).toBe(10_010);
    expect(totals.nonHazardousDisposalT).toBe(1_250);
  });

  it("computes the diversion rate against generated waste", () => {
    expect(computeWasteTotals(waste).diversionRatePct).toBe(88.67);
  });

  it("reports no data rather than a misleading zero when nothing was entered", () => {
    expect(computeWasteTotals(null).hasData).toBe(false);
    expect(computeWasteTotals({}).hasData).toBe(false);
    expect(computeWasteTotals({}).diversionRatePct).toBeNull();
  });

  it("treats an explicit zero as data, unlike a blank", () => {
    const zeroed = computeWasteTotals({ hazardousDisposalLandfillT: 0 });
    expect(zeroed.hasData).toBe(true);
    expect(zeroed.totalGeneratedT).toBe(0);
    // No waste generated means the diversion rate is undefined, not 0% or 100%.
    expect(zeroed.diversionRatePct).toBeNull();
  });
});

describe("computeSafetyRates", () => {
  const ohs = {
    hoursWorked: 1_640_000,
    rateBasisHours: 200_000,
    fatalitiesEmployees: 0,
    fatalitiesNonEmployees: 0,
    highConsequenceInjuriesEmployees: 1,
    highConsequenceInjuriesNonEmployees: 0,
    recordableInjuriesEmployees: 9,
    recordableInjuriesNonEmployees: 3,
  };

  it("derives GRI 403-9 rates on the stated hour basis", () => {
    // 12 recordable / 1,640,000 hours x 200,000 = 1.463
    const rates = computeSafetyRates(ohs);
    expect(rates.recordableInjuryRate).toBe(1.463);
    expect(rates.highConsequenceInjuryRate).toBe(0.122);
    expect(rates.fatalityRate).toBe(0);
  });

  it("sums employees and other workers, as the combined population GRI permits", () => {
    expect(computeSafetyRates(ohs).totalRecordableInjuries).toBe(12);
  });

  it("honours the 1,000,000-hour basis when that is the disclosed choice", () => {
    const rates = computeSafetyRates({ ...ohs, rateBasisHours: 1_000_000 });
    expect(rates.rateBasisHours).toBe(1_000_000);
    expect(rates.recordableInjuryRate).toBe(7.317);
  });

  it("defaults to the 200,000-hour basis when none was stated", () => {
    expect(computeSafetyRates({ ...ohs, rateBasisHours: null }).rateBasisHours).toBe(200_000);
  });

  it("returns null rates rather than dividing by zero when hours worked is missing", () => {
    const rates = computeSafetyRates({ ...ohs, hoursWorked: null });
    expect(rates.hasData).toBe(false);
    expect(rates.recordableInjuryRate).toBeNull();
    // Counts are still reported — only the rates are uncomputable.
    expect(rates.totalRecordableInjuries).toBe(12);
  });

  it("returns null rates when hours worked is zero", () => {
    expect(computeSafetyRates({ ...ohs, hoursWorked: 0 }).recordableInjuryRate).toBeNull();
  });
});

describe("computeIntensityRatios", () => {
  const ghg = { totalScope1And2Co2e: 8_383, productionQuantityT: 12_000, electricityAndSteamEnergyGj: 25_200 };

  it("computes per-tonne and per-rupee intensity", () => {
    const ratios = computeIntensityRatios(ghg, 4_500_000_000);
    expect(ratios.emissionsPerTonneProduct).toBeCloseTo(0.698583, 6);
    expect(ratios.energyPerTonneProduct).toBeCloseTo(2.1, 6);
    expect(ratios.emissionsPerRupeeTurnover).toBeCloseTo(0.0000018629, 10);
  });

  it("returns null rather than Infinity when a denominator is absent", () => {
    const noProduction = computeIntensityRatios({ ...ghg, productionQuantityT: 0 }, null);
    expect(noProduction.emissionsPerTonneProduct).toBeNull();
    expect(noProduction.emissionsPerRupeeTurnover).toBeNull();
  });

  it("treats a zero turnover as no denominator", () => {
    expect(computeIntensityRatios(ghg, 0).emissionsPerRupeeTurnover).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// isDisclosureReported
// ---------------------------------------------------------------------------

describe("isDisclosureReported", () => {
  it("counts a disclosure as reported when any one backing field carries a value", () => {
    expect(isDisclosureReported({ a: null, b: "something" }, ["a", "b"])).toBe(true);
  });

  it("treats an explicit zero as reported — a real disclosed figure", () => {
    // GRI 2-27 with zero fines is a genuine disclosure, not an omission.
    expect(isDisclosureReported({ significantFinesCount: 0 }, ["significantFinesCount"])).toBe(true);
  });

  it("treats false as reported", () => {
    expect(isDisclosureReported({ chairIsSeniorExecutive: false }, ["chairIsSeniorExecutive"])).toBe(true);
  });

  it("treats null, undefined and empty string as not reported", () => {
    expect(isDisclosureReported({ a: null, b: undefined, c: "" }, ["a", "b", "c"])).toBe(false);
  });

  it("returns false for a missing row or an empty field list", () => {
    expect(isDisclosureReported(null, ["a"])).toBe(false);
    expect(isDisclosureReported({ a: 1 }, [])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// "In accordance" evaluation — the gate on the compliance claim
// ---------------------------------------------------------------------------

const materialTopic = (overrides: Partial<GriMaterialTopic> = {}): GriMaterialTopic =>
  ({
    id: "t",
    griReportId: "r",
    topicCode: "GRI_305",
    isMaterial: true,
    significanceScore: 4.5,
    rank: 1,
    notMaterialRationale: null,
    ...Object.fromEntries(GRI_3_3_REQUIREMENTS.map((r) => [r.field, "stated"])),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as GriMaterialTopic;

/** A GRI 2 row with every disclosure satisfied, so tests can knock out one at a time. */
const completeUniversal = (): Record<string, unknown> =>
  Object.fromEntries(GRI_UNIVERSAL_DISCLOSURES.flatMap((d) => d.fields.map((f) => [f, "stated"])));

/** All non-material topics need a rationale; the one material topic needs data. */
const allTopicRecords = (materialCode: string): GriMaterialTopic[] =>
  GRI_TOPIC_STANDARDS.map((s) =>
    s.code === materialCode
      ? materialTopic({ topicCode: s.code })
      : materialTopic({ topicCode: s.code, isMaterial: false, notMaterialRationale: "Assessed below threshold." }),
  );

const topicRowsWithDataFor = (code: string): Record<string, Record<string, unknown> | null> => {
  const rows: Record<string, Record<string, unknown> | null> = {};
  for (const s of GRI_TOPIC_STANDARDS) {
    rows[s.code] = s.code === code ? { [s.disclosures[0].fields[0]]: "stated" } : null;
  }
  return rows;
};

const completeInput = () => ({
  universal: completeUniversal(),
  materialityCompletedAt: new Date(),
  materialTopics: allTopicRecords("GRI_305"),
  topicRows: topicRowsWithDataFor("GRI_305"),
});

describe("evaluateAccordance", () => {
  it("grants the in-accordance claim when every requirement is met", () => {
    const result = evaluateAccordance(completeInput());
    expect(result.blockers).toEqual([]);
    expect(result.inAccordance).toBe(true);
    expect(result.universalDisclosuresReported).toBe(30);
    expect(result.materialTopicCount).toBe(1);
  });

  it("refuses the claim when a single GRI 2 disclosure is missing", () => {
    const universal = completeUniversal();
    for (const field of GRI_UNIVERSAL_DISCLOSURES.find((d) => d.number === "2-27")!.fields) {
      delete universal[field];
    }
    const result = evaluateAccordance({ ...completeInput(), universal });

    expect(result.inAccordance).toBe(false);
    expect(result.missingUniversalDisclosures).toEqual(["2-27"]);
    expect(result.universalDisclosuresReported).toBe(29);
  });

  it("refuses the claim when the materiality assessment was never completed", () => {
    const result = evaluateAccordance({ ...completeInput(), materialityCompletedAt: null });
    expect(result.inAccordance).toBe(false);
    expect(result.materialityAssessmentComplete).toBe(false);
    expect(result.blockers.some((b) => b.includes("Materiality assessment"))).toBe(true);
  });

  it("refuses the claim when no topic is material — GRI 3-2 requires at least one", () => {
    const result = evaluateAccordance({
      ...completeInput(),
      materialTopics: GRI_TOPIC_STANDARDS.map((s) =>
        materialTopic({ topicCode: s.code, isMaterial: false, notMaterialRationale: "Below threshold." }),
      ),
    });
    expect(result.inAccordance).toBe(false);
    expect(result.materialTopicCount).toBe(0);
    expect(result.blockers.some((b) => b.includes("No material topics"))).toBe(true);
  });

  it("refuses the claim when a topic is excluded without a stated rationale", () => {
    const topics = allTopicRecords("GRI_305");
    const excluded = topics.find((t) => t.topicCode === "GRI_301")!;
    excluded.notMaterialRationale = null;

    const result = evaluateAccordance({ ...completeInput(), materialTopics: topics });
    expect(result.inAccordance).toBe(false);
    expect(result.unexplainedExclusions).toEqual(["GRI_301"]);
  });

  it("refuses the claim when a material topic's GRI 3-3 is incomplete", () => {
    const topics = allTopicRecords("GRI_305");
    const material = topics.find((t) => t.topicCode === "GRI_305")!;
    (material as unknown as Record<string, unknown>).actionsTaken = null;

    const result = evaluateAccordance({ ...completeInput(), materialTopics: topics });
    expect(result.inAccordance).toBe(false);

    const topic = result.topics.find((t) => t.topicCode === "GRI_305")!;
    expect(topic.managementApproachComplete).toBe(false);
    expect(topic.missingManagementApproachFields).toEqual(["Actions taken to manage the topic"]);
  });

  it("refuses the claim when a material topic has no disclosure data", () => {
    const rows = topicRowsWithDataFor("GRI_305");
    rows.GRI_305 = null;

    const result = evaluateAccordance({ ...completeInput(), topicRows: rows });
    expect(result.inAccordance).toBe(false);
    expect(result.topics.find((t) => t.topicCode === "GRI_305")?.hasAnyData).toBe(false);
    expect(result.blockers.some((b) => b.includes("no disclosure data"))).toBe(true);
  });

  // A not-material topic is legitimately empty — holding it to the same
  // standard would make every report unclaimable.
  it("does not require GRI 3-3 or data from a topic that is not material", () => {
    const topics = allTopicRecords("GRI_305");
    for (const topic of topics) {
      if (topic.isMaterial) continue;
      for (const requirement of GRI_3_3_REQUIREMENTS) {
        (topic as unknown as Record<string, unknown>)[requirement.field] = null;
      }
    }
    const result = evaluateAccordance({ ...completeInput(), materialTopics: topics });
    expect(result.inAccordance).toBe(true);
  });

  it("reports every blocker at once rather than stopping at the first", () => {
    const result = evaluateAccordance({
      universal: {},
      materialityCompletedAt: null,
      materialTopics: [],
      topicRows: {},
    });
    expect(result.blockers.length).toBeGreaterThanOrEqual(3);
    expect(result.missingUniversalDisclosures).toHaveLength(30);
  });
});
