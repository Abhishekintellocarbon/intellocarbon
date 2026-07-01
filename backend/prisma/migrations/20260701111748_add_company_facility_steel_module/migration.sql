-- CreateEnum
CREATE TYPE "Sector" AS ENUM ('STEEL', 'CEMENT', 'ALUMINIUM', 'FERTILIZER', 'HYDROGEN', 'ELECTRICITY', 'OTHER');

-- CreateEnum
CREATE TYPE "FacilityType" AS ENUM ('INTEGRATED_STEEL_PLANT', 'EAF_MINI_MILL', 'DRI_PLANT', 'ROLLING_MILL', 'PELLET_PLANT', 'OTHER');

-- CreateEnum
CREATE TYPE "ProductionRoute" AS ENUM ('BF_BOF', 'EAF', 'DRI_EAF', 'OTHER');

-- CreateEnum
CREATE TYPE "DataEntryStatus" AS ENUM ('DRAFT', 'SUBMITTED');

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "registrationNumber" TEXT,
    "sector" "Sector" NOT NULL,
    "subSector" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "country" TEXT NOT NULL DEFAULT 'India',
    "annualTurnoverInr" DOUBLE PRECISION,
    "employeeCount" INTEGER,
    "reportingFyStartMonth" INTEGER NOT NULL DEFAULT 4,
    "appliesCbam" BOOLEAN NOT NULL DEFAULT false,
    "appliesCcts" BOOLEAN NOT NULL DEFAULT false,
    "isPatDesignatedConsumer" BOOLEAN NOT NULL DEFAULT false,
    "onboardingCompletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facilities" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "facilityType" "FacilityType" NOT NULL,
    "productionRoute" "ProductionRoute" NOT NULL,
    "address" TEXT,
    "state" TEXT,
    "district" TEXT,
    "pincode" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "installedCapacityTpa" DOUBLE PRECISION,
    "commissioningYear" INTEGER,
    "productsManufactured" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "steel_activity_data" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "productCategory" TEXT NOT NULL,
    "productionQuantityT" DOUBLE PRECISION NOT NULL,
    "gridElectricityMwh" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "renewableElectricityMwh" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gridEmissionFactorOverride" DOUBLE PRECISION,
    "steamImportedGj" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "steamEmissionFactorOverride" DOUBLE PRECISION,
    "status" "DataEntryStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "steel_activity_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fuel_entries" (
    "id" TEXT NOT NULL,
    "activityDataId" TEXT NOT NULL,
    "fuelType" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "emissionFactorOverrideCo2" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fuel_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "process_material_entries" (
    "id" TEXT NOT NULL,
    "activityDataId" TEXT NOT NULL,
    "materialType" TEXT NOT NULL,
    "quantityTonnes" DOUBLE PRECISION NOT NULL,
    "emissionFactorOverride" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "process_material_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "precursor_entries" (
    "id" TEXT NOT NULL,
    "activityDataId" TEXT NOT NULL,
    "materialType" TEXT NOT NULL,
    "quantityTonnes" DOUBLE PRECISION NOT NULL,
    "embeddedEmissionFactorOverride" DOUBLE PRECISION,
    "sourceLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "precursor_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emission_calculation_results" (
    "id" TEXT NOT NULL,
    "activityDataId" TEXT NOT NULL,
    "directCombustionCo2eAr5" DOUBLE PRECISION NOT NULL,
    "directCombustionCo2eAr4" DOUBLE PRECISION NOT NULL,
    "directProcessCo2e" DOUBLE PRECISION NOT NULL,
    "directPrecursorCo2e" DOUBLE PRECISION NOT NULL,
    "indirectElectricityCo2e" DOUBLE PRECISION NOT NULL,
    "indirectSteamCo2e" DOUBLE PRECISION NOT NULL,
    "totalDirectCo2eAr5" DOUBLE PRECISION NOT NULL,
    "totalDirectCo2eAr4" DOUBLE PRECISION NOT NULL,
    "totalEmissionsCbamAr5" DOUBLE PRECISION NOT NULL,
    "totalEmissionsCctsAr4" DOUBLE PRECISION NOT NULL,
    "specificEmbeddedEmissionsCbam" DOUBLE PRECISION NOT NULL,
    "ghgIntensityCcts" DOUBLE PRECISION NOT NULL,
    "gridEmissionFactorUsed" DOUBLE PRECISION NOT NULL,
    "breakdown" JSONB NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emission_calculation_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "companies_ownerId_key" ON "companies"("ownerId");

-- CreateIndex
CREATE INDEX "facilities_companyId_idx" ON "facilities"("companyId");

-- CreateIndex
CREATE INDEX "steel_activity_data_facilityId_idx" ON "steel_activity_data"("facilityId");

-- CreateIndex
CREATE INDEX "fuel_entries_activityDataId_idx" ON "fuel_entries"("activityDataId");

-- CreateIndex
CREATE INDEX "process_material_entries_activityDataId_idx" ON "process_material_entries"("activityDataId");

-- CreateIndex
CREATE INDEX "precursor_entries_activityDataId_idx" ON "precursor_entries"("activityDataId");

-- CreateIndex
CREATE UNIQUE INDEX "emission_calculation_results_activityDataId_key" ON "emission_calculation_results"("activityDataId");

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "steel_activity_data" ADD CONSTRAINT "steel_activity_data_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuel_entries" ADD CONSTRAINT "fuel_entries_activityDataId_fkey" FOREIGN KEY ("activityDataId") REFERENCES "steel_activity_data"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_material_entries" ADD CONSTRAINT "process_material_entries_activityDataId_fkey" FOREIGN KEY ("activityDataId") REFERENCES "steel_activity_data"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "precursor_entries" ADD CONSTRAINT "precursor_entries_activityDataId_fkey" FOREIGN KEY ("activityDataId") REFERENCES "steel_activity_data"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emission_calculation_results" ADD CONSTRAINT "emission_calculation_results_activityDataId_fkey" FOREIGN KEY ("activityDataId") REFERENCES "steel_activity_data"("id") ON DELETE CASCADE ON UPDATE CASCADE;
