-- CreateTable
CREATE TABLE "issb_s1_s2_reports" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "reportingPeriod" TEXT NOT NULL,
    "governanceBodyOversight" TEXT,
    "managementRole" TEXT,
    "climateRisksOpportunities" TEXT,
    "businessModelImpact" TEXT,
    "financialEffects" TEXT,
    "scenarioAnalysisResilience" TEXT,
    "riskIdentificationProcess" TEXT,
    "riskManagementProcess" TEXT,
    "riskIntegrationOverall" TEXT,
    "scope3Tco2e" DOUBLE PRECISION,
    "targetDescription" TEXT,
    "targetYear" INTEGER,
    "baselineYear" INTEGER,
    "baselineEmissionsTco2e" DOUBLE PRECISION,
    "transitionPlan" TEXT,
    "internalCarbonPriceInr" DOUBLE PRECISION,
    "climateCapexInr" DOUBLE PRECISION,
    "status" "DataEntryStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "issb_s1_s2_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "issb_s1_s2_reports_companyId_idx" ON "issb_s1_s2_reports"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "issb_s1_s2_reports_facilityId_reportingPeriod_key" ON "issb_s1_s2_reports"("facilityId", "reportingPeriod");

-- AddForeignKey
ALTER TABLE "issb_s1_s2_reports" ADD CONSTRAINT "issb_s1_s2_reports_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issb_s1_s2_reports" ADD CONSTRAINT "issb_s1_s2_reports_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
