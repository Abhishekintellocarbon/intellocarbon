-- Facilities created before this migration were only ever persisted once
-- fully valid (facilityType/productionRoute were NOT NULL), so they are
-- complete by definition — backfill them as isDraft = false, then flip the
-- column default to true so only *new* facilities start as drafts.
ALTER TABLE "facilities" ADD COLUMN "isDraft" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "facilities" ALTER COLUMN "isDraft" SET DEFAULT true;

-- Nullable to support autosaved drafts. Existing rows already have these
-- populated (they were required until now), so no backfill is needed.
ALTER TABLE "facilities" ALTER COLUMN "facilityType" DROP NOT NULL;
ALTER TABLE "facilities" ALTER COLUMN "productionRoute" DROP NOT NULL;

ALTER TABLE "activity_data" ALTER COLUMN "periodStart" DROP NOT NULL;
ALTER TABLE "activity_data" ALTER COLUMN "periodEnd" DROP NOT NULL;
ALTER TABLE "activity_data" ALTER COLUMN "productCategory" DROP NOT NULL;
ALTER TABLE "activity_data" ALTER COLUMN "productionQuantityT" DROP NOT NULL;
