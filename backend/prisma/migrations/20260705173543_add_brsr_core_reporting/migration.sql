-- AlterEnum
ALTER TYPE "SubscriptionTier" ADD VALUE 'BRSR_CORE_REPORTING';

-- DropIndex
DROP INDEX "subscriptions_companyId_key";

-- CreateTable
CREATE TABLE "brsr_core_reports" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "reportingPeriod" TEXT NOT NULL,
    "turnoverInr" DOUBLE PRECISION,
    "waterWithdrawnKl" DOUBLE PRECISION,
    "waterDischargedKl" DOUBLE PRECISION,
    "wasteGeneratedTonnes" DOUBLE PRECISION,
    "wasteRecoveredTonnes" DOUBLE PRECISION,
    "renewableEnergyConsumptionGj" DOUBLE PRECISION,
    "nonRenewableEnergyConsumptionGj" DOUBLE PRECISION,
    "employeeCountTotal" INTEGER,
    "employeeCountFemale" INTEGER,
    "wagesPaidMaleInr" DOUBLE PRECISION,
    "wagesPaidFemaleInr" DOUBLE PRECISION,
    "safetyIncidentsCount" INTEGER,
    "womenInWorkforcePct" DOUBLE PRECISION,
    "womenInManagementPct" DOUBLE PRECISION,
    "procurementFromMsmePct" DOUBLE PRECISION,
    "purchasesFromTop10SuppliersPct" DOUBLE PRECISION,
    "salesToTop10CustomersPct" DOUBLE PRECISION,
    "consumerComplaintsCount" INTEGER,
    "consumerComplaintsResolvedPct" DOUBLE PRECISION,
    "status" "DataEntryStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brsr_core_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brsr_verification_requests" (
    "id" TEXT NOT NULL,
    "brsrCoreReportId" TEXT NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verifierId" TEXT,
    "verifierOrg" TEXT,
    "accreditationNumber" TEXT,
    "statement" TEXT,
    "comments" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brsr_verification_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "brsr_core_reports_companyId_idx" ON "brsr_core_reports"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "brsr_core_reports_facilityId_reportingPeriod_key" ON "brsr_core_reports"("facilityId", "reportingPeriod");

-- CreateIndex
CREATE UNIQUE INDEX "brsr_verification_requests_brsrCoreReportId_key" ON "brsr_verification_requests"("brsrCoreReportId");

-- CreateIndex
CREATE INDEX "brsr_verification_requests_verifierId_idx" ON "brsr_verification_requests"("verifierId");

-- CreateIndex
CREATE INDEX "subscriptions_companyId_idx" ON "subscriptions"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_companyId_tier_key" ON "subscriptions"("companyId", "tier");

-- AddForeignKey
ALTER TABLE "brsr_core_reports" ADD CONSTRAINT "brsr_core_reports_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brsr_core_reports" ADD CONSTRAINT "brsr_core_reports_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brsr_verification_requests" ADD CONSTRAINT "brsr_verification_requests_brsrCoreReportId_fkey" FOREIGN KEY ("brsrCoreReportId") REFERENCES "brsr_core_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brsr_verification_requests" ADD CONSTRAINT "brsr_verification_requests_verifierId_fkey" FOREIGN KEY ("verifierId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

