import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import {
  saveMaterialityAssessment,
  saveGriData,
  getMaterialityAssessment,
} from "../gri.service";
import { GRI_TOPIC_STANDARDS, GRI_3_3_REQUIREMENTS, GRI_UNIVERSAL_DISCLOSURES } from "../../data/griStandards";

/**
 * Materiality gating — the property that makes this module GRI rather than a
 * form with GRI labels on it.
 *
 * Under GRI 3 the materiality assessment decides which Topic Standards are
 * reported at all. If that gating were cosmetic — enforced in the UI only —
 * a stale form or a direct API call could put data against a topic the report
 * declares immaterial, and the content index would then contradict the report
 * body. These tests pin it at the service layer, which is the actual boundary.
 */

const PERIOD = "FY2025-26";
const suffix = Date.now();

let userId: string;
let companyId: string;
let facilityId: string;

const completeAssessment = (impacts: unknown[], complete = true) =>
  saveMaterialityAssessment(userId, facilityId, {
    reportingPeriod: PERIOD,
    stakeholderGroups: ["Employees", "Local communities"],
    stakeholderEngagementApproach: "Quarterly works-council meetings.",
    impactIdentificationProcess: "Cross-functional workshop and stakeholder interviews.",
    prioritisationProcess: "Scored by the sustainability committee.",
    materialityThreshold: 3,
    complete,
    impacts,
  } as never);

/** A severe, already-occurring impact — comfortably material. */
const severeImpact = (topicCode: string) => ({
  topicCode,
  description: `Significant impact for ${topicCode}`,
  impactType: "NEGATIVE_ACTUAL" as const,
  valueChainLocation: "OWN_OPERATIONS" as const,
  scale: 5,
  scope: 5,
  irremediability: 4,
});

/** A trivial, unlikely impact — comfortably below the threshold. */
const trivialImpact = (topicCode: string) => ({
  topicCode,
  description: `Minor impact for ${topicCode}`,
  impactType: "NEGATIVE_POTENTIAL" as const,
  valueChainLocation: "DOWNSTREAM" as const,
  scale: 2,
  scope: 1,
  irremediability: 1,
  likelihood: 1,
});

const managementApproachFor = (topicCode: string) => ({
  topicCode,
  isMaterial: true,
  ...Object.fromEntries(GRI_3_3_REQUIREMENTS.map((r) => [r.field, `Stated for ${topicCode}.`])),
});

/**
 * Every GRI 2 disclosure filled in, typed off the Prisma schema rather than
 * guessed from field names — GriUniversalDisclosures mixes String, Int, Float,
 * Boolean and DateTime columns, and a string in a Boolean column fails the
 * upsert rather than the assertion, which makes for a confusing failure.
 */
const UNIVERSAL_FIELD_TYPES = new Map(
  Prisma.dmmf.datamodel.models
    .find((m) => m.name === "GriUniversalDisclosures")!
    .fields.map((f) => [f.name, f.type]),
);

const sampleValueFor = (field: string): unknown => {
  switch (UNIVERSAL_FIELD_TYPES.get(field)) {
    case "Int":
    case "Float":
      return 1;
    case "Boolean":
      return true;
    case "DateTime":
      return new Date();
    default:
      return "Stated.";
  }
};

const fullUniversal = () =>
  Object.fromEntries(GRI_UNIVERSAL_DISCLOSURES.flatMap((d) => d.fields.map((f) => [f, sampleValueFor(f)])));

beforeAll(async () => {
  const user = await prisma.user.create({
    data: {
      name: "GRI Gating",
      email: `gri-gating-${suffix}@example.com`,
      passwordHash: "x",
      approvalStatus: "APPROVED",
    },
  });
  userId = user.id;

  const company = await prisma.company.create({
    data: { ownerId: userId, name: `GRI Gating Co ${suffix}`, sector: "STEEL", reportingFyStartMonth: 4 },
  });
  companyId = company.id;

  await prisma.subscription.create({
    data: { companyId, tier: "BRSR_CORE_REPORTING", status: "ACTIVE" },
  });

  const facility = await prisma.facility.create({
    data: { companyId, name: "Gating Works", facilityType: "EAF_MINI_MILL", isDraft: false },
  });
  facilityId = facility.id;
});

afterAll(async () => {
  // GriReport cascades to the assessment, impacts, material topics and every
  // topic disclosure row, so deleting the company is enough.
  await prisma.subscription.deleteMany({ where: { companyId } });
  await prisma.company.deleteMany({ where: { id: companyId } });
  await prisma.user.deleteMany({ where: { id: userId } });
});

describe("GRI 3 must come first", () => {
  it("refuses disclosure data before the materiality assessment exists", async () => {
    await expect(
      saveGriData(userId, facilityId, { reportingPeriod: PERIOD } as never, false),
    ).rejects.toMatchObject({ code: "GRI_MATERIALITY_INCOMPLETE" });
  });

  it("still refuses while the assessment is saved but not completed", async () => {
    await completeAssessment([severeImpact("GRI_305")], false);

    const state = await getMaterialityAssessment(userId, facilityId, PERIOD);
    expect(state.assessment?.completedAt).toBeNull();

    await expect(
      saveGriData(userId, facilityId, { reportingPeriod: PERIOD } as never, false),
    ).rejects.toMatchObject({ code: "GRI_MATERIALITY_INCOMPLETE" });
  });
});

describe("assessment output decides which topics are reportable", () => {
  beforeAll(async () => {
    await completeAssessment([
      severeImpact("GRI_305"),
      severeImpact("GRI_303"),
      trivialImpact("GRI_418"),
    ]);
  });

  it("writes a record for every Topic Standard, material or not", async () => {
    // A topic nobody raised an impact against is still a topic that was
    // assessed and excluded — the content index has to be able to say so.
    const topics = await prisma.griMaterialTopic.findMany({
      where: { griReport: { facilityId, reportingPeriod: PERIOD } },
    });
    expect(topics).toHaveLength(GRI_TOPIC_STANDARDS.length);
  });

  it("marks above-threshold topics material", async () => {
    const topics = await prisma.griMaterialTopic.findMany({
      where: { griReport: { facilityId, reportingPeriod: PERIOD }, isMaterial: true },
    });
    expect(topics.map((t) => t.topicCode).sort()).toEqual(["GRI_303", "GRI_305"]);
    expect(topics.every((t) => t.rank != null && t.significanceScore != null)).toBe(true);
  });

  it("excludes a below-threshold topic with an auto-stated rationale naming the threshold", async () => {
    const privacy = await prisma.griMaterialTopic.findFirstOrThrow({
      where: { griReport: { facilityId, reportingPeriod: PERIOD }, topicCode: "GRI_418" },
    });
    expect(privacy.isMaterial).toBe(false);
    expect(privacy.notMaterialRationale).toContain("below the disclosed materiality threshold");
    expect(privacy.rank).toBeNull();
  });

  it("excludes a topic with no impacts at all, and says so", async () => {
    const materials = await prisma.griMaterialTopic.findFirstOrThrow({
      where: { griReport: { facilityId, reportingPeriod: PERIOD }, topicCode: "GRI_301" },
    });
    expect(materials.isMaterial).toBe(false);
    expect(materials.notMaterialRationale).toContain("No actual or potential impacts were identified");
  });

  // The core assertion the module exists for.
  it("rejects disclosure data for a topic assessed as not material", async () => {
    await expect(
      saveGriData(
        userId,
        facilityId,
        { reportingPeriod: PERIOD, topics: { GRI_418: { dataBreachesCount: 3 } } } as never,
        false,
      ),
    ).rejects.toMatchObject({ code: "GRI_TOPIC_NOT_MATERIAL" });

    const row = await prisma.griCustomerPrivacyDisclosure.findFirst({
      where: { griReport: { facilityId, reportingPeriod: PERIOD } },
    });
    expect(row).toBeNull();
  });

  it("accepts disclosure data for a material topic", async () => {
    await saveGriData(
      userId,
      facilityId,
      { reportingPeriod: PERIOD, topics: { GRI_305: { noxTonnes: 18.4 } } } as never,
      false,
    );

    const row = await prisma.griEmissionsDisclosure.findFirstOrThrow({
      where: { griReport: { facilityId, reportingPeriod: PERIOD } },
    });
    expect(row.noxTonnes).toBe(18.4);
  });

  it("rejects an unknown topic code outright", async () => {
    await expect(
      saveGriData(
        userId,
        facilityId,
        { reportingPeriod: PERIOD, topics: { GRI_999: { anything: 1 } } } as never,
        false,
      ),
    ).rejects.toMatchObject({ code: "GRI_UNKNOWN_TOPIC" });
  });

  // isMaterial is an output of the assessment. If the disclosure form could
  // set it, the assessment could be bypassed entirely.
  it("ignores an attempt to flip isMaterial from the disclosure endpoint", async () => {
    await saveGriData(
      userId,
      facilityId,
      {
        reportingPeriod: PERIOD,
        materialTopics: [{ ...managementApproachFor("GRI_418"), isMaterial: true }],
      } as never,
      false,
    );

    const privacy = await prisma.griMaterialTopic.findFirstOrThrow({
      where: { griReport: { facilityId, reportingPeriod: PERIOD }, topicCode: "GRI_418" },
    });
    expect(privacy.isMaterial).toBe(false);
  });
});

describe("submit refuses a report that cannot back its own claims", () => {
  it("blocks submit while a material topic has no disclosure data", async () => {
    // GRI 303 is material but was never populated above.
    await expect(
      saveGriData(userId, facilityId, { reportingPeriod: PERIOD } as never, true),
    ).rejects.toMatchObject({ code: "GRI_MATERIAL_TOPIC_EMPTY" });
  });

  it("names the offending topics in the error, so the gap is actionable", async () => {
    await expect(
      saveGriData(userId, facilityId, { reportingPeriod: PERIOD } as never, true),
    ).rejects.toThrow(/GRI 303/);
  });

  it("allows submit once every material topic carries data", async () => {
    const report = await saveGriData(
      userId,
      facilityId,
      {
        reportingPeriod: PERIOD,
        turnoverInr: 1_000_000,
        universal: fullUniversal(),
        materialTopics: [managementApproachFor("GRI_305"), managementApproachFor("GRI_303")],
        topics: {
          GRI_305: { noxTonnes: 18.4, gasesIncluded: "CO2, CH4, N2O" },
          GRI_303: { interactionsNarrative: "Municipal and recycled supply.", withdrawalTotalMl: 60 },
        },
      } as never,
      true,
    );

    expect(report.status).toBe("SUBMITTED");
  });

  it("locks further draft saves once submitted, requiring an explicit resubmit", async () => {
    await expect(
      saveGriData(userId, facilityId, { reportingPeriod: PERIOD } as never, false),
    ).rejects.toMatchObject({ code: "GRI_REPORT_NOT_DRAFT" });
  });
});

describe("re-running the assessment each reporting period", () => {
  it("preserves GRI 3-3 narrative when a topic stays material", async () => {
    // GRI expects material topics to be reviewed each period. Losing a year's
    // management-approach write-up because a score moved would be a data-loss
    // bug, not a recalculation.
    const before = await prisma.griMaterialTopic.findFirstOrThrow({
      where: { griReport: { facilityId, reportingPeriod: PERIOD }, topicCode: "GRI_305" },
    });
    expect(before.actionsTaken).toBeTruthy();

    await completeAssessment([severeImpact("GRI_305"), severeImpact("GRI_303"), trivialImpact("GRI_418")]);

    const after = await prisma.griMaterialTopic.findFirstOrThrow({
      where: { griReport: { facilityId, reportingPeriod: PERIOD }, topicCode: "GRI_305" },
    });
    expect(after.actionsTaken).toBe(before.actionsTaken);
    expect(after.isMaterial).toBe(true);
  });

  it("clears a stale not-material rationale when a topic becomes material", async () => {
    // GRI 418 was excluded; give it a severe impact and it must not keep a
    // "not material because..." line into a report that now discloses it.
    await completeAssessment([severeImpact("GRI_305"), severeImpact("GRI_418")]);

    const privacy = await prisma.griMaterialTopic.findFirstOrThrow({
      where: { griReport: { facilityId, reportingPeriod: PERIOD }, topicCode: "GRI_418" },
    });
    expect(privacy.isMaterial).toBe(true);
    expect(privacy.notMaterialRationale).toBeNull();
  });

  it("de-materialises a topic that no longer clears the threshold", async () => {
    await completeAssessment([severeImpact("GRI_305"), trivialImpact("GRI_303")]);

    const water = await prisma.griMaterialTopic.findFirstOrThrow({
      where: { griReport: { facilityId, reportingPeriod: PERIOD }, topicCode: "GRI_303" },
    });
    expect(water.isMaterial).toBe(false);
    expect(water.notMaterialRationale).toContain("below the disclosed materiality threshold");
  });

  it("replaces the impact list rather than accumulating duplicates across runs", async () => {
    const impacts = await prisma.griImpact.findMany({
      where: { assessment: { griReport: { facilityId, reportingPeriod: PERIOD } } },
    });
    expect(impacts).toHaveLength(2);
  });

  /**
   * A topic that gains impacts on a re-run but still falls below the threshold
   * used to keep its original "no impacts were identified" line. That text is
   * printed verbatim in the content index, so the stale version was a false
   * statement in a compliance document.
   */
  it("rewrites a stale rationale when a topic gains impacts but stays below the threshold", async () => {
    // GRI 306 has had no impacts at all so far.
    const before = await prisma.griMaterialTopic.findFirstOrThrow({
      where: { griReport: { facilityId, reportingPeriod: PERIOD }, topicCode: "GRI_306" },
    });
    expect(before.notMaterialRationale).toContain("No actual or potential impacts were identified");

    await completeAssessment([severeImpact("GRI_305"), trivialImpact("GRI_306")]);

    const after = await prisma.griMaterialTopic.findFirstOrThrow({
      where: { griReport: { facilityId, reportingPeriod: PERIOD }, topicCode: "GRI_306" },
    });
    expect(after.isMaterial).toBe(false);
    expect(after.significanceScore).toBe(0.8);
    expect(after.notMaterialRationale).toContain("below the disclosed materiality threshold");
    expect(after.notMaterialRationale).not.toContain("No actual or potential impacts");
  });

  it("preserves a user-authored rationale when the determination has not moved", async () => {
    // The disclosure form lets a user write a better explanation than the
    // auto-generated one; an unchanged re-run must not overwrite it.
    await prisma.griMaterialTopic.updateMany({
      where: { griReport: { facilityId, reportingPeriod: PERIOD }, topicCode: "GRI_306" },
      data: { notMaterialRationale: "Hand-written explanation from the sustainability team." },
    });

    await completeAssessment([severeImpact("GRI_305"), trivialImpact("GRI_306")]);

    const after = await prisma.griMaterialTopic.findFirstOrThrow({
      where: { griReport: { facilityId, reportingPeriod: PERIOD }, topicCode: "GRI_306" },
    });
    expect(after.notMaterialRationale).toBe("Hand-written explanation from the sustainability team.");
  });
});

describe("correcting a submitted report's materiality", () => {
  /**
   * Without an escape hatch, a facility that submits and then spots a
   * mis-scored impact could never correct its material topics — there is no
   * resubmit path for the assessment the way there is for disclosure data.
   */
  it("rejects a background autosave against a submitted report", async () => {
    await saveGriData(
      userId,
      facilityId,
      {
        reportingPeriod: PERIOD,
        universal: fullUniversal(),
        materialTopics: [managementApproachFor("GRI_305")],
        topics: { GRI_305: { noxTonnes: 18.4 } },
      } as never,
      true,
    );

    await expect(completeAssessment([severeImpact("GRI_305")], false)).rejects.toMatchObject({
      code: "GRI_REPORT_NOT_DRAFT",
    });
  });

  it("accepts an explicit completed re-run against a submitted report", async () => {
    const result = await completeAssessment([severeImpact("GRI_305")]);
    expect(result.rankings.some((r) => r.topicCode === "GRI_305" && r.meetsThreshold)).toBe(true);
  });

  it("reverts the report to DRAFT when the re-run moves the material set", async () => {
    // A submitted report whose material topics have changed no longer matches
    // the disclosure data behind it, so it must be resubmitted — which
    // re-runs the "material topic has no data" check.
    const before = await prisma.griReport.findFirstOrThrow({ where: { facilityId, reportingPeriod: PERIOD } });
    expect(before.status).toBe("SUBMITTED");

    const result = await completeAssessment([severeImpact("GRI_305"), severeImpact("GRI_413")]);
    expect(result.materialSetChanged).toBe(true);

    const after = await prisma.griReport.findFirstOrThrow({ where: { facilityId, reportingPeriod: PERIOD } });
    expect(after.status).toBe("DRAFT");
  });

  it("leaves a submitted report submitted when the re-run changes nothing material", async () => {
    await saveGriData(
      userId,
      facilityId,
      {
        reportingPeriod: PERIOD,
        universal: fullUniversal(),
        materialTopics: [managementApproachFor("GRI_305"), managementApproachFor("GRI_413")],
        topics: { GRI_305: { noxTonnes: 18.4 }, GRI_413: { operationsWithEngagementPct: 80 } },
      } as never,
      true,
    );

    const result = await completeAssessment([severeImpact("GRI_305"), severeImpact("GRI_413")]);
    expect(result.materialSetChanged).toBe(false);

    const after = await prisma.griReport.findFirstOrThrow({ where: { facilityId, reportingPeriod: PERIOD } });
    expect(after.status).toBe("SUBMITTED");
  });
});
