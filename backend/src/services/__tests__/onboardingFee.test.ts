import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "../../config/prisma";
import { activateSubscriptionForTier, addFacilityCapacity } from "../billing.service";
import {
  ONBOARDING_FEE_ADDITIONAL_FACILITY_INR,
  ONBOARDING_FEE_FIRST_FACILITY_INR,
  onboardingFeeInr,
} from "../../data/plans";

describe("onboarding fee", () => {
  describe("formula", () => {
    it("is ₹25,000 for the first facility plus ₹10,000 per additional one", () => {
      expect(ONBOARDING_FEE_FIRST_FACILITY_INR).toBe(25000);
      expect(ONBOARDING_FEE_ADDITIONAL_FACILITY_INR).toBe(10000);
      // The locked examples, verbatim.
      expect(onboardingFeeInr(1)).toBe(25000);
      expect(onboardingFeeInr(2)).toBe(35000);
      expect(onboardingFeeInr(3)).toBe(45000);
      expect(onboardingFeeInr(5)).toBe(65000);
    });

    it("keeps scaling past the self-serve cap, where the old flat rate stopped", () => {
      // The point of replacing the flat ₹40,000 multi-facility rate: 10
      // facilities used to cost the same as 2.
      expect(onboardingFeeInr(10)).toBe(115000);
      expect(onboardingFeeInr(20)).toBe(215000);
    });

    it("never returns less than the first-facility fee", () => {
      expect(onboardingFeeInr(0)).toBe(25000);
      expect(onboardingFeeInr(-3)).toBe(25000);
    });

    it("matches 25000 + 10000 x (n - 1) across the self-serve range", () => {
      for (let n = 1; n <= 5; n++) {
        expect(onboardingFeeInr(n)).toBe(25000 + 10000 * (n - 1));
      }
    });
  });

  describe("addFacilityCapacity in dev-bypass mode", () => {
    const email = `onboarding-fee-test-${Date.now()}@example.com`;
    let userId: string;
    let companyId: string;

    beforeEach(async () => {
      const user = await prisma.user.create({
        data: { name: "Onboarding Fee Test", email, passwordHash: "x", approvalStatus: "APPROVED" },
      });
      userId = user.id;
      const company = await prisma.company.create({
        data: { ownerId: userId, name: "Onboarding Fee Test Co", sector: "STEEL" },
      });
      companyId = company.id;
      await activateSubscriptionForTier(companyId, "CCTS_COMPLIANCE", new Date(Date.now() + 30 * 864e5), 1);
    });

    afterEach(async () => {
      await prisma.subscription.deleteMany({ where: { companyId } });
      await prisma.company.deleteMany({ where: { id: companyId } });
      await prisma.user.deleteMany({ where: { id: userId } });
    });

    it("still grants capacity when no Razorpay credentials are configured", async () => {
      // Without credentials there is no subscription to raise an add-on
      // against, so the fee is logged as uncollected rather than charged —
      // but the capacity increase must not be blocked by that.
      const updated = await addFacilityCapacity(companyId, "CCTS_COMPLIANCE");
      expect(updated.facilitiesIncluded).toBe(2);
    });

    it("increments one facility at a time across repeated calls", async () => {
      await addFacilityCapacity(companyId, "CCTS_COMPLIANCE");
      const updated = await addFacilityCapacity(companyId, "CCTS_COMPLIANCE");
      expect(updated.facilitiesIncluded).toBe(3);
    });
  });
});
