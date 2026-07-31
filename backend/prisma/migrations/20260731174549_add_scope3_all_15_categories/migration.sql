-- CreateEnum
CREATE TYPE "OwnershipModel" AS ENUM ('OWNED', 'LEASED', 'MIXED');

-- CreateEnum
CREATE TYPE "BusinessModel" AS ENUM ('MANUFACTURER', 'FRANCHISOR', 'FINANCIAL_INSTITUTION', 'DISTRIBUTOR');

-- CreateEnum
CREATE TYPE "Scope3Relevance" AS ENUM ('MANDATORY', 'OPTIONAL', 'NOT_APPLICABLE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Scope3Category" ADD VALUE 'CAT2_CAPITAL_GOODS';
ALTER TYPE "Scope3Category" ADD VALUE 'CAT3_FUEL_ENERGY_RELATED';
ALTER TYPE "Scope3Category" ADD VALUE 'CAT5_WASTE_GENERATED_IN_OPERATIONS';
ALTER TYPE "Scope3Category" ADD VALUE 'CAT8_UPSTREAM_LEASED_ASSETS';
ALTER TYPE "Scope3Category" ADD VALUE 'CAT9_DOWNSTREAM_TRANSPORT_DISTRIBUTION';
ALTER TYPE "Scope3Category" ADD VALUE 'CAT10_PROCESSING_OF_SOLD_PRODUCTS';
ALTER TYPE "Scope3Category" ADD VALUE 'CAT12_END_OF_LIFE_TREATMENT';
ALTER TYPE "Scope3Category" ADD VALUE 'CAT13_DOWNSTREAM_LEASED_ASSETS';
ALTER TYPE "Scope3Category" ADD VALUE 'CAT14_FRANCHISES';
ALTER TYPE "Scope3Category" ADD VALUE 'CAT15_INVESTMENTS';

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "businessModel" "BusinessModel" NOT NULL DEFAULT 'MANUFACTURER',
ADD COLUMN     "ownershipModel" "OwnershipModel" NOT NULL DEFAULT 'OWNED';

-- CreateTable
CREATE TABLE "scope3_category_relevance" (
    "id" TEXT NOT NULL,
    "sector" "Sector" NOT NULL,
    "category" INTEGER NOT NULL,
    "relevance" "Scope3Relevance" NOT NULL,
    "reasoning" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scope3_category_relevance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scope3_category_relevance_sector_idx" ON "scope3_category_relevance"("sector");

-- CreateIndex
CREATE UNIQUE INDEX "scope3_category_relevance_sector_category_key" ON "scope3_category_relevance"("sector", "category");
