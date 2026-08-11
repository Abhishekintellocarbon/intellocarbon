-- ISO 14046 water inventory, captured against the same ActivityData row (and
-- therefore the same reporting period and production quantity) as the GHG
-- figures. Purely additive: no existing table or column is touched, so every
-- CBAM/CCTS/BRSR calculation path is unaffected and existing activity data
-- rows simply have no water entries.
--
-- Consumption is intentionally absent — it is derived as withdrawn minus
-- discharged, so it cannot be submitted in a state that fails to balance.

-- CreateTable
CREATE TABLE "water_entries" (
    "id" TEXT NOT NULL,
    "activityDataId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "withdrawnM3" DOUBLE PRECISION NOT NULL,
    "dischargedM3" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "freshwaterFactorOverride" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "water_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "water_entries_activityDataId_idx" ON "water_entries"("activityDataId");

-- AddForeignKey
ALTER TABLE "water_entries" ADD CONSTRAINT "water_entries_activityDataId_fkey" FOREIGN KEY ("activityDataId") REFERENCES "activity_data"("id") ON DELETE CASCADE ON UPDATE CASCADE;
