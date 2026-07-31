import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";
import { getPlan } from "../data/plans";

/**
 * Shared access gate for BRSR Core, ISSB IFRS S1/S2, and Scope 3 routes —
 * all three live under the same ESG Disclosure Bundle subscription tier
 * (SubscriptionTier.BRSR_CORE_REPORTING; the enum value wasn't renamed
 * alongside the bundle's rename — see plans.ts). Distinct from
 * requireOwnedFacility (does this user own this facility?) and
 * requireCapacityForNewFacility (does the plan cover this many facilities?)
 * — this checks whether the company has this framework at all.
 */
export const requireEsgBundleAccess = async (companyId: string): Promise<void> => {
  const activeCount = await prisma.subscription.count({
    where: { companyId, status: "ACTIVE", tier: "BRSR_CORE_REPORTING" },
  });
  if (activeCount === 0) {
    throw AppError.forbidden(
      `Subscribe to the ${getPlan("BRSR_CORE_REPORTING").name} to access BRSR Core, ISSB IFRS S1/S2, and Scope 3 reporting`,
      "ESG_BUNDLE_NOT_SUBSCRIBED",
    );
  }
};
