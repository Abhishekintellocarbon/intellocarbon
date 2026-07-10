-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "mergedIntoId" TEXT;

-- CreateIndex
CREATE INDEX "subscriptions_mergedIntoId_idx" ON "subscriptions"("mergedIntoId");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
