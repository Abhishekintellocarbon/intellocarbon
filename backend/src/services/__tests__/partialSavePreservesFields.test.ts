import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../../config/prisma";
import { saveMaterialityAssessment as saveGriMateriality, saveGriData } from "../gri.service";
import { saveMaterialityAssessment as saveCsrdMateriality, saveCsrdData } from "../csrd.service";

/**
 * A partial save must not wipe fields it did not mention.
 *
 * Both report services take a payload carrying top-level scalars — GRI's
 * turnoverInr, CSRD's netRevenueEur, and notes on both — alongside the nested
 * disclosure sections. Writing those scalars unconditionally means any caller
 * that sends only the section it changed silently nulls the rest.
 *
 * The failure is invisible: no error, no validation complaint, just a figure
 * that has quietly vanished from an intensity ratio. It was caught in CSRD by
 * an unrelated intensity assertion, and the identical shape existed in GRI.
 * These tests pin both, because the draft convention (a full payload with null
 * meaning "cleared") makes the bug easy to reintroduce — it looks correct
 * until someone sends a partial payload.
 */

const suffix = Date.now();
const PERIOD = "FY2025-26";

let userId: string;
let companyId: string;
let facilityId: string;

beforeAll(async () => {
  const user = await prisma.user.create({
    data: {
      name: "Partial Save",
      email: `partial-save-${suffix}@example.com`,
      passwordHash: "x",
      approvalStatus: "APPROVED",
    },
  });
  userId = user.id;

  const company = await prisma.company.create({
    data: { ownerId: userId, name: `Partial Save Co ${suffix}`, sector: "STEEL", reportingFyStartMonth: 4 },
  });
  companyId = company.id;
  await prisma.subscription.create({ data: { companyId, tier: "BRSR_CORE_REPORTING", status: "ACTIVE" } });

  const facility = await prisma.facility.create({
    data: { companyId, name: "Partial Save Works", facilityType: "EAF_MINI_MILL", isDraft: false },
  });
  facilityId = facility.id;

  // Both modules gate data entry on a completed materiality assessment.
  await saveGriMateriality(userId, facilityId, {
    reportingPeriod: PERIOD,
    impactIdentificationProcess: "Workshop.",
    prioritisationProcess: "Committee.",
    materialityThreshold: 3,
    complete: true,
    impacts: [
      {
        topicCode: "GRI_305",
        description: "GHG emissions from furnace operation",
        impactType: "NEGATIVE_ACTUAL",
        valueChainLocation: "OWN_OPERATIONS",
        scale: 5,
        scope: 5,
        irremediability: 4,
      },
    ],
  } as never);

  await saveCsrdMateriality(userId, facilityId, {
    reportingPeriod: PERIOD,
    iroIdentificationProcess: "Workshop.",
    prioritisationProcess: "Committee.",
    impactThreshold: 3,
    financialThreshold: 3,
    complete: true,
    iros: [
      {
        standardCode: "ESRS_E1",
        description: "GHG emissions from furnace operation",
        kind: "IMPACT",
        valueChainLocation: "OWN_OPERATIONS",
        impactType: "NEGATIVE_ACTUAL",
        scale: 5,
        scope: 5,
        irremediability: 4,
      },
    ],
  } as never);
});

afterAll(async () => {
  await prisma.subscription.deleteMany({ where: { companyId } });
  await prisma.company.deleteMany({ where: { id: companyId } });
  await prisma.user.deleteMany({ where: { id: userId } });
});

describe("GRI — saveGriData", () => {
  it("preserves turnoverInr when a later save does not mention it", async () => {
    await saveGriData(
      userId,
      facilityId,
      { reportingPeriod: PERIOD, turnoverInr: 4_500_000_000, notes: "First pass." } as never,
      false,
    );

    // A second save carrying only a topic section — exactly what a per-section
    // autosave or a partial API call looks like.
    await saveGriData(
      userId,
      facilityId,
      { reportingPeriod: PERIOD, topics: { GRI_305: { noxTonnes: 18.4 } } } as never,
      false,
    );

    const report = await prisma.griReport.findFirstOrThrow({ where: { facilityId, reportingPeriod: PERIOD } });
    expect(report.turnoverInr).toBe(4_500_000_000);
    expect(report.notes).toBe("First pass.");
  });

  it("still clears a field when the key is present and empty", async () => {
    // The draft convention: a full payload uses null/"" to mean "cleared", and
    // that must keep working — the fix is about absent keys, not empty ones.
    await saveGriData(userId, facilityId, { reportingPeriod: PERIOD, turnoverInr: null, notes: "" } as never, false);

    const report = await prisma.griReport.findFirstOrThrow({ where: { facilityId, reportingPeriod: PERIOD } });
    expect(report.turnoverInr).toBeNull();
    expect(report.notes).toBeNull();
  });

  it("updates the field when the key is present with a new value", async () => {
    await saveGriData(userId, facilityId, { reportingPeriod: PERIOD, turnoverInr: 123 } as never, false);
    const report = await prisma.griReport.findFirstOrThrow({ where: { facilityId, reportingPeriod: PERIOD } });
    expect(report.turnoverInr).toBe(123);
  });
});

describe("CSRD — saveCsrdData", () => {
  it("preserves netRevenueEur when a later save does not mention it", async () => {
    await saveCsrdData(
      userId,
      facilityId,
      { reportingPeriod: PERIOD, netRevenueEur: 50_000_000, notes: "First pass." } as never,
      false,
    );

    await saveCsrdData(
      userId,
      facilityId,
      { reportingPeriod: PERIOD, standards: { ESRS_E1: { transitionPlan: "Stated." } } } as never,
      false,
    );

    const report = await prisma.csrdReport.findFirstOrThrow({ where: { facilityId, reportingPeriod: PERIOD } });
    expect(report.netRevenueEur).toBe(50_000_000);
    expect(report.notes).toBe("First pass.");
  });

  it("still clears a field when the key is present and empty", async () => {
    await saveCsrdData(userId, facilityId, { reportingPeriod: PERIOD, netRevenueEur: null, notes: "" } as never, false);
    const report = await prisma.csrdReport.findFirstOrThrow({ where: { facilityId, reportingPeriod: PERIOD } });
    expect(report.netRevenueEur).toBeNull();
    expect(report.notes).toBeNull();
  });
});
