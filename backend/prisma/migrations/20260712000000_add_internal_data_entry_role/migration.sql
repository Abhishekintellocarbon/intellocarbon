-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'DATA_ENTRY_INTERNAL';

-- CreateTable
CREATE TABLE "facility_assignments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedBy" TEXT NOT NULL,

    CONSTRAINT "facility_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "facility_assignments_facilityId_idx" ON "facility_assignments"("facilityId");

-- CreateIndex
CREATE UNIQUE INDEX "facility_assignments_userId_facilityId_key" ON "facility_assignments"("userId", "facilityId");

-- AddForeignKey
ALTER TABLE "facility_assignments" ADD CONSTRAINT "facility_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_assignments" ADD CONSTRAINT "facility_assignments_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_assignments" ADD CONSTRAINT "facility_assignments_assignedBy_fkey" FOREIGN KEY ("assignedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
