import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../../../config/prisma";
import { getPathwayForFacility, getPathwayForActivityData } from "../index";
import { AppError } from "../../../utils/AppError";

/**
 * Pathway Modelling ships inside the ESG Disclosure Bundle, and the paywall has
 * to live on the server.
 *
 * Hiding the dashboard section stops nobody: `/api/facilities/:id/pathway` is
 * guessable from any other facility route this customer can already reach, and
 * an unguarded endpoint would hand the full projection — liability, CCTS
 * position and all — to anyone with a session. So this suite reads the same
 * seeded facility twice, once without the bundle and once with it, and the
 * difference must be a 403 rather than a hidden button.
 *
 * Runs against the dev database, like companyDashboardTierGating.test.ts.
 */
describe("pathway modelling — ESG Disclosure Bundle gating", () => {
  const email = `pathway-gate-test-${Date.now()}@example.com`;
  let userId: string;
  let otherUserId: string;
  let companyId: string;
  let facilityId: string;
  let activityDataId: string;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { name: "Pathway Gate Test", email, passwordHash: "x", approvalStatus: "APPROVED" },
    });
    userId = user.id;

    const other = await prisma.user.create({
      data: {
        name: "Unrelated User",
        email: `pathway-gate-other-${Date.now()}@example.com`,
        passwordHash: "x",
        approvalStatus: "APPROVED",
      },
    });
    otherUserId = other.id;

    const company = await prisma.company.create({
      data: { ownerId: userId, name: "Pathway Gate Test Co", sector: "STEEL", appliesCbam: true },
    });
    companyId = company.id;

    const facility = await prisma.facility.create({
      data: { companyId, name: "Gate Test Plant", productionRoute: "BF_BOF", isDraft: false },
    });
    facilityId = facility.id;

    const entry = await prisma.activityData.create({
      data: {
        facilityId,
        sector: "STEEL",
        periodStart: new Date(Date.UTC(2025, 3, 1)),
        periodEnd: new Date(Date.UTC(2026, 2, 31)),
        productCategory: "CRUDE_STEEL",
        productionQuantityT: 10_000,
        gridElectricityMwh: 8_000,
        cctsTargetIntensity: 2.0,
        status: "SUBMITTED",
      },
    });
    activityDataId = entry.id;

    await prisma.emissionCalculationResult.create({
      data: {
        activityDataId: entry.id,
        directCombustionCo2eAr5: 14_272,
        directCombustionCo2eAr2Bur3: 14_272,
        directProcessCo2e: 0,
        directPrecursorCo2e: 0,
        indirectElectricityCo2e: 5_728,
        indirectSteamCo2e: 0,
        totalDirectCo2eAr5: 14_272,
        totalDirectCo2eAr2Bur3: 14_272,
        totalEmissionsCbamAr5: 20_000,
        totalEmissionsCctsAr2Bur3: 19_800,
        specificEmbeddedEmissionsCbam: 2.0,
        ghgIntensityCcts: 1.98,
        gridEmissionFactorUsed: 0.716,
        breakdown: { fuels: [] },
      },
    });
  });

  afterAll(async () => {
    await prisma.subscription.deleteMany({ where: { companyId } });
    await prisma.facility.deleteMany({ where: { companyId } });
    await prisma.company.deleteMany({ where: { id: companyId } });
    await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
  });

  const expect403 = async (run: () => Promise<unknown>) => {
    await expect(run()).rejects.toMatchObject({ statusCode: 403, code: "ESG_BUNDLE_NOT_SUBSCRIBED" });
  };

  it("403s a company with no subscription at all", async () => {
    await expect403(() => getPathwayForFacility(userId, facilityId, null));
    await expect403(() => getPathwayForActivityData(userId, facilityId, activityDataId, null));
  });

  it("403s a company holding a different tier — CBAM alone does not include IntelloAdvisor", async () => {
    await prisma.subscription.create({
      data: {
        companyId,
        tier: "CBAM_COMPLIANCE",
        status: "ACTIVE",
        currentPeriodEnd: new Date(Date.now() + 30 * 864e5),
        facilitiesIncluded: 1,
      },
    });
    await expect403(() => getPathwayForFacility(userId, facilityId, null));
  });

  it("403s a lapsed ESG bundle, not just a missing one", async () => {
    const lapsed = await prisma.subscription.create({
      data: {
        companyId,
        tier: "BRSR_CORE_REPORTING",
        status: "CANCELED",
        currentPeriodEnd: new Date(Date.now() - 864e5),
        facilitiesIncluded: 1,
      },
    });
    await expect403(() => getPathwayForFacility(userId, facilityId, null));
    await prisma.subscription.delete({ where: { id: lapsed.id } });
  });

  it("refuses a user who cannot see the facility at all, before the paywall is reached", async () => {
    // Not a 403: an unrelated user must not learn that this facility exists.
    await expect(getPathwayForFacility(otherUserId, facilityId, null)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("serves the projection once the ESG Disclosure Bundle is active", async () => {
    await prisma.subscription.create({
      data: {
        companyId,
        tier: "BRSR_CORE_REPORTING",
        status: "ACTIVE",
        currentPeriodEnd: new Date(Date.now() + 30 * 864e5),
        facilitiesIncluded: 1,
      },
    });

    const report = await getPathwayForFacility(userId, facilityId, 10);
    expect(report.unavailableReason).toBeNull();
    expect(report.current!.totalEmissionsCbamAr5).toBe(20_000);
    expect(report.current!.cctsPositionTco2e).toBeCloseTo(200, 6);
    expect(report.scenarios.map((s) => s.id)).toEqual([
      "BUSINESS_AS_USUAL",
      "SOLAR_RECOMMENDED_CAPACITY",
      "PRODUCTION_CHANGE",
    ]);

    // The +10% scenario is the one the query parameter asked for, and it ran.
    const change = report.scenarios.find((s) => s.id === "PRODUCTION_CHANGE")!;
    expect(change.unavailableReason).toBeNull();
    expect(change.metrics.find((m) => m.metric === "TOTAL_EMISSIONS_TCO2E")!.projected!.low).toBe(22_000);
  });

  it("rejects an activity data id belonging to another facility", async () => {
    const otherFacility = await prisma.facility.create({
      data: { companyId, name: "Second Plant", productionRoute: "BF_BOF", isDraft: false },
    });
    await expect(
      getPathwayForActivityData(userId, otherFacility.id, activityDataId, null),
    ).rejects.toBeInstanceOf(AppError);
    await prisma.facility.delete({ where: { id: otherFacility.id } });
  });
});
