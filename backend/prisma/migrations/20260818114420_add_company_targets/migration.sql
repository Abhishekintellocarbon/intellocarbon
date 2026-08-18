-- CreateEnum
CREATE TYPE "CompanyTargetKind" AS ENUM ('ABSOLUTE', 'INTENSITY');

-- CreateEnum
CREATE TYPE "SbtiStatus" AS ENUM ('NOT_SUBMITTED', 'COMMITTED', 'SUBMITTED', 'VALIDATED');

-- CreateTable
CREATE TABLE "company_targets" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "kind" "CompanyTargetKind" NOT NULL DEFAULT 'ABSOLUTE',
    "scopesCovered" TEXT NOT NULL,
    "baselineYear" INTEGER NOT NULL,
    "baselineEmissionsTco2e" DOUBLE PRECISION NOT NULL,
    "targetYear" INTEGER NOT NULL,
    "reductionPct" DOUBLE PRECISION,
    "intensityMetric" TEXT,
    "baselineIntensity" DOUBLE PRECISION,
    "targetIntensity" DOUBLE PRECISION,
    "isNetZero" BOOLEAN NOT NULL DEFAULT false,
    "sbtiStatus" "SbtiStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
    "description" TEXT,
    "status" "DataEntryStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_targets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "company_targets_companyId_idx" ON "company_targets"("companyId");

-- AddForeignKey
ALTER TABLE "company_targets" ADD CONSTRAINT "company_targets_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
