import crypto from "crypto";
import type { SubscriptionTier } from "@prisma/client";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { isRazorpayConfigured, razorpay } from "../config/razorpay";
import { AppError } from "../utils/AppError";
import { getPlan, PLANS } from "../data/plans";
import { sendSubscriptionActivatedEmail, sendPaymentFailedEmail } from "./email.service";

const DAY_MS = 24 * 60 * 60 * 1000;

const planIdForTier = (tier: SubscriptionTier): string => {
  const plan = getPlan(tier);
  if (!plan.razorpayPlanIdEnvVar) {
    throw AppError.badRequest(
      `${plan.name} is not available for self-serve checkout — contact sales`,
      "PLAN_NOT_SELF_SERVE",
    );
  }
  const planId = process.env[plan.razorpayPlanIdEnvVar];
  if (!planId) {
    throw AppError.badRequest(
      `Razorpay plan ID for ${plan.name} is not configured (${plan.razorpayPlanIdEnvVar})`,
      "PLAN_NOT_CONFIGURED",
    );
  }
  return planId;
};

export const getUsage = async (companyId: string) => {
  const facilityCount = await prisma.facility.count({ where: { companyId } });
  return { facilityCount };
};

// A company can hold several tiers at once (each bought/cancelled independently) —
// e.g. CBAM_COMPLIANCE plus BRSR_CORE_REPORTING bought as a standalone add-on,
// rather than only via a pre-bundled combo tier like CBAM_PLUS_CCTS. See the
// `@@unique([companyId, tier])` comment on the Subscription model.
export const getSubscriptions = async (companyId: string) => {
  const subscriptions = await prisma.subscription.findMany({
    where: { companyId },
    orderBy: { createdAt: "asc" },
  });
  const usage = await getUsage(companyId);
  return { subscriptions, usage, plans: Object.values(PLANS) };
};

export const requireCapacityForNewFacility = async (companyId: string): Promise<void> => {
  const subscriptions = await prisma.subscription.findMany({
    where: { companyId, status: "ACTIVE" },
  });

  if (subscriptions.length === 0) {
    throw AppError.forbidden(
      "An active subscription is required to add facilities",
      "SUBSCRIPTION_REQUIRED",
    );
  }

  const limits = subscriptions.map((s) => getPlan(s.tier).facilityLimit);
  if (limits.some((limit) => limit === null)) return;

  // Every active tier is billed per-facility with a finite cap — combined
  // capacity is additive across tiers rather than the single most permissive one.
  const totalLimit = (limits as number[]).reduce((sum, limit) => sum + limit, 0);

  const { facilityCount } = await getUsage(companyId);
  if (facilityCount >= totalLimit) {
    throw AppError.forbidden(
      `Your current plan(s) are limited to ${totalLimit} facilit${totalLimit === 1 ? "y" : "ies"} combined. Upgrade to add more.`,
      "PLAN_LIMIT_REACHED",
    );
  }
};

const devBypassCheckout = async (companyId: string, tier: SubscriptionTier) => {
  const subscription = await prisma.subscription.upsert({
    where: { companyId_tier: { companyId, tier } },
    create: {
      companyId,
      tier,
      status: "ACTIVE",
      currentPeriodEnd: new Date(Date.now() + 30 * DAY_MS),
    },
    update: {
      status: "ACTIVE",
      cancelAtPeriodEnd: false,
      currentPeriodEnd: new Date(Date.now() + 30 * DAY_MS),
    },
  });

  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    include: { owner: true },
  });
  sendSubscriptionActivatedEmail(company.owner.email, getPlan(tier).name).catch(() => {});

  return { devBypass: true as const, subscription };
};

export const createCheckout = async (companyId: string, tier: SubscriptionTier) => {
  if (!isRazorpayConfigured || !razorpay) {
    return devBypassCheckout(companyId, tier);
  }

  const planId = planIdForTier(tier);

  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    include: { owner: true },
  });

  // Any of the company's existing subscriptions carries the same Razorpay
  // customer id — reuse it instead of creating a duplicate customer per tier.
  const existingForCompany = await prisma.subscription.findFirst({
    where: { companyId, razorpayCustomerId: { not: null } },
  });

  let razorpayCustomerId = existingForCompany?.razorpayCustomerId ?? undefined;
  if (!razorpayCustomerId) {
    const customer = await razorpay.customers.create({
      name: company.owner.name,
      email: company.owner.email,
      notes: { companyId },
    });
    razorpayCustomerId = customer.id;
  }

  const razorpaySubscription = await razorpay.subscriptions.create({
    plan_id: planId,
    customer_notify: 1,
    total_count: 120,
    notes: { companyId, tier },
  });

  const subscription = await prisma.subscription.upsert({
    where: { companyId_tier: { companyId, tier } },
    create: {
      companyId,
      tier,
      status: "INCOMPLETE",
      razorpayCustomerId,
      razorpaySubscriptionId: razorpaySubscription.id,
    },
    update: {
      status: "INCOMPLETE",
      razorpayCustomerId,
      razorpaySubscriptionId: razorpaySubscription.id,
    },
  });

  return {
    devBypass: false as const,
    razorpayKeyId: env.RAZORPAY_KEY_ID,
    razorpaySubscriptionId: razorpaySubscription.id,
    subscription,
  };
};

export const cancelSubscription = async (companyId: string, tier: SubscriptionTier) => {
  const subscription = await prisma.subscription.findUnique({
    where: { companyId_tier: { companyId, tier } },
  });
  if (!subscription) {
    throw AppError.notFound("No subscription found for this company and plan");
  }

  if (isRazorpayConfigured && razorpay && subscription.razorpaySubscriptionId) {
    await razorpay.subscriptions.cancel(subscription.razorpaySubscriptionId, true);
    return prisma.subscription.update({
      where: { companyId_tier: { companyId, tier } },
      data: { cancelAtPeriodEnd: true },
    });
  }

  return prisma.subscription.update({
    where: { companyId_tier: { companyId, tier } },
    data: { status: "CANCELED", cancelAtPeriodEnd: true },
  });
};

export const verifyWebhookSignature = (rawBody: string, signature: string): boolean => {
  if (!env.RAZORPAY_WEBHOOK_SECRET) return false;
  const expected = crypto
    .createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");
  const expectedBuf = Buffer.from(expected);
  const candidateBuf = Buffer.from(signature || "");
  // timingSafeEqual throws on length mismatch rather than returning false —
  // an attacker-controlled header of the wrong length must still fail
  // closed, not 500. Lengths are compared in the open first since the
  // expected digest is fixed-length and not itself secret.
  if (expectedBuf.length !== candidateBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, candidateBuf);
};

interface RazorpaySubscriptionEntity {
  id: string;
  status: string;
  current_end?: number;
  notes?: { companyId?: string; tier?: string };
}

interface RazorpayPaymentEntity {
  id: string;
  order_id?: string;
  amount: number;
  status: string;
}

export const handleWebhookEvent = async (event: {
  event: string;
  payload: {
    subscription?: { entity: RazorpaySubscriptionEntity };
    payment?: { entity: RazorpayPaymentEntity };
  };
}): Promise<void> => {
  const subscriptionEntity = event.payload.subscription?.entity;
  const paymentEntity = event.payload.payment?.entity;

  if (subscriptionEntity) {
    const subscription = await prisma.subscription.findUnique({
      where: { razorpaySubscriptionId: subscriptionEntity.id },
    });
    if (!subscription) return;

    if (event.event === "subscription.activated" || event.event === "subscription.charged") {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: "ACTIVE",
          currentPeriodEnd: subscriptionEntity.current_end
            ? new Date(subscriptionEntity.current_end * 1000)
            : undefined,
        },
      });

      if (paymentEntity) {
        await prisma.payment.create({
          data: {
            subscriptionId: subscription.id,
            razorpayPaymentId: paymentEntity.id,
            razorpayOrderId: paymentEntity.order_id,
            amountInr: paymentEntity.amount / 100,
            status: paymentEntity.status,
            paidAt: new Date(),
          },
        });
      }

      const company = await prisma.company.findUnique({
        where: { id: subscription.companyId },
        include: { owner: true },
      });
      if (company) {
        sendSubscriptionActivatedEmail(company.owner.email, getPlan(subscription.tier).name).catch(() => {});
      }
    }

    if (event.event === "subscription.cancelled" || event.event === "subscription.completed") {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: "CANCELED" },
      });
    }
  }

  if (event.event === "payment.failed" && paymentEntity) {
    const subscription = await prisma.subscription.findFirst({
      where: { payments: { some: { razorpayOrderId: paymentEntity.order_id } } },
    });
    if (subscription) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: "PAST_DUE" },
      });
      const company = await prisma.company.findUnique({
        where: { id: subscription.companyId },
        include: { owner: true },
      });
      if (company) {
        sendPaymentFailedEmail(company.owner.email).catch(() => {});
      }
    }
  }
};
