-- CreateEnum
CREATE TYPE "CctsEntityStatus" AS ENUM ('DRAFT', 'FINAL');

-- CreateTable
CREATE TABLE "ccts_obligated_entities" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "subSector" TEXT,
    "state" TEXT NOT NULL,
    "district" TEXT,
    "notificationReference" TEXT NOT NULL,
    "notificationDate" TIMESTAMP(3) NOT NULL,
    "status" "CctsEntityStatus" NOT NULL DEFAULT 'DRAFT',
    "baselineIntensity" DOUBLE PRECISION,
    "targetIntensity" DOUBLE PRECISION,
    "sourceUrl" TEXT,
    "lastVerifiedDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ccts_obligated_entities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ccts_obligated_entities_sector_idx" ON "ccts_obligated_entities"("sector");

-- CreateIndex
CREATE INDEX "ccts_obligated_entities_state_idx" ON "ccts_obligated_entities"("state");

-- CreateIndex
CREATE INDEX "ccts_obligated_entities_status_idx" ON "ccts_obligated_entities"("status");
