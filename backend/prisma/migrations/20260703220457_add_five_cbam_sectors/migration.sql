-- CreateEnum
CREATE TYPE "HydrogenRoute" AS ENUM ('SMR', 'SMR_CCS', 'ELECTROLYSIS_GRID', 'ELECTROLYSIS_RENEWABLE', 'BIOMASS');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "FacilityType" ADD VALUE 'CEMENT_PLANT';
ALTER TYPE "FacilityType" ADD VALUE 'ALUMINIUM_SMELTER';
ALTER TYPE "FacilityType" ADD VALUE 'FERTILIZER_PLANT';
ALTER TYPE "FacilityType" ADD VALUE 'HYDROGEN_PLANT';
ALTER TYPE "FacilityType" ADD VALUE 'POWER_PLANT';

-- DropForeignKey
ALTER TABLE "emission_calculation_results" DROP CONSTRAINT "emission_calculation_results_activityDataId_fkey";

-- DropForeignKey
ALTER TABLE "fuel_entries" DROP CONSTRAINT "fuel_entries_activityDataId_fkey";

-- DropForeignKey
ALTER TABLE "precursor_entries" DROP CONSTRAINT "precursor_entries_activityDataId_fkey";

-- DropForeignKey
ALTER TABLE "process_material_entries" DROP CONSTRAINT "process_material_entries_activityDataId_fkey";

-- DropForeignKey
ALTER TABLE "steel_activity_data" DROP CONSTRAINT "steel_activity_data_facilityId_fkey";

-- DropForeignKey
ALTER TABLE "verification_requests" DROP CONSTRAINT "verification_requests_activityDataId_fkey";

-- AlterTable
ALTER TABLE "emission_calculation_results" ADD COLUMN     "directN2oProcessCo2eAr4" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "directN2oProcessCo2eAr5" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "directPfcCo2eAr4" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "directPfcCo2eAr5" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
-- Safe in-place type change (was DROP COLUMN + ADD COLUMN NOT NULL with no
-- default, which fails on any non-empty facilities table). USING preserves
-- the existing enum value as text instead of destroying it.
ALTER TABLE "facilities" ALTER COLUMN "productionRoute" TYPE TEXT USING "productionRoute"::TEXT;

-- DropEnum
DROP TYPE "ProductionRoute";

-- RenameTable
-- Was DROP TABLE + CREATE TABLE, which would have destroyed existing
-- steel_activity_data rows. Renaming preserves data; new sector-specific
-- columns are added as nullable/defaulted so existing rows stay valid.
ALTER TABLE "steel_activity_data" RENAME TO "activity_data";
ALTER TABLE "activity_data" RENAME CONSTRAINT "steel_activity_data_pkey" TO "activity_data_pkey";
ALTER INDEX "steel_activity_data_facilityId_idx" RENAME TO "activity_data_facilityId_idx";

ALTER TABLE "activity_data"
ADD COLUMN     "sector" "Sector" NOT NULL DEFAULT 'STEEL',
ADD COLUMN     "limestoneInputTonnes" DOUBLE PRECISION,
ADD COLUMN     "clinkerProducedTonnes" DOUBLE PRECISION,
ADD COLUMN     "clinkerConversionFraction" DOUBLE PRECISION,
ADD COLUMN     "cf4EmissionsTonnes" DOUBLE PRECISION,
ADD COLUMN     "c2f6EmissionsTonnes" DOUBLE PRECISION,
ADD COLUMN     "anodeEffectMinutes" DOUBLE PRECISION,
ADD COLUMN     "n2oProcessEmissionsTonnes" DOUBLE PRECISION,
ADD COLUMN     "n2oAbatementFactorPct" DOUBLE PRECISION,
ADD COLUMN     "naturalGasFeedstockNm3" DOUBLE PRECISION,
ADD COLUMN     "hydrogenRoute" "HydrogenRoute",
ADD COLUMN     "ccsCaptureRatePct" DOUBLE PRECISION,
ADD COLUMN     "hydrogenPurityPct" DOUBLE PRECISION,
ADD COLUMN     "byproductOxygenTonnes" DOUBLE PRECISION,
ADD COLUMN     "electricityGeneratedMwh" DOUBLE PRECISION,
ADD COLUMN     "electricityExportedEuMwh" DOUBLE PRECISION,
ADD COLUMN     "ownUseElectricityMwh" DOUBLE PRECISION,
ADD COLUMN     "lineLossMwh" DOUBLE PRECISION;

-- AddForeignKey
ALTER TABLE "verification_requests" ADD CONSTRAINT "verification_requests_activityDataId_fkey" FOREIGN KEY ("activityDataId") REFERENCES "activity_data"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_data" ADD CONSTRAINT "activity_data_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuel_entries" ADD CONSTRAINT "fuel_entries_activityDataId_fkey" FOREIGN KEY ("activityDataId") REFERENCES "activity_data"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_material_entries" ADD CONSTRAINT "process_material_entries_activityDataId_fkey" FOREIGN KEY ("activityDataId") REFERENCES "activity_data"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "precursor_entries" ADD CONSTRAINT "precursor_entries_activityDataId_fkey" FOREIGN KEY ("activityDataId") REFERENCES "activity_data"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emission_calculation_results" ADD CONSTRAINT "emission_calculation_results_activityDataId_fkey" FOREIGN KEY ("activityDataId") REFERENCES "activity_data"("id") ON DELETE CASCADE ON UPDATE CASCADE;
