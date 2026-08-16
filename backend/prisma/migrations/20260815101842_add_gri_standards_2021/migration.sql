-- CreateEnum
CREATE TYPE "GriImpactType" AS ENUM ('NEGATIVE_ACTUAL', 'NEGATIVE_POTENTIAL', 'POSITIVE_ACTUAL', 'POSITIVE_POTENTIAL');

-- CreateEnum
CREATE TYPE "GriValueChainLocation" AS ENUM ('OWN_OPERATIONS', 'UPSTREAM', 'DOWNSTREAM');

-- AlterEnum
ALTER TYPE "ReportType" ADD VALUE 'GRI';

-- CreateTable
CREATE TABLE "gri_reports" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "reportingPeriod" TEXT NOT NULL,
    "turnoverInr" DOUBLE PRECISION,
    "status" "DataEntryStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gri_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gri_materiality_assessments" (
    "id" TEXT NOT NULL,
    "griReportId" TEXT NOT NULL,
    "stakeholderGroups" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "stakeholderEngagementApproach" TEXT,
    "impactIdentificationProcess" TEXT,
    "prioritisationProcess" TEXT,
    "materialityThreshold" DOUBLE PRECISION NOT NULL DEFAULT 3,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gri_materiality_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gri_impacts" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "topicCode" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "impactType" "GriImpactType" NOT NULL,
    "valueChainLocation" "GriValueChainLocation" NOT NULL DEFAULT 'OWN_OPERATIONS',
    "scale" INTEGER NOT NULL,
    "scope" INTEGER NOT NULL,
    "irremediability" INTEGER,
    "likelihood" INTEGER,
    "significanceScore" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gri_impacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gri_material_topics" (
    "id" TEXT NOT NULL,
    "griReportId" TEXT NOT NULL,
    "topicCode" TEXT NOT NULL,
    "isMaterial" BOOLEAN NOT NULL DEFAULT false,
    "significanceScore" DOUBLE PRECISION,
    "rank" INTEGER,
    "notMaterialRationale" TEXT,
    "impactsDescription" TEXT,
    "involvementDescription" TEXT,
    "policiesCommitments" TEXT,
    "actionsTaken" TEXT,
    "effectivenessTracking" TEXT,
    "stakeholderEngagement" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gri_material_topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gri_universal_disclosures" (
    "id" TEXT NOT NULL,
    "griReportId" TEXT NOT NULL,
    "legalName" TEXT,
    "ownershipLegalForm" TEXT,
    "headquartersLocation" TEXT,
    "countriesOfOperation" TEXT,
    "entitiesIncluded" TEXT,
    "reportingFrequency" TEXT,
    "contactPoint" TEXT,
    "publicationDate" TIMESTAMP(3),
    "restatements" TEXT,
    "externalAssurancePolicy" TEXT,
    "assuranceProvider" TEXT,
    "assuranceLevel" TEXT,
    "sectorsServed" TEXT,
    "valueChainDescription" TEXT,
    "significantChangesToValueChain" TEXT,
    "employeesTotal" INTEGER,
    "employeesFemale" INTEGER,
    "employeesMale" INTEGER,
    "employeesPermanent" INTEGER,
    "employeesTemporary" INTEGER,
    "employeesFullTime" INTEGER,
    "employeesPartTime" INTEGER,
    "employeeDataMethodology" TEXT,
    "nonEmployeeWorkersTotal" INTEGER,
    "nonEmployeeWorkersDescription" TEXT,
    "governanceStructure" TEXT,
    "governanceCommittees" TEXT,
    "governanceNominationProcess" TEXT,
    "chairIsSeniorExecutive" BOOLEAN,
    "chairRoleDescription" TEXT,
    "governanceImpactOversight" TEXT,
    "impactResponsibilityDelegation" TEXT,
    "governanceReportingRole" TEXT,
    "conflictsOfInterestProcess" TEXT,
    "criticalConcernsProcess" TEXT,
    "criticalConcernsCount" INTEGER,
    "governanceCollectiveKnowledge" TEXT,
    "governancePerformanceEvaluation" TEXT,
    "remunerationPolicies" TEXT,
    "remunerationProcess" TEXT,
    "compensationRatio" DOUBLE PRECISION,
    "compensationRatioIncreasePct" DOUBLE PRECISION,
    "sustainableDevelopmentStatement" TEXT,
    "policyCommitments" TEXT,
    "humanRightsPolicyCommitment" TEXT,
    "policyEmbedding" TEXT,
    "remediationProcesses" TEXT,
    "adviceAndConcernsMechanisms" TEXT,
    "significantFinesCount" INTEGER,
    "significantFinesValueInr" DOUBLE PRECISION,
    "nonMonetarySanctionsCount" INTEGER,
    "complianceIncidentsDescription" TEXT,
    "membershipAssociations" TEXT,
    "stakeholderEngagementApproach" TEXT,
    "collectiveBargainingCoveragePct" DOUBLE PRECISION,
    "collectiveBargainingDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gri_universal_disclosures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gri_materials_disclosures" (
    "id" TEXT NOT NULL,
    "griReportId" TEXT NOT NULL,
    "renewableMaterialsTonnes" DOUBLE PRECISION,
    "nonRenewableMaterialsTonnes" DOUBLE PRECISION,
    "materialsMethodology" TEXT,
    "recycledInputPct" DOUBLE PRECISION,
    "reclaimedProductsPct" DOUBLE PRECISION,
    "reclaimedByCategory" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gri_materials_disclosures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gri_energy_disclosures" (
    "id" TEXT NOT NULL,
    "griReportId" TEXT NOT NULL,
    "nonRenewableFuelGj" DOUBLE PRECISION,
    "renewableFuelGj" DOUBLE PRECISION,
    "electricityConsumedGj" DOUBLE PRECISION,
    "heatingConsumedGj" DOUBLE PRECISION,
    "coolingConsumedGj" DOUBLE PRECISION,
    "steamConsumedGj" DOUBLE PRECISION,
    "electricitySoldGj" DOUBLE PRECISION,
    "energyStandardsUsed" TEXT,
    "energyOutsideOrgGj" DOUBLE PRECISION,
    "intensityDenominatorDescription" TEXT,
    "intensityIncludesOutsideOrg" BOOLEAN,
    "energyReductionGj" DOUBLE PRECISION,
    "energyReductionBaseYear" INTEGER,
    "energyReductionBasis" TEXT,
    "productEnergyReductionGj" DOUBLE PRECISION,
    "productEnergyReductionBasis" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gri_energy_disclosures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gri_water_disclosures" (
    "id" TEXT NOT NULL,
    "griReportId" TEXT NOT NULL,
    "interactionsNarrative" TEXT,
    "waterStressAssessmentTool" TEXT,
    "dischargeImpactManagement" TEXT,
    "minimumEffluentStandards" TEXT,
    "withdrawalTotalMl" DOUBLE PRECISION,
    "withdrawalWaterStressedMl" DOUBLE PRECISION,
    "withdrawalFreshwaterMl" DOUBLE PRECISION,
    "dischargeTotalMl" DOUBLE PRECISION,
    "dischargeWaterStressedMl" DOUBLE PRECISION,
    "dischargeFreshwaterMl" DOUBLE PRECISION,
    "prioritySubstancesOfConcern" TEXT,
    "consumptionTotalMl" DOUBLE PRECISION,
    "consumptionWaterStressedMl" DOUBLE PRECISION,
    "storageChangeMl" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gri_water_disclosures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gri_biodiversity_disclosures" (
    "id" TEXT NOT NULL,
    "griReportId" TEXT NOT NULL,
    "policiesNarrative" TEXT,
    "mitigationHierarchy" TEXT,
    "landRestoredHa" DOUBLE PRECISION,
    "accessBenefitSharing" TEXT,
    "impactIdentificationProcess" TEXT,
    "sitesTotalCount" INTEGER,
    "sitesInProtectedAreasCount" INTEGER,
    "sitesNearProtectedAreasCount" INTEGER,
    "siteLocationsDescription" TEXT,
    "driverLandUseChange" TEXT,
    "driverResourceExploitation" TEXT,
    "driverClimateChange" TEXT,
    "driverPollution" TEXT,
    "driverInvasiveSpecies" TEXT,
    "landUseChangeHa" DOUBLE PRECISION,
    "stateOfBiodiversityChanges" TEXT,
    "ecosystemServicesAffected" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gri_biodiversity_disclosures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gri_emissions_disclosures" (
    "id" TEXT NOT NULL,
    "griReportId" TEXT NOT NULL,
    "biogenicCo2Tonnes" DOUBLE PRECISION,
    "baseYear" INTEGER,
    "baseYearEmissionsTco2e" DOUBLE PRECISION,
    "gasesIncluded" TEXT,
    "consolidationApproach" TEXT,
    "emissionsStandardsUsed" TEXT,
    "scope2MarketBasedTco2e" DOUBLE PRECISION,
    "scope3CategoriesIncluded" TEXT,
    "intensityDenominatorDescription" TEXT,
    "intensityGasesIncluded" TEXT,
    "reductionTco2e" DOUBLE PRECISION,
    "reductionBaseYear" INTEGER,
    "reductionScopesIncluded" TEXT,
    "odsCfc11EquivalentTonnes" DOUBLE PRECISION,
    "odsSubstancesIncluded" TEXT,
    "noxTonnes" DOUBLE PRECISION,
    "soxTonnes" DOUBLE PRECISION,
    "vocTonnes" DOUBLE PRECISION,
    "particulateMatterTonnes" DOUBLE PRECISION,
    "persistentOrganicPollutantsTonnes" DOUBLE PRECISION,
    "hazardousAirPollutantsTonnes" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gri_emissions_disclosures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gri_waste_disclosures" (
    "id" TEXT NOT NULL,
    "griReportId" TEXT NOT NULL,
    "wasteImpactsNarrative" TEXT,
    "wasteManagementNarrative" TEXT,
    "thirdPartyWasteManagement" TEXT,
    "wasteCompositionDescription" TEXT,
    "hazardousDivertedReuseT" DOUBLE PRECISION,
    "hazardousDivertedRecyclingT" DOUBLE PRECISION,
    "hazardousDivertedOtherRecoveryT" DOUBLE PRECISION,
    "nonHazardousDivertedReuseT" DOUBLE PRECISION,
    "nonHazardousDivertedRecyclingT" DOUBLE PRECISION,
    "nonHazardousDivertedOtherRecoveryT" DOUBLE PRECISION,
    "hazardousDisposalIncinerationWithRecoveryT" DOUBLE PRECISION,
    "hazardousDisposalIncinerationNoRecoveryT" DOUBLE PRECISION,
    "hazardousDisposalLandfillT" DOUBLE PRECISION,
    "hazardousDisposalOtherT" DOUBLE PRECISION,
    "nonHazardousDisposalIncinerationWithRecoveryT" DOUBLE PRECISION,
    "nonHazardousDisposalIncinerationNoRecoveryT" DOUBLE PRECISION,
    "nonHazardousDisposalLandfillT" DOUBLE PRECISION,
    "nonHazardousDisposalOtherT" DOUBLE PRECISION,
    "onsiteOffsiteBreakdown" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gri_waste_disclosures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gri_supplier_env_disclosures" (
    "id" TEXT NOT NULL,
    "griReportId" TEXT NOT NULL,
    "newSuppliersScreenedPct" DOUBLE PRECISION,
    "newSuppliersTotalCount" INTEGER,
    "screeningCriteria" TEXT,
    "suppliersAssessedCount" INTEGER,
    "suppliersWithNegativeImpactsCount" INTEGER,
    "suppliersWithImprovementsAgreedCount" INTEGER,
    "suppliersTerminatedCount" INTEGER,
    "negativeImpactsDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gri_supplier_env_disclosures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gri_employment_disclosures" (
    "id" TEXT NOT NULL,
    "griReportId" TEXT NOT NULL,
    "newHiresTotal" INTEGER,
    "newHiresFemale" INTEGER,
    "newHiresUnder30" INTEGER,
    "newHires30To50" INTEGER,
    "newHiresOver50" INTEGER,
    "turnoverTotal" INTEGER,
    "turnoverFemale" INTEGER,
    "turnoverUnder30" INTEGER,
    "turnover30To50" INTEGER,
    "turnoverOver50" INTEGER,
    "hiresTurnoverRegionalBreakdown" TEXT,
    "benefitsDescription" TEXT,
    "parentalLeaveEntitledMale" INTEGER,
    "parentalLeaveEntitledFemale" INTEGER,
    "parentalLeaveTookMale" INTEGER,
    "parentalLeaveTookFemale" INTEGER,
    "parentalLeaveReturnedMale" INTEGER,
    "parentalLeaveReturnedFemale" INTEGER,
    "parentalLeaveRetainedMale" INTEGER,
    "parentalLeaveRetainedFemale" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gri_employment_disclosures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gri_ohs_disclosures" (
    "id" TEXT NOT NULL,
    "griReportId" TEXT NOT NULL,
    "managementSystemDescription" TEXT,
    "managementSystemIsIso45001" BOOLEAN,
    "hazardIdentificationProcess" TEXT,
    "occupationalHealthServices" TEXT,
    "workerParticipation" TEXT,
    "workerOhsTraining" TEXT,
    "workerHealthPromotion" TEXT,
    "businessRelationshipOhsImpacts" TEXT,
    "workersCoveredCount" INTEGER,
    "workersCoveredPct" DOUBLE PRECISION,
    "hoursWorked" DOUBLE PRECISION,
    "fatalitiesEmployees" INTEGER,
    "fatalitiesNonEmployees" INTEGER,
    "highConsequenceInjuriesEmployees" INTEGER,
    "highConsequenceInjuriesNonEmployees" INTEGER,
    "recordableInjuriesEmployees" INTEGER,
    "recordableInjuriesNonEmployees" INTEGER,
    "mainInjuryTypes" TEXT,
    "rateBasisHours" INTEGER,
    "illHealthFatalitiesEmployees" INTEGER,
    "illHealthCasesEmployees" INTEGER,
    "illHealthFatalitiesNonEmployees" INTEGER,
    "illHealthCasesNonEmployees" INTEGER,
    "illHealthHazards" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gri_ohs_disclosures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gri_training_disclosures" (
    "id" TEXT NOT NULL,
    "griReportId" TEXT NOT NULL,
    "avgTrainingHoursPerEmployee" DOUBLE PRECISION,
    "avgTrainingHoursMale" DOUBLE PRECISION,
    "avgTrainingHoursFemale" DOUBLE PRECISION,
    "avgTrainingHoursManagement" DOUBLE PRECISION,
    "avgTrainingHoursNonManagement" DOUBLE PRECISION,
    "skillsProgramsDescription" TEXT,
    "transitionAssistanceDescription" TEXT,
    "performanceReviewPct" DOUBLE PRECISION,
    "performanceReviewMalePct" DOUBLE PRECISION,
    "performanceReviewFemalePct" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gri_training_disclosures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gri_diversity_disclosures" (
    "id" TEXT NOT NULL,
    "griReportId" TEXT NOT NULL,
    "governanceBodyTotal" INTEGER,
    "governanceBodyFemale" INTEGER,
    "governanceBodyUnder30" INTEGER,
    "governanceBody30To50" INTEGER,
    "governanceBodyOver50" INTEGER,
    "employeesFemalePct" DOUBLE PRECISION,
    "employeesUnder30Pct" DOUBLE PRECISION,
    "employees30To50Pct" DOUBLE PRECISION,
    "employeesOver50Pct" DOUBLE PRECISION,
    "otherDiversityIndicators" TEXT,
    "salaryRatioOverall" DOUBLE PRECISION,
    "salaryRatioManagement" DOUBLE PRECISION,
    "salaryRatioNonManagement" DOUBLE PRECISION,
    "salaryRatioBasis" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gri_diversity_disclosures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gri_non_discrimination_disclosures" (
    "id" TEXT NOT NULL,
    "griReportId" TEXT NOT NULL,
    "incidentsCount" INTEGER,
    "incidentsReviewedCount" INTEGER,
    "remediationPlansImplementedCount" INTEGER,
    "incidentsNoLongerSubjectToActionCount" INTEGER,
    "correctiveActionsDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gri_non_discrimination_disclosures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gri_local_communities_disclosures" (
    "id" TEXT NOT NULL,
    "griReportId" TEXT NOT NULL,
    "operationsWithEngagementPct" DOUBLE PRECISION,
    "operationsWithImpactAssessmentPct" DOUBLE PRECISION,
    "operationsWithDevelopmentProgramsPct" DOUBLE PRECISION,
    "engagementDescription" TEXT,
    "operationsWithNegativeImpactsCount" INTEGER,
    "negativeImpactsDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gri_local_communities_disclosures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gri_supplier_social_disclosures" (
    "id" TEXT NOT NULL,
    "griReportId" TEXT NOT NULL,
    "newSuppliersScreenedPct" DOUBLE PRECISION,
    "newSuppliersTotalCount" INTEGER,
    "screeningCriteria" TEXT,
    "suppliersAssessedCount" INTEGER,
    "suppliersWithNegativeImpactsCount" INTEGER,
    "suppliersWithImprovementsAgreedCount" INTEGER,
    "suppliersTerminatedCount" INTEGER,
    "negativeImpactsDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gri_supplier_social_disclosures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gri_customer_hs_disclosures" (
    "id" TEXT NOT NULL,
    "griReportId" TEXT NOT NULL,
    "productCategoriesAssessedPct" DOUBLE PRECISION,
    "assessmentDescription" TEXT,
    "nonComplianceFinesCount" INTEGER,
    "nonComplianceWarningsCount" INTEGER,
    "nonComplianceVoluntaryCodesCount" INTEGER,
    "nonComplianceDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gri_customer_hs_disclosures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gri_customer_privacy_disclosures" (
    "id" TEXT NOT NULL,
    "griReportId" TEXT NOT NULL,
    "complaintsFromThirdPartiesCount" INTEGER,
    "complaintsFromRegulatorsCount" INTEGER,
    "dataBreachesCount" INTEGER,
    "customersAffectedCount" INTEGER,
    "breachDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gri_customer_privacy_disclosures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "gri_reports_companyId_idx" ON "gri_reports"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "gri_reports_facilityId_reportingPeriod_key" ON "gri_reports"("facilityId", "reportingPeriod");

-- CreateIndex
CREATE UNIQUE INDEX "gri_materiality_assessments_griReportId_key" ON "gri_materiality_assessments"("griReportId");

-- CreateIndex
CREATE INDEX "gri_impacts_assessmentId_idx" ON "gri_impacts"("assessmentId");

-- CreateIndex
CREATE INDEX "gri_material_topics_griReportId_idx" ON "gri_material_topics"("griReportId");

-- CreateIndex
CREATE UNIQUE INDEX "gri_material_topics_griReportId_topicCode_key" ON "gri_material_topics"("griReportId", "topicCode");

-- CreateIndex
CREATE UNIQUE INDEX "gri_universal_disclosures_griReportId_key" ON "gri_universal_disclosures"("griReportId");

-- CreateIndex
CREATE UNIQUE INDEX "gri_materials_disclosures_griReportId_key" ON "gri_materials_disclosures"("griReportId");

-- CreateIndex
CREATE UNIQUE INDEX "gri_energy_disclosures_griReportId_key" ON "gri_energy_disclosures"("griReportId");

-- CreateIndex
CREATE UNIQUE INDEX "gri_water_disclosures_griReportId_key" ON "gri_water_disclosures"("griReportId");

-- CreateIndex
CREATE UNIQUE INDEX "gri_biodiversity_disclosures_griReportId_key" ON "gri_biodiversity_disclosures"("griReportId");

-- CreateIndex
CREATE UNIQUE INDEX "gri_emissions_disclosures_griReportId_key" ON "gri_emissions_disclosures"("griReportId");

-- CreateIndex
CREATE UNIQUE INDEX "gri_waste_disclosures_griReportId_key" ON "gri_waste_disclosures"("griReportId");

-- CreateIndex
CREATE UNIQUE INDEX "gri_supplier_env_disclosures_griReportId_key" ON "gri_supplier_env_disclosures"("griReportId");

-- CreateIndex
CREATE UNIQUE INDEX "gri_employment_disclosures_griReportId_key" ON "gri_employment_disclosures"("griReportId");

-- CreateIndex
CREATE UNIQUE INDEX "gri_ohs_disclosures_griReportId_key" ON "gri_ohs_disclosures"("griReportId");

-- CreateIndex
CREATE UNIQUE INDEX "gri_training_disclosures_griReportId_key" ON "gri_training_disclosures"("griReportId");

-- CreateIndex
CREATE UNIQUE INDEX "gri_diversity_disclosures_griReportId_key" ON "gri_diversity_disclosures"("griReportId");

-- CreateIndex
CREATE UNIQUE INDEX "gri_non_discrimination_disclosures_griReportId_key" ON "gri_non_discrimination_disclosures"("griReportId");

-- CreateIndex
CREATE UNIQUE INDEX "gri_local_communities_disclosures_griReportId_key" ON "gri_local_communities_disclosures"("griReportId");

-- CreateIndex
CREATE UNIQUE INDEX "gri_supplier_social_disclosures_griReportId_key" ON "gri_supplier_social_disclosures"("griReportId");

-- CreateIndex
CREATE UNIQUE INDEX "gri_customer_hs_disclosures_griReportId_key" ON "gri_customer_hs_disclosures"("griReportId");

-- CreateIndex
CREATE UNIQUE INDEX "gri_customer_privacy_disclosures_griReportId_key" ON "gri_customer_privacy_disclosures"("griReportId");

-- AddForeignKey
ALTER TABLE "gri_reports" ADD CONSTRAINT "gri_reports_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gri_reports" ADD CONSTRAINT "gri_reports_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gri_materiality_assessments" ADD CONSTRAINT "gri_materiality_assessments_griReportId_fkey" FOREIGN KEY ("griReportId") REFERENCES "gri_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gri_impacts" ADD CONSTRAINT "gri_impacts_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "gri_materiality_assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gri_material_topics" ADD CONSTRAINT "gri_material_topics_griReportId_fkey" FOREIGN KEY ("griReportId") REFERENCES "gri_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gri_universal_disclosures" ADD CONSTRAINT "gri_universal_disclosures_griReportId_fkey" FOREIGN KEY ("griReportId") REFERENCES "gri_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gri_materials_disclosures" ADD CONSTRAINT "gri_materials_disclosures_griReportId_fkey" FOREIGN KEY ("griReportId") REFERENCES "gri_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gri_energy_disclosures" ADD CONSTRAINT "gri_energy_disclosures_griReportId_fkey" FOREIGN KEY ("griReportId") REFERENCES "gri_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gri_water_disclosures" ADD CONSTRAINT "gri_water_disclosures_griReportId_fkey" FOREIGN KEY ("griReportId") REFERENCES "gri_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gri_biodiversity_disclosures" ADD CONSTRAINT "gri_biodiversity_disclosures_griReportId_fkey" FOREIGN KEY ("griReportId") REFERENCES "gri_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gri_emissions_disclosures" ADD CONSTRAINT "gri_emissions_disclosures_griReportId_fkey" FOREIGN KEY ("griReportId") REFERENCES "gri_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gri_waste_disclosures" ADD CONSTRAINT "gri_waste_disclosures_griReportId_fkey" FOREIGN KEY ("griReportId") REFERENCES "gri_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gri_supplier_env_disclosures" ADD CONSTRAINT "gri_supplier_env_disclosures_griReportId_fkey" FOREIGN KEY ("griReportId") REFERENCES "gri_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gri_employment_disclosures" ADD CONSTRAINT "gri_employment_disclosures_griReportId_fkey" FOREIGN KEY ("griReportId") REFERENCES "gri_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gri_ohs_disclosures" ADD CONSTRAINT "gri_ohs_disclosures_griReportId_fkey" FOREIGN KEY ("griReportId") REFERENCES "gri_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gri_training_disclosures" ADD CONSTRAINT "gri_training_disclosures_griReportId_fkey" FOREIGN KEY ("griReportId") REFERENCES "gri_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gri_diversity_disclosures" ADD CONSTRAINT "gri_diversity_disclosures_griReportId_fkey" FOREIGN KEY ("griReportId") REFERENCES "gri_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gri_non_discrimination_disclosures" ADD CONSTRAINT "gri_non_discrimination_disclosures_griReportId_fkey" FOREIGN KEY ("griReportId") REFERENCES "gri_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gri_local_communities_disclosures" ADD CONSTRAINT "gri_local_communities_disclosures_griReportId_fkey" FOREIGN KEY ("griReportId") REFERENCES "gri_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gri_supplier_social_disclosures" ADD CONSTRAINT "gri_supplier_social_disclosures_griReportId_fkey" FOREIGN KEY ("griReportId") REFERENCES "gri_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gri_customer_hs_disclosures" ADD CONSTRAINT "gri_customer_hs_disclosures_griReportId_fkey" FOREIGN KEY ("griReportId") REFERENCES "gri_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gri_customer_privacy_disclosures" ADD CONSTRAINT "gri_customer_privacy_disclosures_griReportId_fkey" FOREIGN KEY ("griReportId") REFERENCES "gri_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
