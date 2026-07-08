import { prisma } from "../config/prisma";
import { PLANS } from "../data/plans";
import type { Subscription, SubscriptionTier } from "@prisma/client";

const TIER_ORDER: SubscriptionTier[] = ["CCTS_COMPLIANCE", "CBAM_COMPLIANCE", "CBAM_PLUS_CCTS", "BRSR_CORE_REPORTING"];

type SubscriptionWithCompany = Subscription & {
  company: { name: string; owner: { email: string }; _count: { facilities: number } };
};

// Plans are billed per facility/month with no per-subscription facility
// snapshot in the schema, so the company's current facility count is used
// as the multiplier — the same approximation adminCompanies.service.ts
// makes for facilityCount elsewhere.
const monthlyValueOf = (s: SubscriptionWithCompany) => s.company._count.facilities * (PLANS[s.tier].priceInr ?? 0);

export const getAdminRevenue = async () => {
  const subscriptions = (await prisma.subscription.findMany({
    include: {
      company: {
        select: { name: true, owner: { select: { email: true } }, _count: { select: { facilities: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  })) as SubscriptionWithCompany[];

  const activeSubs = subscriptions.filter((s) => s.status === "ACTIVE");

  const totalMrrInr = activeSubs.reduce((sum, s) => sum + monthlyValueOf(s), 0);
  const totalCompaniesPaying = new Set(activeSubs.map((s) => s.companyId)).size;
  const projectedArrInr = totalMrrInr * 12;

  const now = new Date();
  // No dedicated cancelledAt column — updatedAt is bumped by @updatedAt the
  // moment status flips to CANCELED, so it doubles as the cancellation date.
  const cancelledThisMonth = subscriptions.filter(
    (s) => s.status === "CANCELED" && s.updatedAt.getFullYear() === now.getFullYear() && s.updatedAt.getMonth() === now.getMonth(),
  ).length;

  const planDistribution = TIER_ORDER.map((tier) => {
    const subs = activeSubs.filter((s) => s.tier === tier);
    return {
      tier,
      planName: PLANS[tier].name,
      subscriberCount: subs.length,
      mrrInr: subs.reduce((sum, s) => sum + monthlyValueOf(s), 0),
    };
  }).sort((a, b) => b.mrrInr - a.mrrInr);

  const subscriptionRows = subscriptions.map((s) => ({
    id: s.id,
    companyName: s.company.name,
    ownerEmail: s.company.owner.email,
    tier: s.tier,
    facilityCount: s.company._count.facilities,
    monthlyPriceInr: monthlyValueOf(s),
    status: s.status,
    subscribedAt: s.createdAt,
    cancelledAt: s.status === "CANCELED" ? s.updatedAt : null,
  }));

  // MRR at the end of each of the last 6 calendar months, replaying each
  // subscription's start (createdAt) / cancellation (updatedAt, when
  // CANCELED) against each month-end. Facility counts aren't tracked
  // historically, so today's count is used as the multiplier throughout.
  const trend = [];
  for (let i = 5; i >= 0; i--) {
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
    const mrrInr = subscriptions
      .filter((s) => {
        if (s.createdAt > monthEnd) return false;
        if (s.status === "CANCELED" && s.updatedAt <= monthEnd) return false;
        return true;
      })
      .reduce((sum, s) => sum + monthlyValueOf(s), 0);
    trend.push({
      month: `${monthEnd.getFullYear()}-${String(monthEnd.getMonth() + 1).padStart(2, "0")}`,
      monthLabel: monthEnd.toLocaleString("en-IN", { month: "short", year: "numeric" }),
      mrrInr,
    });
  }

  const earliestCreatedAt = subscriptions.reduce<Date | null>((min, s) => (!min || s.createdAt < min ? s.createdAt : min), null);
  const windowStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const trendHasFullHistory = Boolean(earliestCreatedAt && earliestCreatedAt <= windowStart);

  return {
    metrics: { totalMrrInr, totalCompaniesPaying, projectedArrInr, cancelledThisMonth },
    planDistribution,
    subscriptions: subscriptionRows,
    trend,
    trendHasFullHistory,
  };
};
