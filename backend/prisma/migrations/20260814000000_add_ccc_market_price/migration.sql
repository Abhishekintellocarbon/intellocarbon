-- Seed the CCC market price as a *pending* Emission Factor Manager row: value
-- 0 with an explicit "market not yet open" source, so it reads as unavailable
-- rather than as a real price of zero. This mirrors the UK CBAM rate seed in
-- the add_uk_cbam_framework migration, with one difference worth stating:
-- the UK rate is merely unpublished, whereas no Carbon Credit Certificate has
-- ever traded — the CCTS compliance market opens on the Indian Energy Exchange
-- in October 2026. getCccMarketPrice() treats a non-positive value as "no
-- price available" and returns null, and nothing may put a rupee figure on a
-- CCC surplus or deficit until a Super Admin supersedes this row with a real
-- traded price and its source.
INSERT INTO "emission_factors"
    ("id", "name", "fuelType", "greenhouseGas", "value", "unit", "source", "validFrom", "validTo", "sectorApplicability", "isCurrent", "createdAt", "updatedAt")
VALUES
    (
        'seed-ccc-market-price',
        'CCC Market Price',
        'CCC_MARKET_PRICE',
        NULL,
        0,
        'INR/CCC',
        'Market not yet open — Carbon Credit Certificates become tradable on the Indian Energy Exchange in October 2026 under the CCTS compliance mechanism. No CCC has traded, so no price exists. Supersede this row with the traded price and its IEX citation once trading begins.',
        CURRENT_DATE,
        NULL,
        'ALL',
        true,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    );
