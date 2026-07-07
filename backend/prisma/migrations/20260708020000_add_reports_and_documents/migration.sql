-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('CBAM', 'CCTS', 'BRSR');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('GENERATED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('REPORT');

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "reportType" "ReportType" NOT NULL,
    "period" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pdfPath" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'GENERATED',

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL DEFAULT 'REPORT',
    "reportingPeriod" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "fileName" TEXT NOT NULL,
    "fileData" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reports_facilityId_idx" ON "reports"("facilityId");

-- CreateIndex
CREATE UNIQUE INDEX "reports_facilityId_reportType_period_key" ON "reports"("facilityId", "reportType", "period");

-- CreateIndex
CREATE UNIQUE INDEX "documents_reportId_key" ON "documents"("reportId");

-- CreateIndex
CREATE INDEX "documents_facilityId_idx" ON "documents"("facilityId");

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
