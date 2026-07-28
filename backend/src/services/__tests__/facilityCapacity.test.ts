import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/AppError";
import { createFacility } from "../facility.service";
import { activateSubscriptionForTier, addFacilityCapacity, requireCapacityForNewFacility } from "../billing.service";

// Per-facility billing enforcement (see billing.service.ts's
// requireCapacityForNewFacility / addFacilityCapacity): a company's active
// subscriptions must cover at least as many facilities as it has created.
// Exercises the real service layer against the dev database rather than
// mocking Prisma, matching this codebase's existing style of integration-
// level smoke checks over unit-isolated mocks.
describe("per-facility billing enforcement", () => {
  const email = `facility-capacity-test-${Date.now()}@example.com`;
  let userId: string;
  let companyId: string;

  const validFacilityInput = (name: string) => ({
    name,
    facilityType: "INTEGRATED_STEEL_PLANT" as const,
    productionRoute: "BF_BOF",
    productsManufactured: [],
    cnCodes: [],
  });

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { name: "Facility Capacity Test", email, passwordHash: "x", approvalStatus: "APPROVED" },
    });
    userId = user.id;
    const company = await prisma.company.create({
      data: { ownerId: userId, name: "Facility Capacity Test Co", sector: "STEEL" },
    });
    companyId = company.id;

    // CCTS Compliance, ₹14,999/facility/mo — activates with the schema
    // default facilitiesIncluded=1, exactly matching the brief's scenario.
    await activateSubscriptionForTier(companyId, "CCTS_COMPLIANCE", new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
  });

  afterAll(async () => {
    await prisma.facility.deleteMany({ where: { companyId } });
    await prisma.subscription.deleteMany({ where: { companyId } });
    await prisma.company.deleteMany({ where: { id: companyId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it("allows creating the 1st facility (within the default 1-facility coverage)", async () => {
    const facility = await createFacility(userId, validFacilityInput("Facility 1"));
    expect(facility.companyId).toBe(companyId);
  });

  it("blocks creating a 2nd facility beyond the plan's covered count, with the upgrade-prompt message", async () => {
    await expect(createFacility(userId, validFacilityInput("Facility 2"))).rejects.toMatchObject({
      code: "PLAN_LIMIT_REACHED",
      message: expect.stringContaining(
        "Your current plan covers 1 facility. Add another facility subscription to continue, or upgrade your plan.",
      ),
    } as Partial<AppError>);
  });

  it("succeeds after simulating an add-on/upgrade that increases covered facility count", async () => {
    const updated = await addFacilityCapacity(companyId, "CCTS_COMPLIANCE");
    expect(updated.facilitiesIncluded).toBe(2);

    // Capacity check no longer throws once coverage catches up with intent...
    await expect(requireCapacityForNewFacility(companyId)).resolves.toBeUndefined();

    // ...and the 2nd facility can now actually be created.
    const facility = await createFacility(userId, validFacilityInput("Facility 2"));
    expect(facility.companyId).toBe(companyId);

    // Coverage is now fully used again — a 3rd facility is blocked the same way.
    await expect(createFacility(userId, validFacilityInput("Facility 3"))).rejects.toMatchObject({
      code: "PLAN_LIMIT_REACHED",
    });
  });
});
