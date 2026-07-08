-- AlterTable
ALTER TABLE "verifier_company_assignments" ADD COLUMN "assignedBy" TEXT;

-- AddForeignKey
ALTER TABLE "verifier_company_assignments" ADD CONSTRAINT "verifier_company_assignments_assignedBy_fkey" FOREIGN KEY ("assignedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
