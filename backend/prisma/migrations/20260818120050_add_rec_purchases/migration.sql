-- CreateEnum
CREATE TYPE "RecRegistry" AS ENUM ('INDIA_REC_CERC', 'I_REC', 'TIGR', 'GUARANTEE_OF_ORIGIN', 'GREEN_E', 'OTHER');

-- CreateTable
CREATE TABLE "rec_purchases" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "registry" "RecRegistry" NOT NULL,
    "certificateReference" TEXT NOT NULL,
    "quantityMwh" DOUBLE PRECISION NOT NULL,
    "vintageYear" INTEGER NOT NULL,
    "purchaseDate" TIMESTAMP(3) NOT NULL,
    "status" "DataEntryStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rec_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rec_purchases_facilityId_idx" ON "rec_purchases"("facilityId");

-- CreateIndex
CREATE INDEX "rec_purchases_companyId_idx" ON "rec_purchases"("companyId");

-- AddForeignKey
ALTER TABLE "rec_purchases" ADD CONSTRAINT "rec_purchases_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rec_purchases" ADD CONSTRAINT "rec_purchases_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
