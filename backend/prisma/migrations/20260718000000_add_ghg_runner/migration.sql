-- CreateEnum
CREATE TYPE "GhgJurisdiction" AS ENUM ('US_CALIFORNIA', 'UK', 'AUSTRALIA', 'UAE_MIDDLE_EAST', 'EU', 'OTHER_GHG_PROTOCOL');

-- CreateEnum
CREATE TYPE "GhgEngagementStatus" AS ENUM ('DRAFT', 'FINALIZED');

-- CreateTable
CREATE TABLE "ghg_engagements" (
    "id" TEXT NOT NULL,
    "organizationName" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "reportingPeriodStart" TIMESTAMP(3) NOT NULL,
    "reportingPeriodEnd" TIMESTAMP(3) NOT NULL,
    "jurisdiction" "GhgJurisdiction" NOT NULL,
    "numberOfSites" INTEGER,
    "scope1Entries" JSONB NOT NULL DEFAULT '[]',
    "scope2Entries" JSONB NOT NULL DEFAULT '[]',
    "scope3Entries" JSONB NOT NULL DEFAULT '[]',
    "scope1TotalTco2e" DOUBLE PRECISION,
    "scope2TotalTco2e" DOUBLE PRECISION,
    "totalTco2e" DOUBLE PRECISION,
    "gwpSchemeUsed" TEXT,
    "status" "GhgEngagementStatus" NOT NULL DEFAULT 'DRAFT',
    "reportPdfFileName" TEXT,
    "reportPdfData" BYTEA,
    "reportGeneratedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ghg_engagements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ghg_engagements_organizationName_idx" ON "ghg_engagements"("organizationName");

-- CreateIndex
CREATE INDEX "ghg_engagements_status_idx" ON "ghg_engagements"("status");

-- AddForeignKey
ALTER TABLE "ghg_engagements" ADD CONSTRAINT "ghg_engagements_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
