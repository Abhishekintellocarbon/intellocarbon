-- CreateEnum
CREATE TYPE "BillExtractionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'UNSUPPORTED');

-- CreateEnum
CREATE TYPE "BillExtractionEngine" AS ENUM ('PDF_TEXT_LAYER', 'OCR_IMAGE');

-- CreateTable
CREATE TABLE "bill_extractions" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "status" "BillExtractionStatus" NOT NULL DEFAULT 'PENDING',
    "engine" "BillExtractionEngine",
    "failureReason" TEXT,
    "state" TEXT,
    "discomName" TEXT,
    "discomCode" TEXT,
    "unitsConsumedKwh" DOUBLE PRECISION,
    "tariffCode" TEXT,
    "tariffVoltage" TEXT,
    "tariffSegment" TEXT,
    "sanctionedLoadValue" DOUBLE PRECISION,
    "sanctionedLoadUnit" TEXT,
    "billingPeriodStart" TIMESTAMP(3),
    "billingPeriodEnd" TIMESTAMP(3),
    "ratePerUnitInr" DOUBLE PRECISION,
    "fieldMeta" JSONB NOT NULL DEFAULT '{}',
    "extractedText" TEXT,
    "ocrMeanConfidence" DOUBLE PRECISION,
    "prefillAcceptedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "bill_extractions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bill_extractions_documentId_key" ON "bill_extractions"("documentId");

-- AddForeignKey
ALTER TABLE "bill_extractions" ADD CONSTRAINT "bill_extractions_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
