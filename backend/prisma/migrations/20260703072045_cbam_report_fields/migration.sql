-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "euImporterContactEmail" TEXT,
ADD COLUMN     "euImporterContactPhone" TEXT,
ADD COLUMN     "euImporterCountry" TEXT,
ADD COLUMN     "euImporterEori" TEXT,
ADD COLUMN     "euImporterName" TEXT;

-- AlterTable
ALTER TABLE "facilities" ADD COLUMN     "cnCodes" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "steel_activity_data" ADD COLUMN     "carbonPricePaidEurPerTonne" DOUBLE PRECISION,
ADD COLUMN     "cctsTargetIntensity" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "verification_requests" ADD COLUMN     "accreditationNumber" TEXT;
