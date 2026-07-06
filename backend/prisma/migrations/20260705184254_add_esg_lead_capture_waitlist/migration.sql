-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LeadTool" ADD VALUE 'ESG_GRI';
ALTER TYPE "LeadTool" ADD VALUE 'ESG_ISSB';
ALTER TYPE "LeadTool" ADD VALUE 'ESG_CSRD';
ALTER TYPE "LeadTool" ADD VALUE 'ESG_CDP';

-- AlterTable
ALTER TABLE "lead_captures" ALTER COLUMN "name" DROP NOT NULL,
ALTER COLUMN "company" DROP NOT NULL;

