/*
  Warnings:

  - You are about to drop the `steel_activity_data` table. If the table is not empty, all the data it contains will be lost.
  - Changed the type of `productionRoute` on the `facilities` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
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
ALTER TABLE "facilities" DROP COLUMN "productionRoute",
ADD COLUMN     "productionRoute" TEXT NOT NULL;

-- DropTable
DROP TABLE "steel_activity_data";

-- DropEnum
DROP TYPE "ProductionRoute";

-- CreateTable
CREATE TABLE "activity_data" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "sector" "Sector" NOT NULL DEFAULT 'STEEL',
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "productCategory" TEXT NOT NULL,
    "productionQuantityT" DOUBLE PRECISION NOT NULL,
    "gridElectricityMwh" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "renewableElectricityMwh" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gridEmissionFactorOverride" DOUBLE PRECISION,
    "steamImportedGj" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "steamEmissionFactorOverride" DOUBLE PRECISION,
    "limestoneInputTonnes" DOUBLE PRECISION,
    "clinkerProducedTonnes" DOUBLE PRECISION,
    "clinkerConversionFraction" DOUBLE PRECISION,
    "cf4EmissionsTonnes" DOUBLE PRECISION,
    "c2f6EmissionsTonnes" DOUBLE PRECISION,
    "anodeEffectMinutes" DOUBLE PRECISION,
    "n2oProcessEmissionsTonnes" DOUBLE PRECISION,
    "n2oAbatementFactorPct" DOUBLE PRECISION,
    "naturalGasFeedstockNm3" DOUBLE PRECISION,
    "hydrogenRoute" "HydrogenRoute",
    "ccsCaptureRatePct" DOUBLE PRECISION,
    "hydrogenPurityPct" DOUBLE PRECISION,
    "byproductOxygenTonnes" DOUBLE PRECISION,
    "electricityGeneratedMwh" DOUBLE PRECISION,
    "electricityExportedEuMwh" DOUBLE PRECISION,
    "ownUseElectricityMwh" DOUBLE PRECISION,
    "lineLossMwh" DOUBLE PRECISION,
    "carbonPricePaidEurPerTonne" DOUBLE PRECISION,
    "cctsTargetIntensity" DOUBLE PRECISION,
    "status" "DataEntryStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activity_data_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "activity_data_facilityId_idx" ON "activity_data"("facilityId");

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
