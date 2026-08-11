-- Voluntary carbon credit purchases logged per facility. Purely additive:
-- creates two enums and one table, touches nothing existing.
--
-- No unique constraint on creditSerialNumber by design — this is a tracking
-- log, not a registry. A duplicate serial is the purchaser's record to
-- correct, and rejecting one here would imply an authority over the credit
-- that this platform does not have.

-- CreateEnum
CREATE TYPE "OffsetRegistry" AS ENUM ('VERRA', 'GOLD_STANDARD', 'ACR', 'CAR', 'ART', 'ICM', 'OTHER');

-- CreateEnum
CREATE TYPE "OffsetCategory" AS ENUM ('AVOIDANCE_NATURE', 'AVOIDANCE_ENGINEERED', 'REMOVAL_NATURE', 'REMOVAL_ENGINEERED');

-- CreateTable
CREATE TABLE "voluntary_offset_purchases" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "registry" "OffsetRegistry" NOT NULL,
    "creditSerialNumber" TEXT NOT NULL,
    "tonnageTco2e" DOUBLE PRECISION NOT NULL,
    "category" "OffsetCategory" NOT NULL,
    "vintageYear" INTEGER NOT NULL,
    "purchaseDate" TIMESTAMP(3) NOT NULL,
    "status" "DataEntryStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voluntary_offset_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "voluntary_offset_purchases_facilityId_idx" ON "voluntary_offset_purchases"("facilityId");

-- CreateIndex
CREATE INDEX "voluntary_offset_purchases_companyId_idx" ON "voluntary_offset_purchases"("companyId");

-- AddForeignKey
ALTER TABLE "voluntary_offset_purchases" ADD CONSTRAINT "voluntary_offset_purchases_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voluntary_offset_purchases" ADD CONSTRAINT "voluntary_offset_purchases_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
