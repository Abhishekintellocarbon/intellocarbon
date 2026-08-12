-- AlterTable
ALTER TABLE "activity_data" ADD COLUMN "carbonPricePaidGbpPerTonne" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "emission_calculation_results"
    ADD COLUMN "totalEmissionsUkCbamAr5" DOUBLE PRECISION NOT NULL DEFAULT 0,
    ADD COLUMN "specificEmbeddedEmissionsUkCbam" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Backfill both columns from what is already stored, rather than leaving
-- historical rows at 0 and making a real result indistinguishable from a
-- pre-migration one. UK CBAM's boundary at launch is Scope 1 + select
-- precursors, so the total is exactly totalDirectCo2eAr5 + directPrecursorCo2e
-- out of the existing columns — no recalculation from source data needed, and
-- no indirect (electricity/steam) emissions, which are deferred to 2029.
UPDATE "emission_calculation_results"
SET "totalEmissionsUkCbamAr5" = "totalDirectCo2eAr5" + "directPrecursorCo2e";

-- The specific figure is that total per unit of output. Guarded with NULLIF so
-- a row whose production quantity is zero or null stays at 0 rather than
-- becoming NULL or a division error; the calculation engine refuses to produce
-- such a row in the first place, so this only protects against legacy data.
UPDATE "emission_calculation_results" r
SET "specificEmbeddedEmissionsUkCbam" =
    r."totalEmissionsUkCbamAr5" / NULLIF(a."productionQuantityT", 0)
FROM "activity_data" a
WHERE a."id" = r."activityDataId"
  AND COALESCE(a."productionQuantityT", 0) > 0;
