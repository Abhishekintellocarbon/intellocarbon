-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "onboardingFeePaidAt" TIMESTAMP(3),
ADD COLUMN     "onboardingFeePaidInr" INTEGER;

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "onboardingFeeChargedInr" INTEGER;

-- Grandfather every company that exists at the moment this migration runs:
-- they signed up before the fee was collectable in-flow and must never be
-- retro-billed. A non-null onboardingFeePaidAt is the "never charge again"
-- marker; the amount is 0 because nothing was actually collected from them.
-- Scoped to rows present now, so companies created after this deploy are
-- left null and will be charged at their first checkout.
UPDATE "companies"
SET "onboardingFeePaidAt" = COALESCE("onboardingCompletedAt", "createdAt"),
    "onboardingFeePaidInr" = 0
WHERE "onboardingFeePaidAt" IS NULL;
