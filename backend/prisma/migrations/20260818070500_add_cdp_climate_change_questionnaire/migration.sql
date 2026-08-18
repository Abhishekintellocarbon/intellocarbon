-- CreateEnum
CREATE TYPE "CdpRiskKind" AS ENUM ('RISK', 'OPPORTUNITY');

-- CreateEnum
CREATE TYPE "CdpTimeHorizon" AS ENUM ('SHORT_TERM', 'MEDIUM_TERM', 'LONG_TERM');

-- CreateEnum
CREATE TYPE "CdpTargetKind" AS ENUM ('ABSOLUTE', 'INTENSITY');

-- CreateEnum
CREATE TYPE "CdpBreakdownDimension" AS ENUM ('GAS', 'COUNTRY', 'BUSINESS_DIVISION', 'ACTIVITY');

-- CreateEnum
CREATE TYPE "CdpBreakdownScope" AS ENUM ('SCOPE_1', 'SCOPE_2');

-- CreateTable
CREATE TABLE "cdp_reports" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "reportingPeriod" TEXT NOT NULL,
    "revenue" DOUBLE PRECISION,
    "status" "DataEntryStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cdp_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cdp_introduction" (
    "id" TEXT NOT NULL,
    "cdpReportId" TEXT NOT NULL,
    "organizationDescription" TEXT,
    "countriesOfOperation" TEXT,
    "reportingCurrency" TEXT,
    "consolidationApproach" TEXT,
    "organizationalBoundary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cdp_introduction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cdp_governance" (
    "id" TEXT NOT NULL,
    "cdpReportId" TEXT NOT NULL,
    "boardOversight" BOOLEAN,
    "boardOversightPosition" TEXT,
    "boardOversightDetail" TEXT,
    "boardReviewFrequency" TEXT,
    "managementResponsibility" TEXT,
    "managementReportingLine" TEXT,
    "climateIncentives" BOOLEAN,
    "climateIncentivesDetail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cdp_governance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cdp_risks_opportunities" (
    "id" TEXT NOT NULL,
    "cdpReportId" TEXT NOT NULL,
    "hasRiskProcess" BOOLEAN,
    "timeHorizonDefinition" TEXT,
    "shortTermYears" INTEGER,
    "mediumTermYears" INTEGER,
    "longTermYears" INTEGER,
    "substantiveImpactDefinition" TEXT,
    "riskProcessDescription" TEXT,
    "riskProcessIntegrated" BOOLEAN,
    "hasSubstantiveRisks" BOOLEAN,
    "hasSubstantiveOpportunities" BOOLEAN,
    "realizedImpacts" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cdp_risks_opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cdp_risks" (
    "id" TEXT NOT NULL,
    "cdpReportId" TEXT NOT NULL,
    "kind" "CdpRiskKind" NOT NULL,
    "riskType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "valueChainStage" TEXT,
    "timeHorizon" "CdpTimeHorizon",
    "likelihood" TEXT,
    "magnitude" TEXT,
    "financialImpactMin" DOUBLE PRECISION,
    "financialImpactMax" DOUBLE PRECISION,
    "impactDescription" TEXT,
    "responseStrategy" TEXT,
    "responseCost" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cdp_risks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cdp_business_strategy" (
    "id" TEXT NOT NULL,
    "cdpReportId" TEXT NOT NULL,
    "transitionPlan" TEXT,
    "transitionPlanDetail" TEXT,
    "usesScenarioAnalysis" TEXT,
    "scenariosUsed" TEXT,
    "scenarioResults" TEXT,
    "strategyInfluence" TEXT,
    "financialPlanningInfluence" TEXT,
    "lowCarbonCapex" DOUBLE PRECISION,
    "lowCarbonCapexPct" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cdp_business_strategy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cdp_targets_performance" (
    "id" TEXT NOT NULL,
    "cdpReportId" TEXT NOT NULL,
    "targetType" TEXT,
    "sbtiValidated" BOOLEAN,
    "sbtiDetail" TEXT,
    "otherTargets" TEXT,
    "hasInitiatives" BOOLEAN,
    "initiativeCount" INTEGER,
    "initiativeSavingsTco2e" DOUBLE PRECISION,
    "initiativeDetail" TEXT,
    "lowCarbonProducts" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cdp_targets_performance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cdp_targets" (
    "id" TEXT NOT NULL,
    "cdpReportId" TEXT NOT NULL,
    "kind" "CdpTargetKind" NOT NULL,
    "scopesCovered" TEXT NOT NULL,
    "baseYear" INTEGER NOT NULL,
    "baseYearEmissionsTco2e" DOUBLE PRECISION,
    "targetYear" INTEGER NOT NULL,
    "reductionPct" DOUBLE PRECISION,
    "intensityMetric" TEXT,
    "baseYearIntensity" DOUBLE PRECISION,
    "targetIntensity" DOUBLE PRECISION,
    "percentAchieved" DOUBLE PRECISION,
    "isScienceBased" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cdp_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cdp_emissions_methodology" (
    "id" TEXT NOT NULL,
    "cdpReportId" TEXT NOT NULL,
    "baseYear" INTEGER,
    "baseYearScope1Tco2e" DOUBLE PRECISION,
    "baseYearScope2LocationTco2e" DOUBLE PRECISION,
    "baseYearScope2MarketTco2e" DOUBLE PRECISION,
    "baseYearScope3Tco2e" DOUBLE PRECISION,
    "standardsUsed" TEXT,
    "gwpSource" TEXT,
    "baseYearRecalculation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cdp_emissions_methodology_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cdp_emissions_data" (
    "id" TEXT NOT NULL,
    "cdpReportId" TEXT NOT NULL,
    "scope1Description" TEXT,
    "scope2Approach" TEXT,
    "scope2MarketTco2e" DOUBLE PRECISION,
    "exclusions" TEXT,
    "scope3Description" TEXT,
    "biogenicCo2Tonnes" DOUBLE PRECISION,
    "otherIntensityMetric" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cdp_emissions_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cdp_emissions_breakdown_module" (
    "id" TEXT NOT NULL,
    "cdpReportId" TEXT NOT NULL,
    "breakdownByGas" BOOLEAN,
    "breakdownByCountryNote" TEXT,
    "breakdownByDivisionNote" TEXT,
    "scope2BreakdownNote" TEXT,
    "yearOnYearDirection" TEXT,
    "yearOnYearExplanation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cdp_emissions_breakdown_module_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cdp_emissions_breakdown" (
    "id" TEXT NOT NULL,
    "cdpReportId" TEXT NOT NULL,
    "dimension" "CdpBreakdownDimension" NOT NULL,
    "scope" "CdpBreakdownScope" NOT NULL DEFAULT 'SCOPE_1',
    "label" TEXT NOT NULL,
    "emissionsTco2e" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cdp_emissions_breakdown_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cdp_energy" (
    "id" TEXT NOT NULL,
    "cdpReportId" TEXT NOT NULL,
    "energySpendPct" DOUBLE PRECISION,
    "energyActivities" TEXT,
    "fuelConsumptionMwh" DOUBLE PRECISION,
    "electricityGeneratedMwh" DOUBLE PRECISION,
    "renewableGeneratedMwh" DOUBLE PRECISION,
    "lowCarbonEnergyPlan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cdp_energy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cdp_additional_metrics" (
    "id" TEXT NOT NULL,
    "cdpReportId" TEXT NOT NULL,
    "additionalMetrics" TEXT,
    "sectorMetricName" TEXT,
    "sectorMetricValue" DOUBLE PRECISION,
    "sectorMetricUnit" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cdp_additional_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cdp_verification" (
    "id" TEXT NOT NULL,
    "cdpReportId" TEXT NOT NULL,
    "scope1Assurance" TEXT,
    "scope2Assurance" TEXT,
    "scope3Assurance" TEXT,
    "assuranceProvider" TEXT,
    "assuranceStandard" TEXT,
    "assuranceYear" INTEGER,
    "otherVerification" TEXT,
    "assuranceScope" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cdp_verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cdp_carbon_pricing" (
    "id" TEXT NOT NULL,
    "cdpReportId" TEXT NOT NULL,
    "regulatedByCarbonPricing" BOOLEAN,
    "carbonPricingSystems" TEXT,
    "coveredEmissionsTco2e" DOUBLE PRECISION,
    "carbonPricingStrategy" TEXT,
    "usesCarbonCredits" BOOLEAN,
    "carbonCreditsDetail" TEXT,
    "usesInternalCarbonPrice" TEXT,
    "internalPriceType" TEXT,
    "internalCarbonPrice" DOUBLE PRECISION,
    "internalPriceApplication" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cdp_carbon_pricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cdp_engagement" (
    "id" TEXT NOT NULL,
    "cdpReportId" TEXT NOT NULL,
    "engagesValueChain" BOOLEAN,
    "supplierEngagement" TEXT,
    "suppliersEngagedPct" DOUBLE PRECISION,
    "scope3CoveredByEngagementPct" DOUBLE PRECISION,
    "customerEngagement" TEXT,
    "supplierRequirements" BOOLEAN,
    "policyEngagement" BOOLEAN,
    "policyEngagementDetail" TEXT,
    "publications" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cdp_engagement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cdp_signoff" (
    "id" TEXT NOT NULL,
    "cdpReportId" TEXT NOT NULL,
    "submitterJobTitle" TEXT,
    "submitterJobCategory" TEXT,
    "finalStatement" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cdp_signoff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cdp_reports_companyId_idx" ON "cdp_reports"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "cdp_reports_facilityId_reportingPeriod_key" ON "cdp_reports"("facilityId", "reportingPeriod");

-- CreateIndex
CREATE UNIQUE INDEX "cdp_introduction_cdpReportId_key" ON "cdp_introduction"("cdpReportId");

-- CreateIndex
CREATE UNIQUE INDEX "cdp_governance_cdpReportId_key" ON "cdp_governance"("cdpReportId");

-- CreateIndex
CREATE UNIQUE INDEX "cdp_risks_opportunities_cdpReportId_key" ON "cdp_risks_opportunities"("cdpReportId");

-- CreateIndex
CREATE INDEX "cdp_risks_cdpReportId_idx" ON "cdp_risks"("cdpReportId");

-- CreateIndex
CREATE UNIQUE INDEX "cdp_business_strategy_cdpReportId_key" ON "cdp_business_strategy"("cdpReportId");

-- CreateIndex
CREATE UNIQUE INDEX "cdp_targets_performance_cdpReportId_key" ON "cdp_targets_performance"("cdpReportId");

-- CreateIndex
CREATE INDEX "cdp_targets_cdpReportId_idx" ON "cdp_targets"("cdpReportId");

-- CreateIndex
CREATE UNIQUE INDEX "cdp_emissions_methodology_cdpReportId_key" ON "cdp_emissions_methodology"("cdpReportId");

-- CreateIndex
CREATE UNIQUE INDEX "cdp_emissions_data_cdpReportId_key" ON "cdp_emissions_data"("cdpReportId");

-- CreateIndex
CREATE UNIQUE INDEX "cdp_emissions_breakdown_module_cdpReportId_key" ON "cdp_emissions_breakdown_module"("cdpReportId");

-- CreateIndex
CREATE INDEX "cdp_emissions_breakdown_cdpReportId_idx" ON "cdp_emissions_breakdown"("cdpReportId");

-- CreateIndex
CREATE UNIQUE INDEX "cdp_energy_cdpReportId_key" ON "cdp_energy"("cdpReportId");

-- CreateIndex
CREATE UNIQUE INDEX "cdp_additional_metrics_cdpReportId_key" ON "cdp_additional_metrics"("cdpReportId");

-- CreateIndex
CREATE UNIQUE INDEX "cdp_verification_cdpReportId_key" ON "cdp_verification"("cdpReportId");

-- CreateIndex
CREATE UNIQUE INDEX "cdp_carbon_pricing_cdpReportId_key" ON "cdp_carbon_pricing"("cdpReportId");

-- CreateIndex
CREATE UNIQUE INDEX "cdp_engagement_cdpReportId_key" ON "cdp_engagement"("cdpReportId");

-- CreateIndex
CREATE UNIQUE INDEX "cdp_signoff_cdpReportId_key" ON "cdp_signoff"("cdpReportId");

-- AddForeignKey
ALTER TABLE "cdp_reports" ADD CONSTRAINT "cdp_reports_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cdp_reports" ADD CONSTRAINT "cdp_reports_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cdp_introduction" ADD CONSTRAINT "cdp_introduction_cdpReportId_fkey" FOREIGN KEY ("cdpReportId") REFERENCES "cdp_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cdp_governance" ADD CONSTRAINT "cdp_governance_cdpReportId_fkey" FOREIGN KEY ("cdpReportId") REFERENCES "cdp_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cdp_risks_opportunities" ADD CONSTRAINT "cdp_risks_opportunities_cdpReportId_fkey" FOREIGN KEY ("cdpReportId") REFERENCES "cdp_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cdp_risks" ADD CONSTRAINT "cdp_risks_cdpReportId_fkey" FOREIGN KEY ("cdpReportId") REFERENCES "cdp_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cdp_business_strategy" ADD CONSTRAINT "cdp_business_strategy_cdpReportId_fkey" FOREIGN KEY ("cdpReportId") REFERENCES "cdp_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cdp_targets_performance" ADD CONSTRAINT "cdp_targets_performance_cdpReportId_fkey" FOREIGN KEY ("cdpReportId") REFERENCES "cdp_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cdp_targets" ADD CONSTRAINT "cdp_targets_cdpReportId_fkey" FOREIGN KEY ("cdpReportId") REFERENCES "cdp_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cdp_emissions_methodology" ADD CONSTRAINT "cdp_emissions_methodology_cdpReportId_fkey" FOREIGN KEY ("cdpReportId") REFERENCES "cdp_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cdp_emissions_data" ADD CONSTRAINT "cdp_emissions_data_cdpReportId_fkey" FOREIGN KEY ("cdpReportId") REFERENCES "cdp_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cdp_emissions_breakdown_module" ADD CONSTRAINT "cdp_emissions_breakdown_module_cdpReportId_fkey" FOREIGN KEY ("cdpReportId") REFERENCES "cdp_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cdp_emissions_breakdown" ADD CONSTRAINT "cdp_emissions_breakdown_cdpReportId_fkey" FOREIGN KEY ("cdpReportId") REFERENCES "cdp_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cdp_energy" ADD CONSTRAINT "cdp_energy_cdpReportId_fkey" FOREIGN KEY ("cdpReportId") REFERENCES "cdp_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cdp_additional_metrics" ADD CONSTRAINT "cdp_additional_metrics_cdpReportId_fkey" FOREIGN KEY ("cdpReportId") REFERENCES "cdp_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cdp_verification" ADD CONSTRAINT "cdp_verification_cdpReportId_fkey" FOREIGN KEY ("cdpReportId") REFERENCES "cdp_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cdp_carbon_pricing" ADD CONSTRAINT "cdp_carbon_pricing_cdpReportId_fkey" FOREIGN KEY ("cdpReportId") REFERENCES "cdp_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cdp_engagement" ADD CONSTRAINT "cdp_engagement_cdpReportId_fkey" FOREIGN KEY ("cdpReportId") REFERENCES "cdp_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cdp_signoff" ADD CONSTRAINT "cdp_signoff_cdpReportId_fkey" FOREIGN KEY ("cdpReportId") REFERENCES "cdp_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
