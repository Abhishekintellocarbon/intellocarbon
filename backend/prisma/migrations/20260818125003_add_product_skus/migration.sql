-- CreateTable
CREATE TABLE "product_skus" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "skuCode" TEXT,
    "reportingPeriod" TEXT NOT NULL,
    "productionQuantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "status" "DataEntryStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_skus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_skus_companyId_idx" ON "product_skus"("companyId");

-- CreateIndex
CREATE INDEX "product_skus_facilityId_reportingPeriod_idx" ON "product_skus"("facilityId", "reportingPeriod");

-- AddForeignKey
ALTER TABLE "product_skus" ADD CONSTRAINT "product_skus_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_skus" ADD CONSTRAINT "product_skus_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
