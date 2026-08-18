-- CreateEnum
CREATE TYPE "SupplierRiskFlag" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'NOT_ASSESSED');

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sector" TEXT,
    "country" TEXT,
    "hasEsgDisclosure" BOOLEAN NOT NULL DEFAULT false,
    "esgDisclosureType" TEXT,
    "riskFlag" "SupplierRiskFlag" NOT NULL DEFAULT 'NOT_ASSESSED',
    "riskNotes" TEXT,
    "spendSharePct" DOUBLE PRECISION,
    "lastReviewedAt" TIMESTAMP(3),
    "status" "DataEntryStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "suppliers_companyId_idx" ON "suppliers"("companyId");

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
