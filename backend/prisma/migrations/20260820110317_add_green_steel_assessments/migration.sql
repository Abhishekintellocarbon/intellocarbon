-- CreateTable
CREATE TABLE "green_steel_assessments" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "reportingPeriod" TEXT NOT NULL,
    "totalEmissionsTco2e" DOUBLE PRECISION NOT NULL,
    "productionTonnes" DOUBLE PRECISION NOT NULL,
    "emissionIntensity" DOUBLE PRECISION NOT NULL,
    "starRating" INTEGER,
    "qualifiesAsGreen" BOOLEAN NOT NULL,
    "activityDataCount" INTEGER NOT NULL,
    "status" "DataEntryStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "green_steel_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "green_steel_assessments_companyId_idx" ON "green_steel_assessments"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "green_steel_assessments_facilityId_reportingPeriod_key" ON "green_steel_assessments"("facilityId", "reportingPeriod");

-- AddForeignKey
ALTER TABLE "green_steel_assessments" ADD CONSTRAINT "green_steel_assessments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "green_steel_assessments" ADD CONSTRAINT "green_steel_assessments_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
