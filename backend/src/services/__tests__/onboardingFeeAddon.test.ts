import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const update = vi.fn();
const createAddon = vi.fn();

// Stands in for a configured Razorpay client so the add-on branch of
// addFacilityCapacity can be exercised without real credentials or a real
// subscription. Must be declared before the service is imported.
vi.mock("../../config/razorpay", () => ({
  isRazorpayConfigured: true,
  razorpay: { subscriptions: { update: (...a: unknown[]) => update(...a), createAddon: (...a: unknown[]) => createAddon(...a) } },
}));

// Static imports are fine despite the mock above: vitest hoists vi.mock
// ahead of the import graph, and top-level await would fail tsc under this
// project's commonjs module setting.
import { prisma } from "../../config/prisma";
import { addFacilityCapacity } from "../billing.service";
import { ONBOARDING_FEE_ADDITIONAL_FACILITY_INR } from "../../data/plans";

/**
 * The add-on is raised only after the quantity update succeeds, and its
 * failure is deliberately non-fatal — by that point the capacity increase is
 * already live in Razorpay, so throwing would leave the company holding
 * capacity while the request reports failure. These tests pin both halves of
 * that decision, since the trade-off is a revenue risk either way.
 */
describe("additional-facility onboarding fee add-on", () => {
  const email = `addon-test-${Date.now()}@example.com`;
  let userId: string;
  let companyId: string;
  const razorpaySubscriptionId = `sub_stub_${Date.now()}`;

  beforeEach(async () => {
    update.mockReset().mockResolvedValue({});
    createAddon.mockReset().mockResolvedValue({ id: "addon_stub_1" });

    const user = await prisma.user.create({
      data: { name: "Addon Test", email, passwordHash: "x", approvalStatus: "APPROVED" },
    });
    userId = user.id;
    const company = await prisma.company.create({
      data: { ownerId: userId, name: "Addon Test Co", sector: "STEEL" },
    });
    companyId = company.id;
    await prisma.subscription.create({
      data: {
        companyId,
        tier: "CCTS_COMPLIANCE",
        status: "ACTIVE",
        razorpaySubscriptionId,
        facilitiesIncluded: 1,
        currentPeriodEnd: new Date(Date.now() + 30 * 864e5),
      },
    });
  });

  afterEach(async () => {
    await prisma.subscription.deleteMany({ where: { companyId } });
    await prisma.company.deleteMany({ where: { id: companyId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it("raises a ₹10,000 add-on, in paise, against the company's subscription", async () => {
    await addFacilityCapacity(companyId, "CCTS_COMPLIANCE");

    expect(createAddon).toHaveBeenCalledTimes(1);
    const [subId, params] = createAddon.mock.calls[0] as [string, { item: { amount: number; currency: string }; quantity: number }];
    expect(subId).toBe(razorpaySubscriptionId);
    expect(params.item.amount).toBe(ONBOARDING_FEE_ADDITIONAL_FACILITY_INR * 100);
    expect(params.item.currency).toBe("INR");
    expect(params.quantity).toBe(1);
  });

  it("schedules the capacity increase at cycle end, matching what the FAQ promises", async () => {
    await addFacilityCapacity(companyId, "CCTS_COMPLIANCE");

    const [subId, params] = update.mock.calls[0] as [string, { quantity: number; schedule_change_at: string }];
    expect(subId).toBe(razorpaySubscriptionId);
    expect(params.quantity).toBe(2);
    // "now" would charge a prorated amount mid-cycle, contradicting the
    // billing page's "starting from your next billing cycle".
    expect(params.schedule_change_at).toBe("cycle_end");
  });

  it("raises exactly one fee per facility added", async () => {
    await addFacilityCapacity(companyId, "CCTS_COMPLIANCE");
    await addFacilityCapacity(companyId, "CCTS_COMPLIANCE");
    expect(createAddon).toHaveBeenCalledTimes(2);
  });

  it("does not raise the fee when the capacity update itself fails", async () => {
    update.mockRejectedValue(new Error("razorpay down"));

    await expect(addFacilityCapacity(companyId, "CCTS_COMPLIANCE")).rejects.toMatchObject({
      code: "RAZORPAY_QUANTITY_UPDATE_FAILED",
    });

    // Never bill for capacity the company didn't get.
    expect(createAddon).not.toHaveBeenCalled();
    const after = await prisma.subscription.findFirstOrThrow({ where: { companyId } });
    expect(after.facilitiesIncluded).toBe(1);
  });

  it("still grants capacity when the fee add-on fails, rather than failing the request", async () => {
    createAddon.mockRejectedValue(new Error("addon rejected"));

    const updated = await addFacilityCapacity(companyId, "CCTS_COMPLIANCE");

    // Deliberate: the quantity change is already live in Razorpay at this
    // point, so the uncollected fee is logged for manual invoicing instead of
    // leaving the subscription in a state the response contradicts.
    expect(updated.facilitiesIncluded).toBe(2);
  });
});
