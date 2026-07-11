import crypto from "crypto";
import type { Subscription, SubscriptionStatus, SubscriptionTier } from "@prisma/client";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { isRazorpayConfigured, razorpay } from "../config/razorpay";
import { AppError } from "../utils/AppError";
import { logger } from "../utils/logger";
import { getPlan, PLANS, COMBINATION_RULES, findMergeCandidate } from "../data/plans";
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
  return { subscriptions, usage, plans: Object.values(PLANS), combinationRules: COMBINATION_RULES };
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
  logger.warn(`[Billing] dev-bypass checkout — company=${companyId} tier=${tier} activated with no payment collected`);
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

// Roughly logs the unused-time value of a plan being replaced mid-cycle, for
// manual reconciliation — Razorpay's in-place plan update doesn't always
// auto-credit the difference, and the cancel+recreate fallback never does.
// Not stored anywhere structured; this is a paper trail, not a ledger entry.
const logProratedCredit = (companyId: string, oldSub: Subscription, combinedTier: SubscriptionTier) => {
  const oldPriceInr = getPlan(oldSub.tier).priceInr ?? 0;
  const remainingMs = oldSub.currentPeriodEnd ? Math.max(0, oldSub.currentPeriodEnd.getTime() - Date.now()) : 0;
  const creditInr = Math.round((remainingMs / (30 * DAY_MS)) * oldPriceInr);
  logger.info(
    `[Billing] Merge proration: company=${companyId} ${oldSub.tier} -> ${combinedTier} — ` +
      `≈₹${creditInr} unused credit (${Math.round(remainingMs / DAY_MS)} days left on the old cycle). ` +
      `Not automatically refunded by Razorpay — flag for manual reconciliation if the customer raises it.`,
  );
};

// Cancels/relabels the obsolete single-framework rows and creates (or
// reactivates) the combined-tier row, all in one transaction. Shared by both
// the dev-bypass and real-Razorpay merge paths below — they differ only in
// what `newSubscriptionData` and the Razorpay side effects look like.
// The obsolete rows are freed of their razorpaySubscriptionId *before* the
// combined row claims it, since that column has a unique constraint that's
// checked per-statement even inside a transaction — reusing the id in the
// same write the old row still holds it would violate that constraint.
const applyMergeTransaction = async (
  companyId: string,
  obsoleteSubscriptions: Subscription[],
  combinedTier: SubscriptionTier,
  newSubscriptionData: {
    status: SubscriptionStatus;
    razorpayCustomerId?: string;
    razorpaySubscriptionId?: string;
    currentPeriodEnd?: Date;
  },
): Promise<Subscription> =>
  prisma.$transaction(async (tx) => {
    for (const old of obsoleteSubscriptions) {
      await tx.subscription.update({
        where: { id: old.id },
        data: { status: "CANCELED", cancelAtPeriodEnd: false, razorpaySubscriptionId: null },
      });
    }

    const combined = await tx.subscription.upsert({
      where: { companyId_tier: { companyId, tier: combinedTier } },
      create: { companyId, tier: combinedTier, ...newSubscriptionData },
      update: newSubscriptionData,
    });

    for (const old of obsoleteSubscriptions) {
      await tx.subscription.update({ where: { id: old.id }, data: { mergedIntoId: combined.id } });
    }

    return combined;
  });

/**
 * Replaces one or more obsolete single-framework subscriptions with the
 * combined tier they complete (e.g. CCTS_COMPLIANCE + CBAM_COMPLIANCE ->
 * CBAM_PLUS_CCTS) instead of letting the company end up with two separate
 * full-price subscriptions. Prefers an in-place Razorpay plan change on the
 * existing subscription (preserves billing history, no double charge); if
 * that's rejected, cancels the old Razorpay subscription immediately and
 * creates a fresh one for the combined plan.
 */
const performMerge = async (companyId: string, obsoleteSubscriptions: Subscription[], combinedTier: SubscriptionTier) => {
  for (const old of obsoleteSubscriptions) {
    logProratedCredit(companyId, old, combinedTier);
  }

  if (!isRazorpayConfigured || !razorpay) {
    logger.warn(`[Billing] dev-bypass merge — company=${companyId} tier=${combinedTier} activated with no payment collected`);
    const combined = await applyMergeTransaction(companyId, obsoleteSubscriptions, combinedTier, {
      status: "ACTIVE",
      currentPeriodEnd: new Date(Date.now() + 30 * DAY_MS),
    });
    const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId }, include: { owner: true } });
    sendSubscriptionActivatedEmail(company.owner.email, getPlan(combinedTier).name).catch(() => {});
    return { devBypass: true as const, merged: true as const, subscription: combined };
  }

  const planId = planIdForTier(combinedTier);
  const primary = obsoleteSubscriptions.find((s) => s.razorpaySubscriptionId) ?? obsoleteSubscriptions[0];
  const razorpayCustomerId = primary.razorpayCustomerId ?? undefined;

  let razorpaySubscriptionId: string;
  try {
    if (!primary.razorpaySubscriptionId) {
      throw new Error("No existing Razorpay subscription to update in place");
    }
    const updated = await razorpay.subscriptions.update(primary.razorpaySubscriptionId, {
      plan_id: planId,
      schedule_change_at: "now",
    });
    razorpaySubscriptionId = updated.id;
    logger.info(`[Billing] Merged in place on existing Razorpay subscription ${razorpaySubscriptionId} for company=${companyId}`);
  } catch (err) {
    logger.warn(
      `[Billing] In-place Razorpay plan swap failed for company=${companyId} — cancelling the old subscription and creating a new one for ${combinedTier} instead`,
      err,
    );
    if (primary.razorpaySubscriptionId) {
      // false = cancel immediately, not at cycle end — this is an upgrade, not a downgrade/exit.
      await razorpay.subscriptions.cancel(primary.razorpaySubscriptionId, false);
    }
    const created = await razorpay.subscriptions.create({
      plan_id: planId,
      customer_notify: 1,
      total_count: 120,
      notes: { companyId, tier: combinedTier },
    });
    razorpaySubscriptionId = created.id;
  }

  const combined = await applyMergeTransaction(companyId, obsoleteSubscriptions, combinedTier, {
    status: "INCOMPLETE",
    razorpayCustomerId,
    razorpaySubscriptionId,
  });

  return {
    devBypass: false as const,
    merged: true as const,
    razorpayKeyId: env.RAZORPAY_KEY_ID,
    razorpaySubscriptionId,
    subscription: combined,
  };
};

export const createCheckout = async (companyId: string, tier: SubscriptionTier) => {
  // Detect a combination opportunity before doing anything else — this runs
  // regardless of whether the caller requested a single-framework tier that
  // now completes a combo (e.g. CBAM while CCTS is active) or the combined
  // tier directly (e.g. the frontend already offered the upgrade and the
  // user accepted it). Either way, a company must never end up with two
  // separate full-price subscriptions where a cheaper combined tier exists —
  // that's a hard pricing rule, enforced here rather than trusted to the
  // frontend alone.
  const activeSubscriptions = await prisma.subscription.findMany({ where: { companyId, status: "ACTIVE" } });
  const mergeCandidate = findMergeCandidate(
    activeSubscriptions.map((s) => s.tier),
    tier,
  );
  if (mergeCandidate) {
    const obsolete = activeSubscriptions.filter((s) => mergeCandidate.obsoleteTiers.includes(s.tier));
    return performMerge(companyId, obsolete, mergeCandidate.rule.combinedTier);
  }

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
