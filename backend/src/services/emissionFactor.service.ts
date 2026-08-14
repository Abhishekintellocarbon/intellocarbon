import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";
import { setGridEmissionFactor } from "../data/emissionFactors";
import { setCbamCertificatePrice, CBAM_CERTIFICATE_PRICE_FACTOR_NAME } from "../data/cbamReferenceData";
import { setUkCbamRate, UK_CBAM_RATE_FACTOR_NAME } from "../data/ukCbamReferenceData";
import { setCccMarketPrice, CCC_MARKET_PRICE_FACTOR_NAME } from "../data/cctsReferenceData";
import type {
  CreateEmissionFactorInput,
  UpdateEmissionFactorInput,
  SupersedeEmissionFactorInput,
  QuickUpdateValueInput,
} from "../validators/emissionFactor.validators";

const cleanOptional = (value?: string) => (value ? value : undefined);

const startOfToday = () => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

export const listEmissionFactors = () =>
  prisma.emissionFactor.findMany({
    orderBy: [{ isCurrent: "desc" }, { name: "asc" }, { validFrom: "desc" }],
  });

export const createEmissionFactor = (input: CreateEmissionFactorInput) =>
  prisma.emissionFactor.create({
    data: {
      name: input.name,
      fuelType: cleanOptional(input.fuelType),
      greenhouseGas: cleanOptional(input.greenhouseGas),
      value: input.value,
      unit: input.unit,
      source: input.source,
      validFrom: input.validFrom,
      validTo: input.validTo ?? null,
      sectorApplicability: cleanOptional(input.sectorApplicability),
      isCurrent: true,
    },
  });

// Metadata-only correction (name/unit/source/etc.) on the record as it
// stands — deliberately has no `value` input. Changing the value always
// goes through supersedeEmissionFactor below, so history is never silently
// overwritten in place.
export const updateEmissionFactor = async (id: string, input: UpdateEmissionFactorInput) => {
  const existing = await prisma.emissionFactor.findUnique({ where: { id } });
  if (!existing) {
    throw AppError.notFound("Emission factor not found");
  }

  return prisma.emissionFactor.update({
    where: { id },
    data: {
      name: input.name,
      fuelType: input.fuelType !== undefined ? cleanOptional(input.fuelType) : undefined,
      greenhouseGas: input.greenhouseGas !== undefined ? cleanOptional(input.greenhouseGas) : undefined,
      unit: input.unit,
      source: input.source,
      validFrom: input.validFrom,
      validTo: input.validTo,
      sectorApplicability: input.sectorApplicability !== undefined ? cleanOptional(input.sectorApplicability) : undefined,
    },
  });
};

/**
 * Marks `existing` historical (isCurrent -> false, validTo -> today) and
 * creates the new current row in one transaction, copying every field
 * except value/source/validFrom/validTo from it. Shared by the by-id
 * supersede endpoint and the two named quick-update flows below.
 */
const supersedeRow = async (
  existing: {
    id: string;
    name: string;
    fuelType: string | null;
    greenhouseGas: string | null;
    unit: string;
    sectorApplicability: string | null;
  },
  input: { value: number; source: string },
) => {
  const today = startOfToday();
  const [, created] = await prisma.$transaction([
    prisma.emissionFactor.update({
      where: { id: existing.id },
      data: { isCurrent: false, validTo: today },
    }),
    prisma.emissionFactor.create({
      data: {
        name: existing.name,
        fuelType: existing.fuelType,
        greenhouseGas: existing.greenhouseGas,
        value: input.value,
        unit: existing.unit,
        source: input.source,
        validFrom: today,
        validTo: null,
        sectorApplicability: existing.sectorApplicability,
        isCurrent: true,
      },
    }),
  ]);
  return created;
};

export const supersedeEmissionFactor = async (id: string, input: SupersedeEmissionFactorInput) => {
  const existing = await prisma.emissionFactor.findUnique({ where: { id } });
  if (!existing) {
    throw AppError.notFound("Emission factor not found");
  }
  if (!existing.isCurrent) {
    throw AppError.badRequest("Only the current version of a factor can be superseded", "NOT_CURRENT");
  }
  return supersedeRow(existing, input);
};

/**
 * Find-or-create-then-supersede for the two named "quick update" values.
 * They're always expected to have a current row (seeded by the migration
 * that added this table), but this stays defensive in case one is ever
 * missing rather than throwing.
 */
const supersedeOrCreateByName = async (
  name: string,
  defaults: { fuelType: string; unit: string; sectorApplicability: string },
  input: QuickUpdateValueInput,
) => {
  const existing = await prisma.emissionFactor.findFirst({ where: { name, isCurrent: true } });
  if (existing) {
    return supersedeRow(existing, input);
  }
  return prisma.emissionFactor.create({
    data: {
      name,
      fuelType: defaults.fuelType,
      greenhouseGas: null,
      value: input.value,
      unit: defaults.unit,
      source: input.source,
      validFrom: startOfToday(),
      validTo: null,
      sectorApplicability: defaults.sectorApplicability,
      isCurrent: true,
    },
  });
};

export const updateCbamCertificatePrice = async (input: QuickUpdateValueInput) => {
  const factor = await supersedeOrCreateByName(
    CBAM_CERTIFICATE_PRICE_FACTOR_NAME,
    { fuelType: "CBAM_CERTIFICATE_PRICE", unit: "EUR/tCO2e", sectorApplicability: "ALL" },
    input,
  );
  setCbamCertificatePrice(factor.value, factor.source, factor.validFrom);
  return factor;
};

/**
 * UK CBAM rate — pegged to the UK ETS auction price plus Carbon Price
 * Support, set quarterly by HMRC. Same quick-update shape as the EU
 * certificate price above; the migration seeds the row with a value of 0 and
 * a "not yet published" source, so until a Super Admin supersedes it with a
 * real HMRC figure getUkCbamRate() keeps returning null.
 */
export const updateUkCbamRate = async (input: QuickUpdateValueInput) => {
  const factor = await supersedeOrCreateByName(
    UK_CBAM_RATE_FACTOR_NAME,
    { fuelType: "UK_CBAM_RATE", unit: "GBP/tCO2e", sectorApplicability: "ALL" },
    input,
  );
  setUkCbamRate(factor.value, factor.source, factor.validFrom);
  return factor;
};

/**
 * CCC market price — the traded price of a Carbon Credit Certificate under
 * CCTS. Same quick-update shape as the two above; the migration seeds the row
 * with a value of 0 and a "market not open" source, so until a Super Admin
 * supersedes it with a real IEX figure getCccMarketPrice() keeps returning
 * null and no CCC position anywhere is given a rupee value.
 */
export const updateCccMarketPrice = async (input: QuickUpdateValueInput) => {
  const factor = await supersedeOrCreateByName(
    CCC_MARKET_PRICE_FACTOR_NAME,
    { fuelType: "CCC_MARKET_PRICE", unit: "INR/CCC", sectorApplicability: "ALL" },
    input,
  );
  setCccMarketPrice(factor.value, factor.source, factor.validFrom);
  return factor;
};

export const updateCeaGridFactor = async (input: QuickUpdateValueInput) => {
  const factor = await supersedeOrCreateByName(
    "CEA Grid Emission Factor",
    { fuelType: "GRID_ELECTRICITY", unit: "tCO2/MWh", sectorApplicability: "ALL" },
    input,
  );
  setGridEmissionFactor(factor.value, factor.source);
  return factor;
};

/**
 * Loads the live-wired values from the DB into the in-memory cache the
 * calculation engine and PDF report builders read — called once at server
 * startup (see server.ts). Falls back silently to the code defaults in
 * emissionFactors.ts/cbamReferenceData.ts if a row is missing, e.g. on a
 * fresh DB before this migration's seed has run. The UK CBAM rate has no
 * code default to fall back to — it stays null until HMRC publishes one and
 * a Super Admin enters it, and neither does the CCC market price, which
 * cannot exist at all until CCC trading opens on IEX in October 2026.
 */
export const hydrateEmissionFactorCache = async (): Promise<void> => {
  const [certPrice, gridFactor, ukCbamRate, cccMarketPrice] = await Promise.all([
    prisma.emissionFactor.findFirst({ where: { name: CBAM_CERTIFICATE_PRICE_FACTOR_NAME, isCurrent: true } }),
    prisma.emissionFactor.findFirst({ where: { name: "CEA Grid Emission Factor", isCurrent: true } }),
    prisma.emissionFactor.findFirst({ where: { name: UK_CBAM_RATE_FACTOR_NAME, isCurrent: true } }),
    prisma.emissionFactor.findFirst({ where: { name: CCC_MARKET_PRICE_FACTOR_NAME, isCurrent: true } }),
  ]);
  if (certPrice) setCbamCertificatePrice(certPrice.value, certPrice.source, certPrice.validFrom);
  if (gridFactor) setGridEmissionFactor(gridFactor.value, gridFactor.source);
  if (ukCbamRate) setUkCbamRate(ukCbamRate.value, ukCbamRate.source, ukCbamRate.validFrom);
  if (cccMarketPrice) setCccMarketPrice(cccMarketPrice.value, cccMarketPrice.source, cccMarketPrice.validFrom);
};
