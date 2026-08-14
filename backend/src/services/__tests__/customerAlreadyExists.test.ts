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
import { createCheckout } from "../billing.service";

/**
 * Regression cover for the 12 Aug 2026 checkout outage: Razorpay held a
 * customer for the owner's email, no subscription row carried its id, so
 * every checkout retried customers.create, got "Customer already exists for
 * the merchant" (400), and 400'd the browser — on every tier, with no way
 * out, because the id could only be persisted by the call that kept failing.
 */
describe("checkout when Razorpay already holds the customer", () => {
  const email = `customer-exists-${Date.now()}@example.com`;
  let userId: string;
  let companyId: string;

  // The exact shape Razorpay's SDK rejects with, taken from the production log.
  const alreadyExists = Object.assign(new Error("Customer already exists for the merchant"), {
    statusCode: 400,
    error: {
      code: "BAD_REQUEST_ERROR",
      description: "Customer already exists for the merchant",
      step: "NA",
      reason: "NA",
      source: "NA",
    },
  });

  beforeEach(async () => {
    customersCreate.mockReset().mockResolvedValue({ id: "cust_stub" });
    subscriptionsCreate.mockReset().mockResolvedValue({ id: "sub_stub" });
    process.env.RAZORPAY_PLAN_ID_BRSR_CORE = "plan_brsr";

    const user = await prisma.user.create({
      data: { name: "Customer Exists", email, passwordHash: "x", approvalStatus: "APPROVED" },
    });
    userId = user.id;
    const company = await prisma.company.create({
      data: { ownerId: userId, name: "Customer Exists Co", sector: "STEEL" },
    });
    companyId = company.id;
  });

  afterEach(async () => {
    await prisma.payment.deleteMany({ where: { subscription: { companyId } } });
    await prisma.subscription.deleteMany({ where: { companyId } });
    await prisma.company.deleteMany({ where: { id: companyId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it("asks Razorpay to return the existing customer rather than reject", async () => {
    await createCheckout(companyId, "BRSR_CORE_REPORTING", 1);

    expect(customersCreate).toHaveBeenCalledTimes(1);
    expect(customersCreate.mock.calls[0][0]).toMatchObject({ email, fail_existing: 0 });
  });

  it("completes the checkout when customers.create still reports a duplicate", async () => {
    customersCreate.mockRejectedValue(alreadyExists);

    const result = await createCheckout(companyId, "BRSR_CORE_REPORTING", 1);

    if (result.devBypass) throw new Error("expected the configured-Razorpay path, got dev-bypass");
    expect(result.razorpaySubscriptionId).toBe("sub_stub");
    expect(subscriptionsCreate).toHaveBeenCalledTimes(1);

    // The row is written without a customer id rather than not written at all.
    const subscription = await prisma.subscription.findFirst({ where: { companyId } });
    expect(subscription?.razorpaySubscriptionId).toBe("sub_stub");
    expect(subscription?.razorpayCustomerId).toBeNull();
  });

  it("still fails the checkout on any other Razorpay customer error", async () => {
    customersCreate.mockRejectedValue(
      Object.assign(new Error("Authentication failed"), {
        statusCode: 401,
        error: { code: "BAD_REQUEST_ERROR", description: "Authentication failed" },
      }),
    );

    await expect(createCheckout(companyId, "BRSR_CORE_REPORTING", 1)).rejects.toMatchObject({
      code: "RAZORPAY_CHECKOUT_FAILED",
    });
    expect(subscriptionsCreate).not.toHaveBeenCalled();
  });

  it("skips customer creation entirely once an id is on record", async () => {
    await prisma.subscription.create({
      data: { companyId, tier: "CCTS_COMPLIANCE", status: "CANCELED", razorpayCustomerId: "cust_known" },
    });

    await createCheckout(companyId, "BRSR_CORE_REPORTING", 1);

    expect(customersCreate).not.toHaveBeenCalled();
    const subscription = await prisma.subscription.findFirst({
      where: { companyId, tier: "BRSR_CORE_REPORTING" },
    });
    expect(subscription?.razorpayCustomerId).toBe("cust_known");
  });
});
