import type { SubscriptionTier } from "@prisma/client";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";

/**
 * CBAM tier gate, mirroring esgBundleAccess.service.ts.
 *
 * The tier list is the same one reportGeneration.service.ts grants CBAM
 * reports on — CBAM_PLUS_CCTS bundles CBAM access, so checking only
 * CBAM_COMPLIANCE would lock out the combined-tier subscribers who have paid
 * for it. No new tier is introduced by this module.
 */
const CBAM_TIERS: SubscriptionTier[] = ["CBAM_COMPLIANCE", "CBAM_PLUS_CCTS"];

const ACCESS_DENIED_MESSAGE = "Subscribe to a CBAM plan to generate the CBAM executive summary";

/**
 * Ownership + CBAM subscription in a single round trip, the same shape as
 * requireOwnedFacilityForEsgBundle.
 */
export const requireOwnedFacilityForCbam = async (userId: string, facilityId: string) => {
  const facility = await prisma.facility.findUnique({
    where: { id: facilityId },
    include: {
      company: {
        include: {
          subscriptions: {
            where: { status: "ACTIVE", tier: { in: CBAM_TIERS } },
            select: { id: true },
          },
          owner: true,
        },
      },
    },
  });

  if (!facility || facility.company.ownerId !== userId) {
    throw AppError.notFound("Facility not found");
  }
  if (facility.company.subscriptions.length === 0) {
    throw AppError.forbidden(ACCESS_DENIED_MESSAGE, "CBAM_NOT_SUBSCRIBED");
  }

  return facility;
};
