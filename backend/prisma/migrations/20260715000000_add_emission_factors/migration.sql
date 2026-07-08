-- CreateTable
CREATE TABLE "emission_factors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fuelType" TEXT,
    "greenhouseGas" TEXT,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3),
    "sectorApplicability" TEXT,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "emission_factors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "emission_factors_isCurrent_idx" ON "emission_factors"("isCurrent");

-- CreateIndex
CREATE INDEX "emission_factors_fuelType_idx" ON "emission_factors"("fuelType");

-- Seed the two "quick update" values with the figures already hardcoded in
-- data/cbamReferenceData.ts / data/emissionFactors.ts, so the DB becomes the
-- live source of truth (see getCbamCertificatePrice()/getGridEmissionFactor())
-- without changing any calculation output on first deploy.
INSERT INTO "emission_factors"
    ("id", "name", "fuelType", "greenhouseGas", "value", "unit", "source", "validFrom", "validTo", "sectorApplicability", "isCurrent", "createdAt", "updatedAt")
VALUES
    (
        'seed-cbam-certificate-price',
        'CBAM Certificate Price',
        'CBAM_CERTIFICATE_PRICE',
        NULL,
        75.28,
        'EUR/tCO2e',
        'European Commission — https://taxation-customs.ec.europa.eu/carbon-border-adjustment-mechanism/price-cbam-certificates_en',
        '2026-07-06 00:00:00',
        NULL,
        'ALL',
        true,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'seed-cea-grid-factor',
        'CEA Grid Emission Factor',
        'GRID_ELECTRICITY',
        'CO2',
        0.716,
        'tCO2/MWh',
        'CEA Grid Emission Factor Report FY2025-26',
        CURRENT_DATE,
        NULL,
        'ALL',
        true,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    );
