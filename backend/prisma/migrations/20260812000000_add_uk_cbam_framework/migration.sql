-- CreateEnum
CREATE TYPE "CbamFramework" AS ENUM ('EU_CBAM', 'UK_CBAM');

-- AlterTable
ALTER TABLE "companies" ADD COLUMN "cbamFrameworks" "CbamFramework"[] DEFAULT ARRAY[]::"CbamFramework"[];

-- Every company already flagged as in scope for CBAM is, today, an EU CBAM
-- company — UK CBAM did not exist in the data model before this migration.
-- Backfilling them to [EU_CBAM] keeps the set consistent with what
-- `appliesCbam` has always meant, so no existing company's behaviour changes.
UPDATE "companies" SET "cbamFrameworks" = ARRAY['EU_CBAM']::"CbamFramework"[] WHERE "appliesCbam" = true;

-- Seed the UK CBAM rate as a *pending* Emission Factor Manager row: value 0
-- with an explicit "not yet published" source, so it reads as unconfigured
-- rather than as a real price. getUkCbamRate() treats a non-positive value as
-- "no rate available" and returns null, and the calculation layer must not
-- price UK CBAM liability until a Super Admin supersedes this row with the
-- published UK ETS + Carbon Price Support figure.
INSERT INTO "emission_factors"
    ("id", "name", "fuelType", "greenhouseGas", "value", "unit", "source", "validFrom", "validTo", "sectorApplicability", "isCurrent", "createdAt", "updatedAt")
VALUES
    (
        'seed-uk-cbam-rate',
        'UK CBAM Rate',
        'UK_CBAM_RATE',
        NULL,
        0,
        'GBP/tCO2e',
        'Not yet published — the UK CBAM rate is set quarterly by HMRC from the UK ETS auction price plus Carbon Price Support, first published ahead of the 1 Jan 2027 accounting period. Supersede this row with the published figure and its HMRC citation before relying on it.',
        CURRENT_DATE,
        NULL,
        'ALL',
        true,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    );
