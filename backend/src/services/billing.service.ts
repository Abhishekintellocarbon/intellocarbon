import crypto from "crypto";
import * as Sentry from "@sentry/node";
import type { Subscription, SubscriptionStatus, SubscriptionTier } from "@prisma/client";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { isRazorpayConfigured, razorpay } from "../config/razorpay";
import { AppError } from "../utils/AppError";
import { logger } from "../utils/logger";
import {
  getPlan,
  PLANS,
  COMBINATION_RULES,
  findMergeCandidate,
  ONBOARDING_FEE_ADDITIONAL_FACILITY_INR,
  onboardingFeeInr,
} from "../data/plans";
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
  // Trimmed here too: this reads process.env directly rather than the parsed
  // `env` object, so it doesn't inherit that schema's trim.
  const planId = process.env[plan.razorpayPlanIdEnvVar]?.trim();
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

// Facility capacity a single active subscription row currently covers — a
// custom-deal's negotiated count overrides the self-serve facilitiesIncluded
// counter for that row.
const facilityCapacityOf = (s: Pick<Subscription, "isCustomDeal" | "customFacilityCount" | "facilitiesIncluded">) =>
  s.isCustomDeal && s.customFacilityCount != null ? s.customFacilityCount : s.facilitiesIncluded;

// A company can hold several tiers at once (each bought/cancelled independently) —
// e.g. CBAM_COMPLIANCE plus BRSR_CORE_REPORTING bought as a standalone add-on,
// rather than only via a pre-bundled combo tier like CBAM_PLUS_CCTS. See the
// `@@unique([companyId, tier])` comment on the Subscription model.
export const getSubscriptions = async (companyId: string) => {
  // Independent reads (usage doesn't depend on the subscriptions list) —
  // run concurrently rather than as two sequential round trips.
  const [subscriptions, usage, company] = await Promise.all([
    prisma.subscription.findMany({
      where: { companyId },
      orderBy: { createdAt: "asc" },
    }),
    getUsage(companyId),
    prisma.company.findUnique({ where: { id: companyId }, select: { onboardingFeePaidAt: true } }),
  ]);
  // Shown on the billing page next to an already-active plan so a company
  // adding a facility sees what it costs before confirming.
  const enriched = subscriptions.map((s) => ({
    ...s,
    additionalFacilityMonthlyInr:
      s.status === "ACTIVE" && !s.isCustomDeal ? getAdditionalFacilityMonthlyInr(s) : null,
  }));
  return {
    subscriptions: enriched,
    usage,
    plans: Object.values(PLANS),
    combinationRules: COMBINATION_RULES,
    // Drives whether checkout quotes the one-time fee at all — a company that
    // has already settled it (or was grandfathered) must not see it again.
    onboardingFeeSettled: company?.onboardingFeePaidAt != null,
  };
};

/**
 * One-time-per-deploy audit log, not a request-path check — companies with
 * an active ESG Disclosure Bundle (BRSR_CORE_REPORTING) subscription from
 * before the 31 Jul 2026 repricing (₹14,999 -> ₹19,999/facility/mo). Purely
 * informational: Razorpay only bills against the specific Plan object a
 * subscription was created on (see plans.ts's BRSR_CORE_REPORTING comment),
 * so these companies keep paying their originally-agreed price with no
 * code-side action — this just makes them visible for manual review rather
 * than silently forgotten. Called once at server startup (see server.ts).
 */
export const logGrandfatheredEsgBundleSubscribers = async (): Promise<void> => {
  const subs = await prisma.subscription.findMany({
    where: { tier: "BRSR_CORE_REPORTING", status: "ACTIVE" },
    include: { company: { select: { id: true, name: true } } },
  });
  if (subs.length === 0) return;

  const list = subs.map((s) => `${s.company.name} (company ${s.company.id}, subscription ${s.id})`).join("; ");
  logger.warn(
    `[ESG Bundle repricing review] ${subs.length} compan${subs.length === 1 ? "y has" : "ies have"} an active ` +
      `ESG Disclosure Bundle subscription predating the 31 Jul 2026 repricing (₹14,999 -> ₹19,999/facility/mo). ` +
      `Not auto-charged the difference — review manually: ${list}`,
  );
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

  // Every active tier is billed per-facility — combined capacity is additive
  // across tiers, not the single most permissive one.
  const totalCovered = subscriptions.reduce((sum, s) => sum + facilityCapacityOf(s), 0);

  const { facilityCount } = await getUsage(companyId);
  if (facilityCount >= totalCovered) {
    throw AppError.forbidden(
      `Your current plan covers ${totalCovered} facilit${totalCovered === 1 ? "y" : "ies"}. Add another facility subscription to continue, or upgrade your plan.`,
      "PLAN_LIMIT_REACHED",
    );
  }
};

// Single source of truth for "make this (company, tier) subscription
// ACTIVE" — used by the Razorpay webhook, the dev-bypass checkout path, and
// the Super Admin manual-payment flow, so none of them fork their own copy
// of this logic. Upserts rather than requiring an existing row since any of
// the three callers may be the very first activation for that tier.
// `facilitiesIncluded` only applies to a brand-new subscription (the
// `create` branch) — a renewal or reactivation (`update`) must never reset
// it, since that would silently erase capacity bought later via
// addFacilityCapacity. Callers that don't care (the webhook, manual
// payments) simply don't pass it and get the schema's default of 1.
export const activateSubscriptionForTier = async (
  companyId: string,
  tier: SubscriptionTier,
  currentPeriodEnd?: Date,
  facilitiesIncluded = 1,
): Promise<Subscription> => {
  const subscription = await prisma.subscription.upsert({
    where: { companyId_tier: { companyId, tier } },
    create: {
      companyId,
      tier,
      status: "ACTIVE",
      currentPeriodEnd,
      facilitiesIncluded,
    },
    update: {
      status: "ACTIVE",
      cancelAtPeriodEnd: false,
      currentPeriodEnd,
    },
  });

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: { owner: true },
  });
  if (company) {
    sendSubscriptionActivatedEmail(company.owner.email, getPlan(tier).name).catch(() => {});
  }

  return subscription;
};

// Single source of truth for "mark this subscription PAST_DUE" — used by
// the Razorpay webhook's payment.failed handler and the Super Admin
// manual-payment reversal flow.
export const markSubscriptionPastDue = async (subscriptionId: string): Promise<Subscription> => {
  const subscription = await prisma.subscription.update({
    where: { id: subscriptionId },
    data: { status: "PAST_DUE" },
  });

  const company = await prisma.company.findUnique({
    where: { id: subscription.companyId },
    include: { owner: true },
  });
  if (company) {
    sendPaymentFailedEmail(company.owner.email).catch(() => {});
  }

  return subscription;
};

/**
 * Records the onboarding fee as settled once the payment that carried it
 * actually succeeds — never at checkout creation, so a customer who opens the
 * modal and walks away is still charged on their next attempt.
 *
 * Razorpay bills a creation-time add-on on the first invoice, so the money
 * arrives in the same authorisation payment that activates the subscription.
 * Guarded on the company still being unsettled, which makes a replayed or
 * duplicated webhook a no-op rather than a second write.
 */
const settleOnboardingFeeIfCharged = async (subscription: Subscription): Promise<void> => {
  if (subscription.onboardingFeeChargedInr == null) return;

  const { count } = await prisma.company.updateMany({
    where: { id: subscription.companyId, onboardingFeePaidAt: null },
    data: { onboardingFeePaidAt: new Date(), onboardingFeePaidInr: subscription.onboardingFeeChargedInr },
  });

  if (count > 0) {
    logger.info(
      `[Billing] Onboarding fee of ₹${subscription.onboardingFeeChargedInr} settled for company=${subscription.companyId} ` +
        `via subscription ${subscription.razorpaySubscriptionId} — it will not be charged again.`,
    );
  }
};

/**
 * Turns a raw Razorpay SDK rejection during checkout into the same shape
 * addFacilityCapacity produces: the real error goes to the logs, the caller
 * gets a plain sentence it can show. Without this the SDK error propagated
 * unwrapped, so the client saw the generic 500 body ("Something went wrong")
 * with no indication that billing specifically had failed.
 *
 * Reported to Sentry explicitly because AppError becomes a 4xx, and Sentry's
 * express handler only captures 5xx — so converting these to AppError would
 * otherwise have silently dropped checkout failures out of error monitoring,
 * which is where you'd look first when payments stop working.
 */
const razorpayCheckoutFailure = (action: string, companyId: string, tier: SubscriptionTier, err: unknown): AppError => {
  logger.error(`[Billing] Failed to ${action} for company=${companyId} tier=${tier}`, err);
  Sentry.captureException(err, { tags: { area: "billing", action }, extra: { companyId, tier } });
  return AppError.badRequest(
    "Couldn't start checkout — please try again or contact support",
    "RAZORPAY_CHECKOUT_FAILED",
  );
};

const devBypassCheckout = async (companyId: string, tier: SubscriptionTier, facilitiesIncluded: number) => {
  // The onboarding fee is deliberately left unsettled here: nothing was
  // collected, so the company still owes it on a real checkout.
  logger.warn(
    `[Billing] dev-bypass checkout — company=${companyId} tier=${tier} activated with no payment collected ` +
      `(neither the subscription nor the ₹${onboardingFeeInr(facilitiesIncluded)} onboarding fee)`,
  );
  const subscription = await activateSubscriptionForTier(companyId, tier, new Date(Date.now() + 30 * DAY_MS), facilitiesIncluded);
  return { devBypass: true as const, subscription };
};

// Shared proration basis for both the merge-credit paper trail below and the
// "what would one more facility cost right now" quote shown on the billing
// page — a flat 30-day cycle approximation, not calendar-accurate billing
// (Razorpay's own proration is the source of truth for what's actually
// charged; this is only ever a preview/log, never charged directly).
const prorateForRemainingCycle = (currentPeriodEnd: Date | null | undefined, fullPriceInr: number): number => {
  if (!currentPeriodEnd) return fullPriceInr;
  const remainingMs = Math.max(0, currentPeriodEnd.getTime() - Date.now());
  if (remainingMs <= 0) return fullPriceInr;
  return Math.round((remainingMs / (30 * DAY_MS)) * fullPriceInr);
};

// Roughly logs the unused-time value of a plan being replaced mid-cycle, for
// manual reconciliation — Razorpay's in-place plan update doesn't always
// auto-credit the difference, and the cancel+recreate fallback never does.
// Not stored anywhere structured; this is a paper trail, not a ledger entry.
const logProratedCredit = (companyId: string, oldSub: Subscription, combinedTier: SubscriptionTier) => {
  const oldPriceInr = getPlan(oldSub.tier).priceInr ?? 0;
  const creditInr = prorateForRemainingCycle(oldSub.currentPeriodEnd, oldPriceInr);
  const remainingMs = oldSub.currentPeriodEnd ? Math.max(0, oldSub.currentPeriodEnd.getTime() - Date.now()) : 0;
  logger.info(
    `[Billing] Merge proration: company=${companyId} ${oldSub.tier} -> ${combinedTier} — ` +
      `≈₹${creditInr} unused credit (${Math.round(remainingMs / DAY_MS)} days left on the old cycle). ` +
      `Not automatically refunded by Razorpay — flag for manual reconciliation if the customer raises it.`,
  );
};

/**
 * What one more facility adds to this subscription's monthly charge, shown on
 * the billing page before the company confirms.
 *
 * The full per-facility price, not a prorated remainder: the capacity change
 * is scheduled at cycle_end (see addFacilityCapacity), so nothing is charged
 * mid-cycle and the company simply pays this much more from its next invoice
 * onward. This previously returned a flat-30-day prorated approximation of
 * the current cycle's remainder, which both contradicted the billing page's
 * own FAQ and was never guaranteed to match what Razorpay actually charged.
 */
export const getAdditionalFacilityMonthlyInr = (subscription: Pick<Subscription, "tier">): number =>
  getPlan(subscription.tier).priceInr ?? 0;

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
    facilitiesIncluded: number;
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
const performMerge = async (
  companyId: string,
  obsoleteSubscriptions: Subscription[],
  combinedTier: SubscriptionTier,
  requestedFacilitiesIncluded = 1,
) => {
  for (const old of obsoleteSubscriptions) {
    logProratedCredit(companyId, old, combinedTier);
  }

  // The combined plan must cover at least as many facilities as whichever
  // constituent plan already covered the most — merging must never shrink
  // capacity a company already paid for.
  const facilitiesIncluded = Math.max(requestedFacilitiesIncluded, ...obsoleteSubscriptions.map(facilityCapacityOf));

  if (!isRazorpayConfigured || !razorpay) {
    logger.warn(`[Billing] dev-bypass merge — company=${companyId} tier=${combinedTier} activated with no payment collected`);
    const combined = await applyMergeTransaction(companyId, obsoleteSubscriptions, combinedTier, {
      status: "ACTIVE",
      currentPeriodEnd: new Date(Date.now() + 30 * DAY_MS),
      facilitiesIncluded,
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
      quantity: facilitiesIncluded,
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
      quantity: facilitiesIncluded,
      notes: { companyId, tier: combinedTier },
    });
    razorpaySubscriptionId = created.id;
  }

  const combined = await applyMergeTransaction(companyId, obsoleteSubscriptions, combinedTier, {
    status: "INCOMPLETE",
    razorpayCustomerId,
    razorpaySubscriptionId,
    facilitiesIncluded,
  });

  return {
    devBypass: false as const,
    merged: true as const,
    razorpayKeyId: env.RAZORPAY_KEY_ID,
    razorpaySubscriptionId,
    subscription: combined,
  };
};

export const createCheckout = async (companyId: string, tier: SubscriptionTier, facilitiesIncluded = 1) => {
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
    return performMerge(companyId, obsolete, mergeCandidate.rule.combinedTier, facilitiesIncluded);
  }

  if (!isRazorpayConfigured || !razorpay) {
    return devBypassCheckout(companyId, tier, facilitiesIncluded);
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
    try {
      const customer = await razorpay.customers.create({
        name: company.owner.name,
        email: company.owner.email,
        notes: { companyId },
      });
      razorpayCustomerId = customer.id;
    } catch (err) {
      throw razorpayCheckoutFailure("create a Razorpay customer", companyId, tier, err);
    }
  }

  // Charged once per company. A company that has already settled it — including
  // one grandfathered at migration time — gets no add-on, so a second tier
  // never re-bills it.
  const onboardingFeeChargedInr = company.onboardingFeePaidAt ? null : onboardingFeeInr(facilitiesIncluded);

  let razorpaySubscription: { id: string };
  try {
    razorpaySubscription = await razorpay.subscriptions.create({
      plan_id: planId,
      customer_notify: 1,
      total_count: 120,
      quantity: facilitiesIncluded,
      notes: { companyId, tier },
      // Razorpay bills an add-on passed at creation on the subscription's
      // *first* invoice only, in the same authorisation payment as the first
      // month. That is what makes this a single checkout modal, and it is
      // also why later invoices are plan-price-only without us doing anything
      // — the add-on is attached to the invoice, never to the plan.
      ...(onboardingFeeChargedInr
        ? {
            addons: [
              {
                item: {
                  name: "One-time onboarding fee",
                  amount: onboardingFeeChargedInr * 100, // paise
                  currency: "INR",
                },
              },
            ],
          }
        : {}),
    });
  } catch (err) {
    throw razorpayCheckoutFailure("create the Razorpay subscription", companyId, tier, err);
  }

  const subscription = await prisma.subscription.upsert({
    where: { companyId_tier: { companyId, tier } },
    create: {
      companyId,
      tier,
      status: "INCOMPLETE",
      razorpayCustomerId,
      razorpaySubscriptionId: razorpaySubscription.id,
      facilitiesIncluded,
      onboardingFeeChargedInr,
    },
    update: {
      status: "INCOMPLETE",
      razorpayCustomerId,
      razorpaySubscriptionId: razorpaySubscription.id,
      onboardingFeeChargedInr,
    },
  });

  return {
    devBypass: false as const,
    razorpayKeyId: env.RAZORPAY_KEY_ID,
    razorpaySubscriptionId: razorpaySubscription.id,
    onboardingFeeChargedInr,
    subscription,
  };
};

/**
 * Raises the ₹10,000 per-additional-facility onboarding fee as a Razorpay
 * add-on against the company's existing subscription. Razorpay attaches an
 * add-on to the *next* invoice that subscription generates — it is not an
 * immediate charge, so the company is billed at its next renewal alongside
 * the recurring amount.
 *
 * Deliberately raised *after* the quantity update succeeds, and deliberately
 * non-fatal: by that point the capacity increase is already live in Razorpay
 * and in the response the caller is about to get. Throwing here would leave
 * the company holding capacity it appears to have bought while the request
 * reports failure — a worse state than an uncollected fee, which the ERROR
 * log and Sentry event below make recoverable by manual invoice.
 */
const raiseAdditionalFacilityOnboardingFee = async (
  razorpaySubscriptionId: string,
  companyId: string,
  tier: SubscriptionTier,
): Promise<void> => {
  // Only ever reached from the configured branch of addFacilityCapacity, but
  // checked rather than asserted so a future caller can't smuggle in a null.
  if (!razorpay) return;

  try {
    const addon = await razorpay.subscriptions.createAddon(razorpaySubscriptionId, {
      item: {
        name: "One-time onboarding fee — additional facility",
        amount: ONBOARDING_FEE_ADDITIONAL_FACILITY_INR * 100, // Razorpay amounts are in paise.
        currency: "INR",
      },
      quantity: 1,
    });
    logger.info(
      `[Billing] Raised ₹${ONBOARDING_FEE_ADDITIONAL_FACILITY_INR} additional-facility onboarding fee ` +
        `(addon ${addon.id}) on subscription ${razorpaySubscriptionId} for company=${companyId} tier=${tier} — ` +
        `bills on that subscription's next invoice`,
    );
  } catch (err) {
    logger.error(
      `[Billing] UNCOLLECTED ₹${ONBOARDING_FEE_ADDITIONAL_FACILITY_INR} onboarding fee — failed to raise the add-on ` +
        `on subscription ${razorpaySubscriptionId} for company=${companyId} tier=${tier}. ` +
        `The facility capacity WAS granted; invoice this fee manually.`,
      err,
    );
    Sentry.captureException(err, {
      tags: { area: "billing", action: "onboarding-fee-addon" },
      extra: { companyId, tier, razorpaySubscriptionId, amountInr: ONBOARDING_FEE_ADDITIONAL_FACILITY_INR },
    });
  }
};

/**
 * Adds one facility's worth of capacity to an already-active subscription
 * (facilitiesIncluded += 1), mirrored onto Razorpay by bumping that
 * subscription's `quantity` (plans are priced per facility, so quantity is
 * the natural unit — same field the initial checkout sets, see
 * createCheckout). Dev-bypass mode just increments the counter and logs,
 * matching devBypassCheckout's pattern elsewhere in this file.
 */
export const addFacilityCapacity = async (companyId: string, tier: SubscriptionTier): Promise<Subscription> => {
  const subscription = await prisma.subscription.findUnique({
    where: { companyId_tier: { companyId, tier } },
  });
  if (!subscription || subscription.status !== "ACTIVE") {
    throw AppError.badRequest(
      `You don't have an active ${getPlan(tier).name} subscription to add a facility to — subscribe to this plan first`,
      "NO_ACTIVE_SUBSCRIPTION",
    );
  }
  if (subscription.isCustomDeal) {
    throw AppError.badRequest(
      "This plan has a custom negotiated facility count — contact support to change it",
      "CUSTOM_DEAL_FACILITY_COUNT",
    );
  }

  const newCount = subscription.facilitiesIncluded + 1;
  const additionalMonthlyInr = getAdditionalFacilityMonthlyInr(subscription);

  if (isRazorpayConfigured && razorpay && subscription.razorpaySubscriptionId) {
    try {
      await razorpay.subscriptions.update(subscription.razorpaySubscriptionId, {
        quantity: newCount,
        // cycle_end, not now: the billing page tells customers a new facility
        // "increases your monthly charge starting from your next billing
        // cycle". Charging a prorated amount mid-cycle contradicted that, and
        // the extra capacity is usable immediately either way because access
        // is gated on our own facilitiesIncluded, not on Razorpay's quantity.
        schedule_change_at: "cycle_end",
      });
    } catch (err) {
      logger.error(
        `[Billing] Failed to update Razorpay subscription quantity for company=${companyId} tier=${tier}`,
        err,
      );
      throw AppError.badRequest(
        "Couldn't update your billing plan capacity — please try again or contact support",
        "RAZORPAY_QUANTITY_UPDATE_FAILED",
      );
    }

    await raiseAdditionalFacilityOnboardingFee(subscription.razorpaySubscriptionId, companyId, tier);
  } else {
    logger.warn(
      `[Billing] dev-bypass facility add-on — company=${companyId} tier=${tier} facilitiesIncluded ${subscription.facilitiesIncluded} -> ${newCount}, ` +
        `+₹${additionalMonthlyInr}/mo from the next cycle and a ₹${ONBOARDING_FEE_ADDITIONAL_FACILITY_INR} onboarding fee, neither actually collected`,
    );
  }

  return prisma.subscription.update({
    where: { id: subscription.id },
    data: { facilitiesIncluded: newCount },
  });
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
      await activateSubscriptionForTier(
        subscription.companyId,
        subscription.tier,
        subscriptionEntity.current_end ? new Date(subscriptionEntity.current_end * 1000) : undefined,
      );

      await settleOnboardingFeeIfCharged(subscription);

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
    }

    if (event.event === "subscription.cancelled" || event.event === "subscription.completed") {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: "CANCELED" },
      });
    }
  }

  if (event.event === "payment.failed" && paymentEntity) {
    // Razorpay includes payload.subscription.entity on payment.failed events
    // for subscription-linked charges (same as activated/charged above) —
    // use that first. The Payment-row fallback only ever matches a *prior
    // successful* charge sharing this order_id, which a first-attempt
    // renewal failure never has, so on its own this handler could never
    // fire and a card decline would silently leave the subscription ACTIVE
    // (full paid access) indefinitely.
    const subscription = subscriptionEntity
      ? await prisma.subscription.findUnique({ where: { razorpaySubscriptionId: subscriptionEntity.id } })
      : await prisma.subscription.findFirst({
          where: { payments: { some: { razorpayOrderId: paymentEntity.order_id } } },
        });
    if (subscription) {
      await markSubscriptionPastDue(subscription.id);
    }
  }
};
