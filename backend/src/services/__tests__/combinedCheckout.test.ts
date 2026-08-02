import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const subscriptionsCreate = vi.fn();
const customersCreate = vi.fn();

vi.mock("../../config/razorpay", () => ({
  isRazorpayConfigured: true,
  razorpay: {
    customers: { create: (...a: unknown[]) => customersCreate(...a) },
    subscriptions: { create: (...a: unknown[]) => subscriptionsCreate(...a) },
  },
}));

import { prisma } from "../../config/prisma";
import { createCheckout, handleWebhookEvent } from "../billing.service";
import { ONBOARDING_FEE_FIRST_FACILITY_INR, onboardingFeeInr } from "../../data/plans";

/**
 * The one-time onboarding fee rides on the subscription's first invoice as a
 * Razorpay creation-time add-on, so the customer sees a single checkout modal
 * and one card entry. These tests pin the three properties that matter
 * commercially: the fee is attached exactly once, it is only marked settled
 * when the payment actually succeeds, and it never touches the recurring
 * amount.
 */
describe("combined checkout — subscription + one-time onboarding fee", () => {
  const email = `combined-checkout-${Date.now()}@example.com`;
  let userId: string;
  let companyId: string;

  const razorpaySubscriptionId = () => `sub_combined_${Math.random().toString(36).slice(2, 10)}`;

  beforeEach(async () => {
    customersCreate.mockReset().mockResolvedValue({ id: "cust_stub" });
    subscriptionsCreate.mockReset().mockImplementation(async () => ({ id: razorpaySubscriptionId() }));

    process.env.RAZORPAY_PLAN_ID_CCTS_COMPLIANCE = "plan_ccts";
    process.env.RAZORPAY_PLAN_ID_BRSR_CORE = "plan_brsr";

    const user = await prisma.user.create({
      data: { name: "Combined Checkout", email, passwordHash: "x", approvalStatus: "APPROVED" },
    });
    userId = user.id;
    const company = await prisma.company.create({
      data: { ownerId: userId, name: "Combined Checkout Co", sector: "STEEL" },
    });
    companyId = company.id;
  });

  afterEach(async () => {
    await prisma.payment.deleteMany({ where: { subscription: { companyId } } });
    await prisma.subscription.deleteMany({ where: { companyId } });
    await prisma.company.deleteMany({ where: { id: companyId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  // createCheckout's return is a union including the dev-bypass shape, which
  // carries no razorpaySubscriptionId. Razorpay is stubbed as configured here,
  // so narrow once rather than asserting at each call site.
  const checkout = async (tier: "CCTS_COMPLIANCE" | "BRSR_CORE_REPORTING", quantity: number) => {
    const result = await createCheckout(companyId, tier, quantity);
    if (result.devBypass) throw new Error("expected the configured-Razorpay path, got dev-bypass");
    return result;
  };

  const createArgs = () => subscriptionsCreate.mock.calls.at(-1)?.[0] as {
    plan_id: string;
    quantity: number;
    addons?: { item: { name: string; amount: number; currency: string } }[];
  };

  it("attaches the fee as an add-on in the same subscription create call", async () => {
    await createCheckout(companyId, "CCTS_COMPLIANCE", 1);

    // One Razorpay call, not two — this is what keeps it to a single modal.
    expect(subscriptionsCreate).toHaveBeenCalledOnce();
    const args = createArgs();
    expect(args.addons).toHaveLength(1);
    expect(args.addons![0].item.amount).toBe(ONBOARDING_FEE_FIRST_FACILITY_INR * 100); // paise
    expect(args.addons![0].item.currency).toBe("INR");
  });

  it("scales the fee with the facility count being purchased", async () => {
    await createCheckout(companyId, "CCTS_COMPLIANCE", 3);
    expect(createArgs().addons![0].item.amount).toBe(onboardingFeeInr(3) * 100);
    expect(onboardingFeeInr(3)).toBe(45000);
  });

  it("leaves the recurring plan untouched — quantity and plan only, no fee folded in", async () => {
    await createCheckout(companyId, "CCTS_COMPLIANCE", 2);
    const args = createArgs();
    expect(args.plan_id).toBe("plan_ccts");
    expect(args.quantity).toBe(2);
    // The fee lives only inside addons — never as a top-level amount and never
    // folded into quantity — so renewals bill the plan price alone.
    expect(args).not.toHaveProperty("amount");
    expect(args.addons![0].item.amount).toBe(onboardingFeeInr(2) * 100);
  });

  it("does not mark the fee settled at checkout — an abandoned modal must still owe it", async () => {
    await createCheckout(companyId, "CCTS_COMPLIANCE", 1);
    const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });
    expect(company.onboardingFeePaidAt).toBeNull();
  });

  it("marks it settled once the payment succeeds, at the amount actually charged", async () => {
    const { razorpaySubscriptionId: subId } = await checkout("CCTS_COMPLIANCE", 2);

    await handleWebhookEvent({
      event: "subscription.activated",
      payload: { subscription: { entity: { id: subId } as never } },
    });

    const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });
    expect(company.onboardingFeePaidAt).not.toBeNull();
    expect(company.onboardingFeePaidInr).toBe(onboardingFeeInr(2));
  });

  it("never charges the fee twice — a second tier carries no add-on", async () => {
    const first = await checkout("CCTS_COMPLIANCE", 1);
    await handleWebhookEvent({
      event: "subscription.activated",
      payload: { subscription: { entity: { id: first.razorpaySubscriptionId } as never } },
    });

    await createCheckout(companyId, "BRSR_CORE_REPORTING", 1);

    expect(createArgs().addons).toBeUndefined();
  });

  it("is a no-op on a replayed webhook, keeping the original settled amount", async () => {
    const { razorpaySubscriptionId: subId } = await checkout("CCTS_COMPLIANCE", 1);
    const event = {
      event: "subscription.charged" as const,
      payload: { subscription: { entity: { id: subId } as never } },
    };

    await handleWebhookEvent(event);
    const first = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });
    await handleWebhookEvent(event);
    const second = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });

    expect(second.onboardingFeePaidAt?.getTime()).toBe(first.onboardingFeePaidAt?.getTime());
    expect(second.onboardingFeePaidInr).toBe(ONBOARDING_FEE_FIRST_FACILITY_INR);
  });

  it("skips the fee entirely for a grandfathered company", async () => {
    await prisma.company.update({
      where: { id: companyId },
      data: { onboardingFeePaidAt: new Date(), onboardingFeePaidInr: 0 },
    });

    await createCheckout(companyId, "CCTS_COMPLIANCE", 4);

    expect(createArgs().addons).toBeUndefined();
  });
});
