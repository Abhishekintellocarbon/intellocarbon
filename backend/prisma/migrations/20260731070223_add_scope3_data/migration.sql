-- CreateEnum
CREATE TYPE "Scope3Category" AS ENUM ('CAT1_PURCHASED_GOODS_SERVICES', 'CAT4_UPSTREAM_TRANSPORT_DISTRIBUTION', 'CAT6_BUSINESS_TRAVEL', 'CAT7_EMPLOYEE_COMMUTING', 'CAT11_USE_OF_SOLD_PRODUCTS');

-- CreateEnum
CREATE TYPE "Scope3CalculationMethod" AS ENUM ('SPEND_BASED', 'ACTIVITY_BASED');

-- CreateTable
CREATE TABLE "scope3_data" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "reportingPeriod" TEXT NOT NULL,
    "category" "Scope3Category" NOT NULL,
    "calculationMethod" "Scope3CalculationMethod" NOT NULL,
    "inputData" JSONB NOT NULL,
    "calculatedEmissionsTco2e" DOUBLE PRECISION NOT NULL,
    "emissionFactorSource" TEXT NOT NULL,
    "status" "DataEntryStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scope3_data_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scope3_data_companyId_idx" ON "scope3_data"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "scope3_data_facilityId_reportingPeriod_category_key" ON "scope3_data"("facilityId", "reportingPeriod", "category");

-- AddForeignKey
ALTER TABLE "scope3_data" ADD CONSTRAINT "scope3_data_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scope3_data" ADD CONSTRAINT "scope3_data_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
