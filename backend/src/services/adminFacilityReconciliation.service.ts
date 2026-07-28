import { prisma } from "../config/prisma";
import { getPlan } from "../data/plans";
import type { Company, Subscription, SubscriptionTier, User } from "@prisma/client";

type CompanyWithBilling = Company & {
  owner: Pick<User, "email">;
  facilities: { id: string }[];
  subscriptions: Subscription[];
};

const facilityCapacityOf = (s: Pick<Subscription, "isCustomDeal" | "customFacilityCount" | "facilitiesIncluded">) =>
  s.isCustomDeal && s.customFacilityCount != null ? s.customFacilityCount : s.facilitiesIncluded;

export interface FacilityShortfallRow {
  companyId: string;
  companyName: string;
  ownerEmail: string;
  facilityCount: number;
  facilitiesCovered: number;
  shortfall: number;
  tiers: SubscriptionTier[];
  /** Rough monthly under-billing at current list prices — informational only, not a charge. */
  estimatedMonthlyGapInr: number;
}

/**
 * Read-only visibility report — companies whose actual facility count
 * exceeds what their active subscriptions currently cover
 * (Subscription.facilitiesIncluded, added alongside per-facility
 * enforcement in requireCapacityForNewFacility). This can only happen for
 * accounts that predate that enforcement (every row defaulted to
 * facilitiesIncluded=1 on migration, regardless of how many facilities the
 * company already had) or dev-bypass/manual-payment accounts activated
 * without a matching facility count. Deliberately does NOT auto-charge or
 * modify anything — Super Admin reviews and follows up manually per the
 * product brief.
 */
export const getFacilityReconciliationReport = async (): Promise<{ rows: FacilityShortfallRow[]; generatedAt: Date }> => {
  const companies = (await prisma.company.findMany({
    include: {
      owner: { select: { email: true } },
      facilities: { select: { id: true } },
      subscriptions: { where: { status: "ACTIVE" } },
    },
  })) as CompanyWithBilling[];

  const rows = companies
    .map((c) => {
      const facilityCount = c.facilities.length;
      const facilitiesCovered = c.subscriptions.reduce((sum, s) => sum + facilityCapacityOf(s), 0);
      const shortfall = facilityCount - facilitiesCovered;
      // Approximates the gap as "shortfall facilities" billed at each
      // subscription's own per-facility price, split proportionally isn't
      // meaningful with no per-facility tier assignment — so this uses the
      // single highest-priced active tier as the conservative (upper-bound)
      // per-facility rate, same approximation adminRevenue.service.ts makes
      // for MRR elsewhere in this file's neighborhood.
      const maxTierPriceInr = Math.max(0, ...c.subscriptions.map((s) => getPlan(s.tier).priceInr ?? 0));
      return {
        companyId: c.id,
        companyName: c.name,
        ownerEmail: c.owner.email,
        facilityCount,
        facilitiesCovered,
        shortfall,
        tiers: c.subscriptions.map((s) => s.tier),
        estimatedMonthlyGapInr: shortfall > 0 ? shortfall * maxTierPriceInr : 0,
      };
    })
    .filter((r) => r.shortfall > 0)
    .sort((a, b) => b.estimatedMonthlyGapInr - a.estimatedMonthlyGapInr);

  return { rows, generatedAt: new Date() };
};
