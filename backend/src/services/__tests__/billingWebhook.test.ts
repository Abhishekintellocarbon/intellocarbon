import crypto from "crypto";

// config/env snapshots process.env at import time, so this has to run before
// billing.service is pulled in — otherwise verifyWebhookSignature sees an
// empty secret and fails closed on everything, making these tests vacuous.
const WEBHOOK_SECRET = "whsec_test_value";
vi.hoisted(() => {
  process.env.RAZORPAY_WEBHOOK_SECRET = "whsec_test_value";
});
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "../../config/prisma";
import { handleWebhookEvent, requireCapacityForNewFacility, verifyWebhookSignature } from "../billing.service";

/**
 * Exercises the Razorpay webhook handler against the dev database, in the
 * same integration style as facilityCapacity.test.ts.
 *
 * The payment.failed branch is the one a happy-path checkout never reaches,
 * and it's the branch that protects revenue: without it a customer whose card
 * later declines keeps full paid access indefinitely. It also has a subtlety
 * worth pinning — the subscription is resolved from the event's subscription
 * entity first, falling back to a prior Payment row's order_id — so both
 * routes are covered here.
 */
describe("Razorpay webhook handling", () => {
  const email = `webhook-test-${Date.now()}@example.com`;
  const razorpaySubscriptionId = `sub_test_${Date.now()}`;
  let userId: string;
  let companyId: string;
  let subscriptionId: string;

  const paymentEntity = (orderId: string) => ({
    id: `pay_test_${Date.now()}`,
    order_id: orderId,
    amount: 1499900, // ₹14,999 in paise
    status: "failed",
  });

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: { name: "Webhook Test", email, passwordHash: "x", approvalStatus: "APPROVED" },
    });
    userId = user.id;
    const company = await prisma.company.create({
      data: { ownerId: userId, name: "Webhook Test Co", sector: "STEEL" },
    });
    companyId = company.id;
    const subscription = await prisma.subscription.create({
      data: {
        companyId,
        tier: "CCTS_COMPLIANCE",
        status: "ACTIVE",
        razorpaySubscriptionId,
        facilitiesIncluded: 1,
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    subscriptionId = subscription.id;
  });

  afterEach(async () => {
    await prisma.payment.deleteMany({ where: { subscriptionId } });
    await prisma.subscription.deleteMany({ where: { companyId } });
    await prisma.company.deleteMany({ where: { id: companyId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  const statusNow = async () =>
    (await prisma.subscription.findUniqueOrThrow({ where: { id: subscriptionId } })).status;

  describe("payment.failed", () => {
    it("moves an ACTIVE subscription to PAST_DUE via the subscription entity", async () => {
      expect(await statusNow()).toBe("ACTIVE");

      await handleWebhookEvent({
        event: "payment.failed",
        payload: {
          subscription: { entity: { id: razorpaySubscriptionId } as never },
          payment: { entity: paymentEntity("order_no_prior_payment") as never },
        },
      });

      expect(await statusNow()).toBe("PAST_DUE");
    });

    it("falls back to matching a prior payment's order_id when no subscription entity is sent", async () => {
      const orderId = `order_test_${Date.now()}`;
      await prisma.payment.create({
        data: {
          subscriptionId,
          razorpayPaymentId: `pay_prior_${Date.now()}`,
          razorpayOrderId: orderId,
          amountInr: 14999,
          status: "captured",
          paidAt: new Date(),
        },
      });

      await handleWebhookEvent({
        event: "payment.failed",
        payload: { payment: { entity: paymentEntity(orderId) as never } },
      });

      expect(await statusNow()).toBe("PAST_DUE");
    });

    it("is a no-op when neither the subscription entity nor a prior order_id matches", async () => {
      await handleWebhookEvent({
        event: "payment.failed",
        payload: { payment: { entity: paymentEntity("order_belongs_to_nobody") as never } },
      });

      expect(await statusNow()).toBe("ACTIVE");
    });

    it("revokes access — a PAST_DUE subscription no longer covers a new facility", async () => {
      await handleWebhookEvent({
        event: "payment.failed",
        payload: {
          subscription: { entity: { id: razorpaySubscriptionId } as never },
          payment: { entity: paymentEntity("order_x") as never },
        },
      });

      // The business outcome that matters: capacity is granted off ACTIVE
      // subscriptions only, so a declined renewal actually withdraws access
      // rather than only relabelling the row. The company now reads as having
      // no subscription at all, not as one that's merely out of capacity.
      await expect(requireCapacityForNewFacility(companyId)).rejects.toMatchObject({
        code: "SUBSCRIPTION_REQUIRED",
      });
    });
  });

  describe("recovery and lifecycle", () => {
    it("subscription.charged brings a PAST_DUE subscription back to ACTIVE", async () => {
      await prisma.subscription.update({ where: { id: subscriptionId }, data: { status: "PAST_DUE" } });

      await handleWebhookEvent({
        event: "subscription.charged",
        payload: {
          subscription: {
            entity: { id: razorpaySubscriptionId, current_end: Math.floor(Date.now() / 1000) + 30 * 86400 } as never,
          },
        },
      });

      expect(await statusNow()).toBe("ACTIVE");
    });

    it("subscription.charged records the payment and preserves facility capacity", async () => {
      await prisma.subscription.update({ where: { id: subscriptionId }, data: { facilitiesIncluded: 5 } });

      await handleWebhookEvent({
        event: "subscription.charged",
        payload: {
          subscription: {
            entity: { id: razorpaySubscriptionId, current_end: Math.floor(Date.now() / 1000) + 30 * 86400 } as never,
          },
          payment: { entity: { id: `pay_ok_${Date.now()}`, order_id: "order_ok", amount: 7499500, status: "captured" } as never },
        },
      });

      const after = await prisma.subscription.findUniqueOrThrow({ where: { id: subscriptionId } });
      expect(after.status).toBe("ACTIVE");
      // A renewal must never silently reset a multi-facility plan back to 1.
      expect(after.facilitiesIncluded).toBe(5);
      expect(await prisma.payment.count({ where: { subscriptionId } })).toBe(1);
    });

    it("subscription.cancelled marks the subscription CANCELED", async () => {
      await handleWebhookEvent({
        event: "subscription.cancelled",
        payload: { subscription: { entity: { id: razorpaySubscriptionId } as never } },
      });

      expect(await statusNow()).toBe("CANCELED");
    });

    it("ignores an event for a subscription this system doesn't know about", async () => {
      await handleWebhookEvent({
        event: "subscription.cancelled",
        payload: { subscription: { entity: { id: "sub_not_ours" } as never } },
      });

      expect(await statusNow()).toBe("ACTIVE");
    });
  });

  describe("signature verification", () => {
    const secret = WEBHOOK_SECRET;
    const body = JSON.stringify({ event: "payment.failed" });
    // Same HMAC-SHA256 hex digest Razorpay sends in x-razorpay-signature.
    const validSignature = () =>
      crypto.createHmac("sha256", secret).update(body).digest("hex");

    it("accepts a body signed with the configured secret", () => {
      expect(verifyWebhookSignature(body, validSignature())).toBe(true);
    });

    it("rejects a tampered body", () => {
      const sig = validSignature();
      expect(verifyWebhookSignature(JSON.stringify({ event: "subscription.charged" }), sig)).toBe(false);
    });

    it("rejects a signature of the wrong length without throwing", () => {
      expect(() => verifyWebhookSignature(body, "tooshort")).not.toThrow();
      expect(verifyWebhookSignature(body, "tooshort")).toBe(false);
    });

    it("rejects an empty signature", () => {
      expect(verifyWebhookSignature(body, "")).toBe(false);
    });
  });
});
