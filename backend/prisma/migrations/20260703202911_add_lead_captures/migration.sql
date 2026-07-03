-- CreateEnum
CREATE TYPE "LeadTool" AS ENUM ('BORDER', 'INDIA', 'COMPLY');

-- CreateTable
CREATE TABLE "lead_captures" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "phone" TEXT,
    "toolUsed" "LeadTool" NOT NULL,
    "inputsJson" JSONB NOT NULL,
    "resultsJson" JSONB NOT NULL,
    "followedUp" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_captures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lead_captures_toolUsed_idx" ON "lead_captures"("toolUsed");

-- CreateIndex
CREATE INDEX "lead_captures_createdAt_idx" ON "lead_captures"("createdAt");
