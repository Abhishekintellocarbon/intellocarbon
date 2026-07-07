-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
-- Backfill existing accounts as APPROVED (they already have working access),
-- then flip the steady-state default to PENDING for everything created after.
ALTER TABLE "users" ADD COLUMN "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'APPROVED';
ALTER TABLE "users" ALTER COLUMN "approvalStatus" SET DEFAULT 'PENDING';
