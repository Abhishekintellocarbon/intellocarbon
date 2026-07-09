-- CreateEnum
CREATE TYPE "CrossCheckStatus" AS ENUM ('NOT_REVIEWED', 'MATCHED', 'MISMATCH');

-- CreateTable
CREATE TABLE "cross_check_reviews" (
    "id" TEXT NOT NULL,
    "activityDataId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "status" "CrossCheckStatus" NOT NULL DEFAULT 'NOT_REVIEWED',
    "notes" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cross_check_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cross_check_reviews_documentId_key" ON "cross_check_reviews"("documentId");

-- CreateIndex
CREATE INDEX "cross_check_reviews_activityDataId_idx" ON "cross_check_reviews"("activityDataId");

-- AddForeignKey
ALTER TABLE "cross_check_reviews" ADD CONSTRAINT "cross_check_reviews_activityDataId_fkey" FOREIGN KEY ("activityDataId") REFERENCES "activity_data"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cross_check_reviews" ADD CONSTRAINT "cross_check_reviews_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cross_check_reviews" ADD CONSTRAINT "cross_check_reviews_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
