-- AlterEnum
ALTER TYPE "DocumentType" ADD VALUE 'SUPPORTING_EVIDENCE';

-- AlterTable
ALTER TABLE "documents" ALTER COLUMN "reportId" DROP NOT NULL;
ALTER TABLE "documents" ADD COLUMN "activityDataId" TEXT;

-- CreateIndex
CREATE INDEX "documents_activityDataId_idx" ON "documents"("activityDataId");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_activityDataId_fkey" FOREIGN KEY ("activityDataId") REFERENCES "activity_data"("id") ON DELETE CASCADE ON UPDATE CASCADE;
