import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { getEsgOverview } from "../esgOverview.service";
import { saveMaterialityAssessment, saveGriData } from "../gri.service";
import { GRI_UNIVERSAL_DISCLOSURES, GRI_3_3_REQUIREMENTS } from "../../data/griStandards";
import { GRI_REPORTING_REQUIREMENTS } from "../../data/esgDisclosureChecklist";

/**
 * GRI's roll-up onto the ESG Overview.
 *
 * The property worth protecting here is that the card does NOT report a
 * company-level topic total. Which Topic Standards a facility reports is
 * decided by its own materiality assessment, so two facilities can both be
 * fully compliant while covering different topics — summing their topic counts
 * would produce a figure that means nothing, and averaging would imply the
 * topics are interchangeable. These tests pin the union/intersection reading
 * that replaces it, and the strict "every facility" completeness rule.
 */

const PERIOD = "FY2025-26";
const suffix = Date.now();

let userId: string;
let companyId: string;
let facilityA: string;
let facilityB: string;

const UNIVERSAL_FIELD_TYPES = new Map(
  Prisma.dmmf.datamodel.models
    .find((m) => m.name === "GriUniversalDisclosures")!
    .fields.map((f) => [f.name, f.type]),
);

const sampleValueFor = (field: string): unknown => {
  switch (UNIVERSAL_FIELD_TYPES.get(field)) {
    case "Int":
    case "Float":
      return 5;
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

const severeImpact = (topicCode: string) => ({
  topicCode,
  description: `Significant impact for ${topicCode}`,
  impactType: "NEGATIVE_ACTUAL" as const,
  valueChainLocation: "OWN_OPERATIONS" as const,
  scale: 5,
  scope: 5,
  irremediability: 4,
});

const managementApproachFor = (topicCode: string) => ({
  topicCode,
  isMaterial: true,
  ...Object.fromEntries(GRI_3_3_REQUIREMENTS.map((r) => [r.field, `Stated for ${topicCode}.`])),
});

/** Minimum disclosure payload per topic, so each material topic has data. */
const TOPIC_DATA: Record<string, Record<string, unknown>> = {
  GRI_305: { noxTonnes: 18.4 },
  GRI_303: { interactionsNarrative: "Municipal supply." },
  GRI_306: { wasteImpactsNarrative: "Slag and refractory." },
};

const fileReport = async (facilityId: string, topics: string[], opts: { complete?: boolean } = {}) => {
  await saveMaterialityAssessment(userId, facilityId, {
    reportingPeriod: PERIOD,
    stakeholderGroups: ["Employees"],
    impactIdentificationProcess: "Workshop.",
    prioritisationProcess: "Committee.",
    materialityThreshold: 3,
    complete: true,
    impacts: topics.map(severeImpact),
  } as never);

  await saveGriData(
    userId,
    facilityId,
    {
      reportingPeriod: PERIOD,
      universal: opts.complete === false ? {} : fullUniversal(),
      materialTopics: topics.map(managementApproachFor),
      topics: Object.fromEntries(topics.map((t) => [t, TOPIC_DATA[t]])),
    } as never,
    true,
  );
};

beforeAll(async () => {
  const user = await prisma.user.create({
    data: {
      name: "GRI Rollup",
      email: `gri-rollup-${suffix}@example.com`,
      passwordHash: "x",
      approvalStatus: "APPROVED",
    },
  });
  userId = user.id;

  const company = await prisma.company.create({
    data: { ownerId: userId, name: `GRI Rollup Co ${suffix}`, sector: "STEEL", reportingFyStartMonth: 4 },
  });
  companyId = company.id;

  await prisma.subscription.create({ data: { companyId, tier: "BRSR_CORE_REPORTING", status: "ACTIVE" } });

  const a = await prisma.facility.create({
    data: { companyId, name: "Plant A", facilityType: "EAF_MINI_MILL", isDraft: false },
  });
  const b = await prisma.facility.create({
    data: { companyId, name: "Plant B", facilityType: "EAF_MINI_MILL", isDraft: false },
  });
  facilityA = a.id;
  facilityB = b.id;

  // Deliberately different material sets: emissions matters at both, water
  // only at A. This is the case a naive sum gets wrong.
  await fileReport(facilityA, ["GRI_305", "GRI_303"]);
  await fileReport(facilityB, ["GRI_305"]);
});

afterAll(async () => {
  await prisma.subscription.deleteMany({ where: { companyId } });
  await prisma.company.deleteMany({ where: { id: companyId } });
  await prisma.user.deleteMany({ where: { id: userId } });
});

describe("GRI overview roll-up across facilities", () => {
  it("counts distinct material topics as a union, not a sum", async () => {
    const overview = await getEsgOverview(userId);
    // A reports 2 topics and B reports 1. The answer is 2 distinct topics,
    // not 3 — GRI 305 is the same standard at both facilities.
    expect(overview.gri.distinctMaterialTopics).toBe(2);
  });

  it("counts topics material at every facility as an intersection", async () => {
    const overview = await getEsgOverview(userId);
    // Only GRI 305 is material at both.
    expect(overview.gri.topicsMaterialEverywhere).toBe(1);
  });

  it("reports how many facilities judged each topic material", async () => {
    const overview = await getEsgOverview(userId);
    const spread = Object.fromEntries(overview.gri.topicSpread.map((t) => [t.topicCode, t.facilities]));
    expect(spread).toEqual({ GRI_305: 2, GRI_303: 1 });
  });

  it("orders the spread by how widely each topic is material", async () => {
    const overview = await getEsgOverview(userId);
    expect(overview.gri.topicSpread.map((t) => t.topicCode)).toEqual(["GRI_305", "GRI_303"]);
  });

  it("resolves each topic to its registry label rather than echoing the raw code", async () => {
    const overview = await getEsgOverview(userId);
    const emissions = overview.gri.topicSpread.find((t) => t.topicCode === "GRI_305")!;
    expect(emissions.label).toBe("GRI 305");
    expect(emissions.title).toBe("Emissions");
  });

  it("counts facilities reporting and facilities able to claim in accordance", async () => {
    const overview = await getEsgOverview(userId);
    expect(overview.gri.facilitiesReporting).toBe(2);
    expect(overview.gri.facilitiesInAccordance).toBe(2);
    expect(overview.gri.hasReports).toBe(true);
    expect(overview.gri.periodLabel).toBe(PERIOD);
  });

  it("marks every GRI 1 reporting requirement complete when both facilities comply", async () => {
    const overview = await getEsgOverview(userId);
    expect(overview.completeness.gri.total).toBe(GRI_REPORTING_REQUIREMENTS.length);
    expect(overview.completeness.gri.complete).toBe(GRI_REPORTING_REQUIREMENTS.length);
    expect(overview.completeness.gri.periodLabel).toBe(PERIOD);
  });
});

describe("one non-compliant facility is not masked by a compliant one", () => {
  beforeAll(async () => {
    // Strip B's general disclosures, leaving A's intact.
    await prisma.griUniversalDisclosures.deleteMany({
      where: { griReport: { facilityId: facilityB, reportingPeriod: PERIOD } },
    });
  });

  it("drops the GRI 2 requirement to incomplete company-wide", async () => {
    const overview = await getEsgOverview(userId);
    const universal = overview.completeness.gri.requirements.find((r) => r.key === "universal")!;
    expect(universal.complete).toBe(false);
  });

  it("leaves the requirements the compliant facility still meets alone", async () => {
    const overview = await getEsgOverview(userId);
    const materiality = overview.completeness.gri.requirements.find((r) => r.key === "materiality")!;
    expect(materiality.complete).toBe(true);
  });

  it("reports the weakest facility's general-disclosure count, not the average", async () => {
    const overview = await getEsgOverview(userId);
    // B now has none; A has all 30. The strip must surface the gap.
    expect(overview.gri.universalDisclosuresReported).toBe(0);
    expect(overview.gri.universalDisclosuresTotal).toBe(GRI_UNIVERSAL_DISCLOSURES.length);
  });

  it("counts only the still-compliant facility as in accordance", async () => {
    const overview = await getEsgOverview(userId);
    expect(overview.gri.facilitiesInAccordance).toBe(1);
    expect(overview.gri.facilitiesReporting).toBe(2);
  });

  it("dedupes outstanding requirements rather than repeating them per facility", async () => {
    const overview = await getEsgOverview(userId);
    const unique = new Set(overview.gri.outstandingRequirements);
    expect(unique.size).toBe(overview.gri.outstandingRequirements.length);
    expect(overview.gri.outstandingRequirements.length).toBeGreaterThan(0);
  });
});

describe("a company with no GRI reports", () => {
  let emptyUserId: string;
  let emptyCompanyId: string;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        name: "GRI Empty",
        email: `gri-empty-${suffix}@example.com`,
        passwordHash: "x",
        approvalStatus: "APPROVED",
      },
    });
    emptyUserId = user.id;
    const company = await prisma.company.create({
      data: { ownerId: emptyUserId, name: `GRI Empty Co ${suffix}`, sector: "STEEL" },
    });
    emptyCompanyId = company.id;
    await prisma.subscription.create({
      data: { companyId: emptyCompanyId, tier: "BRSR_CORE_REPORTING", status: "ACTIVE" },
    });
  });

  afterAll(async () => {
    await prisma.subscription.deleteMany({ where: { companyId: emptyCompanyId } });
    await prisma.company.deleteMany({ where: { id: emptyCompanyId } });
    await prisma.user.deleteMany({ where: { id: emptyUserId } });
  });

  it("returns an empty summary rather than throwing or reporting zeroes as compliance", async () => {
    const overview = await getEsgOverview(emptyUserId);
    expect(overview.gri.hasReports).toBe(false);
    expect(overview.gri.periodLabel).toBeNull();
    expect(overview.gri.facilitiesReporting).toBe(0);
    expect(overview.gri.topicSpread).toEqual([]);
  });

  it("shows the full requirement count as outstanding, so the strip reads as not-started", async () => {
    const overview = await getEsgOverview(emptyUserId);
    expect(overview.completeness.gri.complete).toBe(0);
    expect(overview.completeness.gri.total).toBe(GRI_REPORTING_REQUIREMENTS.length);
    expect(overview.completeness.gri.periodLabel).toBeNull();
  });
});
