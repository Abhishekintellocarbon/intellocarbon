-- Remap any existing subscriptions on the retired tiers to the new default
-- before narrowing the enum. There is no meaningful automatic mapping from
-- the old facility-count tiers (Starter/Growth/Enterprise) to the new
-- compliance-type tiers (CCTS/CBAM/CBAM+CCTS) — this is a stopgap so the
-- enum narrowing below doesn't fail against any pre-existing rows; affected
-- customers should be moved to the correct plan manually.
UPDATE "subscriptions" SET "tier" = 'CBAM_COMPLIANCE' WHERE "tier" IN ('STARTER', 'GROWTH', 'ENTERPRISE');

-- AlterEnum
BEGIN;
CREATE TYPE "SubscriptionTier_new" AS ENUM ('CCTS_COMPLIANCE', 'CBAM_COMPLIANCE', 'CBAM_PLUS_CCTS');
ALTER TABLE "subscriptions" ALTER COLUMN "tier" DROP DEFAULT;
ALTER TABLE "subscriptions" ALTER COLUMN "tier" TYPE "SubscriptionTier_new" USING ("tier"::text::"SubscriptionTier_new");
ALTER TYPE "SubscriptionTier" RENAME TO "SubscriptionTier_old";
ALTER TYPE "SubscriptionTier_new" RENAME TO "SubscriptionTier";
DROP TYPE "SubscriptionTier_old";
ALTER TABLE "subscriptions" ALTER COLUMN "tier" SET DEFAULT 'CCTS_COMPLIANCE';
COMMIT;

-- AlterTable
ALTER TABLE "subscriptions" ALTER COLUMN "tier" SET DEFAULT 'CCTS_COMPLIANCE';
