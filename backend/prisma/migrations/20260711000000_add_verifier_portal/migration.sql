-- AlterTable
ALTER TABLE "verification_requests" ADD COLUMN "qualifications" TEXT;
ALTER TABLE "verification_requests" ADD COLUMN "checklistState" JSONB NOT NULL DEFAULT '{}';

-- CreateEnum
CREATE TYPE "VerificationQueryStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateTable
CREATE TABLE "verification_queries" (
    "id" TEXT NOT NULL,
    "verificationRequestId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "raisedByVerifierId" TEXT NOT NULL,
    "queryText" TEXT NOT NULL,
    "status" "VerificationQueryStatus" NOT NULL DEFAULT 'OPEN',
    "responseText" TEXT,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_queries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verifier_company_assignments" (
    "id" TEXT NOT NULL,
    "verifierId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verifier_company_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "verification_queries_verificationRequestId_idx" ON "verification_queries"("verificationRequestId");

-- CreateIndex
CREATE INDEX "verification_queries_companyId_idx" ON "verification_queries"("companyId");

-- CreateIndex
CREATE INDEX "verification_queries_facilityId_idx" ON "verification_queries"("facilityId");

-- CreateIndex
CREATE INDEX "verifier_company_assignments_companyId_idx" ON "verifier_company_assignments"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "verifier_company_assignments_verifierId_companyId_key" ON "verifier_company_assignments"("verifierId", "companyId");

-- AddForeignKey
ALTER TABLE "verification_queries" ADD CONSTRAINT "verification_queries_verificationRequestId_fkey" FOREIGN KEY ("verificationRequestId") REFERENCES "verification_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_queries" ADD CONSTRAINT "verification_queries_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_queries" ADD CONSTRAINT "verification_queries_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_queries" ADD CONSTRAINT "verification_queries_raisedByVerifierId_fkey" FOREIGN KEY ("raisedByVerifierId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verifier_company_assignments" ADD CONSTRAINT "verifier_company_assignments_verifierId_fkey" FOREIGN KEY ("verifierId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verifier_company_assignments" ADD CONSTRAINT "verifier_company_assignments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
