-- CreateEnum
CREATE TYPE "RegulatoryRegime" AS ENUM ('ICVCM', 'ARTICLE_6_PACM', 'DIGITAL_PRODUCT_PASSPORT', 'TNFD', 'OTHER');

-- CreateEnum
CREATE TYPE "RegulatoryWatchStatus" AS ENUM ('MONITORING', 'DRAFT_PUBLISHED', 'ADOPTED', 'IN_FORCE', 'SUPERSEDED');

-- CreateTable
CREATE TABLE "regulatory_watch_entries" (
    "id" TEXT NOT NULL,
    "regime" "RegulatoryRegime" NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "status" "RegulatoryWatchStatus" NOT NULL DEFAULT 'MONITORING',
    "sourceUrl" TEXT,
    "nextMilestone" TEXT,
    "lastVerifiedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "regulatory_watch_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "regulatory_watch_entries_regime_idx" ON "regulatory_watch_entries"("regime");

-- CreateIndex
CREATE INDEX "regulatory_watch_entries_status_idx" ON "regulatory_watch_entries"("status");
