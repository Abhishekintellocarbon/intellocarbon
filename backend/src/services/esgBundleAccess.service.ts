import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";
import { getPlan } from "../data/plans";

const ACCESS_DENIED_MESSAGE = `Subscribe to the ${getPlan("BRSR_CORE_REPORTING").name} to access BRSR Core, ISSB IFRS S1/S2, and Scope 3 reporting`;

export const throwEsgBundleAccessDenied = (): never => {
  throw AppError.forbidden(ACCESS_DENIED_MESSAGE, "ESG_BUNDLE_NOT_SUBSCRIBED");
};

/**
 * Shared access gate for BRSR Core, ISSB IFRS S1/S2, and Scope 3 routes —
 * all three live under the same ESG Disclosure Bundle subscription tier
 * (SubscriptionTier.BRSR_CORE_REPORTING; the enum value wasn't renamed
 * alongside the bundle's rename — see plans.ts). Distinct from
 * requireOwnedFacility (does this user own this facility?) and
 * requireCapacityForNewFacility (does the plan cover this many facilities?)
 * — this checks whether the company has this framework at all.
 *
 * Only used by the two by-reportId entry points (getBrsrReportContextById /
 * getIssbReportContextById), which already fetch `company` in their own
 * query and so can't reuse requireOwnedFacilityForEsgBundle below — prefer
 * that one wherever the caller starts from a facilityId, since it does the
 * ownership + subscription check in a single round trip instead of two.
 */
export const requireEsgBundleAccess = async (companyId: string): Promise<void> => {
  const activeCount = await prisma.subscription.count({
    where: { companyId, status: "ACTIVE", tier: "BRSR_CORE_REPORTING" },
  });
  if (activeCount === 0) throwEsgBundleAccessDenied();
};

/**
 * Combines requireOwnedFacility's ownership check with requireEsgBundleAccess
 * into one query — the subscription is fetched via the same `company`
 * include rather than a second round trip. Was two sequential awaited
 * queries per request across every BRSR/ISSB/Scope3 list/save endpoint;
 * profiling traced a page-load slowdown to exactly that redundant lookup
 * (the subscription lookup itself is a sub-millisecond unique-index hit —
 * see subscriptions_companyId_tier_key — so the fix is round-trip count,
 * not query shape).
 */
export const requireOwnedFacilityForEsgBundle = async (userId: string, facilityId: string) => {
  const facility = await prisma.facility.findUnique({
    where: { id: facilityId },
    include: {
      company: {
        include: {
          subscriptions: {
            where: { status: "ACTIVE", tier: "BRSR_CORE_REPORTING" },
            select: { id: true },
          },
        },
      },
    },
  });

  if (!facility || facility.company.ownerId !== userId) {
    throw AppError.notFound("Facility not found");
  }
  if (facility.company.subscriptions.length === 0) {
    throwEsgBundleAccessDenied();
  }

  return facility;
};
