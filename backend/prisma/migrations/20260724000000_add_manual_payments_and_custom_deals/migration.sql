-- CreateEnum
CREATE TYPE "ManualPaymentMode" AS ENUM ('CHEQUE', 'NEFT', 'RTGS', 'UPI', 'CASH', 'OTHER');

-- CreateEnum
CREATE TYPE "ManualPaymentStatus" AS ENUM ('RECORDED', 'REVERSED');

-- AlterEnum
ALTER TYPE "AuditLogAction" ADD VALUE 'MANUAL_PAYMENT_RECORDED';
ALTER TYPE "AuditLogAction" ADD VALUE 'MANUAL_PAYMENT_REVERSED';
ALTER TYPE "AuditLogAction" ADD VALUE 'CUSTOM_SUBSCRIPTION_SET';
ALTER TYPE "AuditLogAction" ADD VALUE 'CUSTOM_SUBSCRIPTION_REVERTED';

-- AlterTable
ALTER TABLE "audit_logs" ALTER COLUMN "facilityId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "isCustomDeal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "customFacilityCount" INTEGER,
ADD COLUMN     "customValidFrom" TIMESTAMP(3),
ADD COLUMN     "customValidUntil" TIMESTAMP(3),
ADD COLUMN     "customAmount" DOUBLE PRECISION,
ADD COLUMN     "customSetByUserId" TEXT,
ADD COLUMN     "customDealNotes" TEXT;

-- CreateTable
CREATE TABLE "manual_payments" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "tier" "SubscriptionTier" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paymentMode" "ManualPaymentMode" NOT NULL,
    "referenceNumber" TEXT,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "recordedByUserId" TEXT NOT NULL,
    "status" "ManualPaymentStatus" NOT NULL DEFAULT 'RECORDED',
    "reversedAt" TIMESTAMP(3),
    "reversedByUserId" TEXT,
    "reversalReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "manual_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "manual_payments_companyId_idx" ON "manual_payments"("companyId");

-- CreateIndex
CREATE INDEX "manual_payments_status_idx" ON "manual_payments"("status");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_customSetByUserId_fkey" FOREIGN KEY ("customSetByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manual_payments" ADD CONSTRAINT "manual_payments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manual_payments" ADD CONSTRAINT "manual_payments_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manual_payments" ADD CONSTRAINT "manual_payments_reversedByUserId_fkey" FOREIGN KEY ("reversedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
