-- CreateEnum
CREATE TYPE "CsrdIroKind" AS ENUM ('IMPACT', 'FINANCIAL', 'BOTH');

-- CreateEnum
CREATE TYPE "CsrdImpactType" AS ENUM ('NEGATIVE_ACTUAL', 'NEGATIVE_POTENTIAL', 'POSITIVE_ACTUAL', 'POSITIVE_POTENTIAL');

-- CreateEnum
CREATE TYPE "CsrdFinancialEffectType" AS ENUM ('RISK', 'OPPORTUNITY');

-- CreateEnum
CREATE TYPE "CsrdValueChainLocation" AS ENUM ('OWN_OPERATIONS', 'UPSTREAM', 'DOWNSTREAM');

-- CreateTable
CREATE TABLE "csrd_reports" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "reportingPeriod" TEXT NOT NULL,
    "netRevenueEur" DOUBLE PRECISION,
    "status" "DataEntryStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "csrd_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "csrd_materiality_assessments" (
    "id" TEXT NOT NULL,
    "csrdReportId" TEXT NOT NULL,
    "stakeholderGroups" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "engagementApproach" TEXT,
    "iroIdentificationProcess" TEXT,
    "prioritisationProcess" TEXT,
    "impactThreshold" DOUBLE PRECISION NOT NULL DEFAULT 3,
    "financialThreshold" DOUBLE PRECISION NOT NULL DEFAULT 3,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "csrd_materiality_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "csrd_iros" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "standardCode" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "kind" "CsrdIroKind" NOT NULL,
    "valueChainLocation" "CsrdValueChainLocation" NOT NULL DEFAULT 'OWN_OPERATIONS',
    "impactType" "CsrdImpactType",
    "scale" INTEGER,
    "scope" INTEGER,
    "irremediability" INTEGER,
    "impactLikelihood" INTEGER,
    "impactScore" DOUBLE PRECISION,
    "financialEffectType" "CsrdFinancialEffectType",
    "magnitude" INTEGER,
    "financialLikelihood" INTEGER,
    "financialScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "csrd_iros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "csrd_material_topics" (
    "id" TEXT NOT NULL,
    "csrdReportId" TEXT NOT NULL,
    "standardCode" TEXT NOT NULL,
    "isMaterial" BOOLEAN NOT NULL DEFAULT false,
    "impactMaterial" BOOLEAN NOT NULL DEFAULT false,
    "financialMaterial" BOOLEAN NOT NULL DEFAULT false,
    "impactScore" DOUBLE PRECISION,
    "financialScore" DOUBLE PRECISION,
    "notMaterialRationale" TEXT,
    "policies" TEXT,
    "actions" TEXT,
    "targets" TEXT,
    "metrics" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "csrd_material_topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "csrd_general_disclosures" (
    "id" TEXT NOT NULL,
    "csrdReportId" TEXT NOT NULL,
    "basisOfPreparation" TEXT,
    "specificCircumstances" TEXT,
    "governanceBodiesRole" TEXT,
    "governanceExecutiveMembers" INTEGER,
    "governanceNonExecutiveMembers" INTEGER,
    "governanceIndependentPct" DOUBLE PRECISION,
    "governanceGenderDiversityPct" DOUBLE PRECISION,
    "governanceInformationFlow" TEXT,
    "incentiveSchemes" TEXT,
    "dueDiligenceStatement" TEXT,
    "riskManagementControls" TEXT,
    "strategyBusinessModel" TEXT,
    "stakeholderInterests" TEXT,
    "materialIroInteraction" TEXT,
    "iroIdentificationProcess" TEXT,
    "minimumPolicies" TEXT,
    "minimumActions" TEXT,
    "minimumTargets" TEXT,
    "minimumMetrics" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "csrd_general_disclosures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "csrd_climate_disclosure" (
    "id" TEXT NOT NULL,
    "csrdReportId" TEXT NOT NULL,
    "transitionPlan" TEXT,
    "climatePolicies" TEXT,
    "climateActions" TEXT,
    "climateTargets" TEXT,
    "targetBaseYear" INTEGER,
    "targetReductionPct" DOUBLE PRECISION,
    "targetYear" INTEGER,
    "energyFossilMwh" DOUBLE PRECISION,
    "energyNuclearMwh" DOUBLE PRECISION,
    "scope2MarketTco2e" DOUBLE PRECISION,
    "biogenicCo2Tonnes" DOUBLE PRECISION,
    "removalsAndCredits" TEXT,
    "removalsOwnOperationsTco2e" DOUBLE PRECISION,
    "internalCarbonPricing" TEXT,
    "internalCarbonPricePerTonne" DOUBLE PRECISION,
    "anticipatedFinancialEffects" TEXT,
    "assetsAtPhysicalRiskPct" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "csrd_climate_disclosure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "csrd_pollution_disclosure" (
    "id" TEXT NOT NULL,
    "csrdReportId" TEXT NOT NULL,
    "pollutionPolicies" TEXT,
    "pollutionActions" TEXT,
    "pollutionTargets" TEXT,
    "pollutionNarrative" TEXT,
    "airPollutantsTonnes" DOUBLE PRECISION,
    "waterPollutantsTonnes" DOUBLE PRECISION,
    "soilPollutantsTonnes" DOUBLE PRECISION,
    "substancesOfConcern" TEXT,
    "svhcTonnes" DOUBLE PRECISION,
    "pollutionFinancialEffects" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "csrd_pollution_disclosure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "csrd_water_disclosure" (
    "id" TEXT NOT NULL,
    "csrdReportId" TEXT NOT NULL,
    "waterPolicies" TEXT,
    "waterActions" TEXT,
    "waterTargets" TEXT,
    "waterConsumptionStressM3" DOUBLE PRECISION,
    "waterFinancialEffects" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "csrd_water_disclosure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "csrd_biodiversity_disclosure" (
    "id" TEXT NOT NULL,
    "csrdReportId" TEXT NOT NULL,
    "biodiversityTransitionPlan" TEXT,
    "biodiversityPolicies" TEXT,
    "biodiversityActions" TEXT,
    "biodiversityTargets" TEXT,
    "biodiversityImpactMetrics" TEXT,
    "sitesNearSensitiveAreas" INTEGER,
    "landUseChangeHa" DOUBLE PRECISION,
    "landRestoredHa" DOUBLE PRECISION,
    "biodiversityFinancialEffects" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "csrd_biodiversity_disclosure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "csrd_circular_disclosure" (
    "id" TEXT NOT NULL,
    "csrdReportId" TEXT NOT NULL,
    "circularPolicies" TEXT,
    "circularActions" TEXT,
    "circularTargets" TEXT,
    "resourceInflows" TEXT,
    "materialsUsedTonnes" DOUBLE PRECISION,
    "secondaryMaterialsPct" DOUBLE PRECISION,
    "resourceOutflows" TEXT,
    "nonRecycledWasteTonnes" DOUBLE PRECISION,
    "circularFinancialEffects" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "csrd_circular_disclosure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "csrd_own_workforce_disclosure" (
    "id" TEXT NOT NULL,
    "csrdReportId" TEXT NOT NULL,
    "workforcePolicies" TEXT,
    "workerEngagement" TEXT,
    "workerRemediation" TEXT,
    "workforceActions" TEXT,
    "workforceTargets" TEXT,
    "employeesTotal" INTEGER,
    "employeesFemale" INTEGER,
    "employeesMale" INTEGER,
    "employeeTurnoverPct" DOUBLE PRECISION,
    "nonEmployeeWorkers" INTEGER,
    "collectiveBargainingPct" DOUBLE PRECISION,
    "genderDiversityTopManagementPct" DOUBLE PRECISION,
    "adequateWagesAllEmployees" BOOLEAN,
    "socialProtection" TEXT,
    "employeesWithDisabilitiesPct" DOUBLE PRECISION,
    "avgTrainingHours" DOUBLE PRECISION,
    "healthSafetyNarrative" TEXT,
    "healthSafetyCoveragePct" DOUBLE PRECISION,
    "fatalities" INTEGER,
    "recordableAccidents" INTEGER,
    "recordableAccidentRate" DOUBLE PRECISION,
    "familyLeaveEntitledPct" DOUBLE PRECISION,
    "genderPayGapPct" DOUBLE PRECISION,
    "remunerationRatio" DOUBLE PRECISION,
    "humanRightsIncidents" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "csrd_own_workforce_disclosure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "csrd_value_chain_workers_disclosure" (
    "id" TEXT NOT NULL,
    "csrdReportId" TEXT NOT NULL,
    "valueChainWorkerPolicies" TEXT,
    "valueChainWorkerEngagement" TEXT,
    "valueChainWorkerRemediation" TEXT,
    "valueChainWorkerActions" TEXT,
    "valueChainWorkerTargets" TEXT,
    "suppliersAssessed" INTEGER,
    "suppliersWithNegativeImpacts" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "csrd_value_chain_workers_disclosure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "csrd_communities_disclosure" (
    "id" TEXT NOT NULL,
    "csrdReportId" TEXT NOT NULL,
    "communityPolicies" TEXT,
    "communityEngagement" TEXT,
    "communityRemediation" TEXT,
    "communityActions" TEXT,
    "communityTargets" TEXT,
    "operationsWithEngagementPct" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "csrd_communities_disclosure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "csrd_consumers_disclosure" (
    "id" TEXT NOT NULL,
    "csrdReportId" TEXT NOT NULL,
    "consumerPolicies" TEXT,
    "consumerEngagement" TEXT,
    "consumerRemediation" TEXT,
    "consumerActions" TEXT,
    "consumerTargets" TEXT,
    "consumerComplaints" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "csrd_consumers_disclosure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "csrd_business_conduct_disclosure" (
    "id" TEXT NOT NULL,
    "csrdReportId" TEXT NOT NULL,
    "conductPolicies" TEXT,
    "supplierRelationships" TEXT,
    "corruptionPrevention" TEXT,
    "antiCorruptionTrainingPct" DOUBLE PRECISION,
    "corruptionIncidents" INTEGER,
    "corruptionFinesEur" DOUBLE PRECISION,
    "politicalInfluence" TEXT,
    "politicalContributionsEur" DOUBLE PRECISION,
    "paymentPractices" TEXT,
    "averageDaysToPay" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "csrd_business_conduct_disclosure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "csrd_reports_companyId_idx" ON "csrd_reports"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "csrd_reports_facilityId_reportingPeriod_key" ON "csrd_reports"("facilityId", "reportingPeriod");

-- CreateIndex
CREATE UNIQUE INDEX "csrd_materiality_assessments_csrdReportId_key" ON "csrd_materiality_assessments"("csrdReportId");

-- CreateIndex
CREATE INDEX "csrd_iros_assessmentId_idx" ON "csrd_iros"("assessmentId");

-- CreateIndex
CREATE INDEX "csrd_material_topics_csrdReportId_idx" ON "csrd_material_topics"("csrdReportId");

-- CreateIndex
CREATE UNIQUE INDEX "csrd_material_topics_csrdReportId_standardCode_key" ON "csrd_material_topics"("csrdReportId", "standardCode");

-- CreateIndex
CREATE UNIQUE INDEX "csrd_general_disclosures_csrdReportId_key" ON "csrd_general_disclosures"("csrdReportId");

-- CreateIndex
CREATE UNIQUE INDEX "csrd_climate_disclosure_csrdReportId_key" ON "csrd_climate_disclosure"("csrdReportId");

-- CreateIndex
CREATE UNIQUE INDEX "csrd_pollution_disclosure_csrdReportId_key" ON "csrd_pollution_disclosure"("csrdReportId");

-- CreateIndex
CREATE UNIQUE INDEX "csrd_water_disclosure_csrdReportId_key" ON "csrd_water_disclosure"("csrdReportId");

-- CreateIndex
CREATE UNIQUE INDEX "csrd_biodiversity_disclosure_csrdReportId_key" ON "csrd_biodiversity_disclosure"("csrdReportId");

-- CreateIndex
CREATE UNIQUE INDEX "csrd_circular_disclosure_csrdReportId_key" ON "csrd_circular_disclosure"("csrdReportId");

-- CreateIndex
CREATE UNIQUE INDEX "csrd_own_workforce_disclosure_csrdReportId_key" ON "csrd_own_workforce_disclosure"("csrdReportId");

-- CreateIndex
CREATE UNIQUE INDEX "csrd_value_chain_workers_disclosure_csrdReportId_key" ON "csrd_value_chain_workers_disclosure"("csrdReportId");

-- CreateIndex
CREATE UNIQUE INDEX "csrd_communities_disclosure_csrdReportId_key" ON "csrd_communities_disclosure"("csrdReportId");

-- CreateIndex
CREATE UNIQUE INDEX "csrd_consumers_disclosure_csrdReportId_key" ON "csrd_consumers_disclosure"("csrdReportId");

-- CreateIndex
CREATE UNIQUE INDEX "csrd_business_conduct_disclosure_csrdReportId_key" ON "csrd_business_conduct_disclosure"("csrdReportId");

-- AddForeignKey
ALTER TABLE "csrd_reports" ADD CONSTRAINT "csrd_reports_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csrd_reports" ADD CONSTRAINT "csrd_reports_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csrd_materiality_assessments" ADD CONSTRAINT "csrd_materiality_assessments_csrdReportId_fkey" FOREIGN KEY ("csrdReportId") REFERENCES "csrd_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csrd_iros" ADD CONSTRAINT "csrd_iros_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "csrd_materiality_assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csrd_material_topics" ADD CONSTRAINT "csrd_material_topics_csrdReportId_fkey" FOREIGN KEY ("csrdReportId") REFERENCES "csrd_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csrd_general_disclosures" ADD CONSTRAINT "csrd_general_disclosures_csrdReportId_fkey" FOREIGN KEY ("csrdReportId") REFERENCES "csrd_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csrd_climate_disclosure" ADD CONSTRAINT "csrd_climate_disclosure_csrdReportId_fkey" FOREIGN KEY ("csrdReportId") REFERENCES "csrd_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csrd_pollution_disclosure" ADD CONSTRAINT "csrd_pollution_disclosure_csrdReportId_fkey" FOREIGN KEY ("csrdReportId") REFERENCES "csrd_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csrd_water_disclosure" ADD CONSTRAINT "csrd_water_disclosure_csrdReportId_fkey" FOREIGN KEY ("csrdReportId") REFERENCES "csrd_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csrd_biodiversity_disclosure" ADD CONSTRAINT "csrd_biodiversity_disclosure_csrdReportId_fkey" FOREIGN KEY ("csrdReportId") REFERENCES "csrd_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csrd_circular_disclosure" ADD CONSTRAINT "csrd_circular_disclosure_csrdReportId_fkey" FOREIGN KEY ("csrdReportId") REFERENCES "csrd_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csrd_own_workforce_disclosure" ADD CONSTRAINT "csrd_own_workforce_disclosure_csrdReportId_fkey" FOREIGN KEY ("csrdReportId") REFERENCES "csrd_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csrd_value_chain_workers_disclosure" ADD CONSTRAINT "csrd_value_chain_workers_disclosure_csrdReportId_fkey" FOREIGN KEY ("csrdReportId") REFERENCES "csrd_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csrd_communities_disclosure" ADD CONSTRAINT "csrd_communities_disclosure_csrdReportId_fkey" FOREIGN KEY ("csrdReportId") REFERENCES "csrd_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csrd_consumers_disclosure" ADD CONSTRAINT "csrd_consumers_disclosure_csrdReportId_fkey" FOREIGN KEY ("csrdReportId") REFERENCES "csrd_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csrd_business_conduct_disclosure" ADD CONSTRAINT "csrd_business_conduct_disclosure_csrdReportId_fkey" FOREIGN KEY ("csrdReportId") REFERENCES "csrd_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
