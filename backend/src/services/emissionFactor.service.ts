import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";
import { setGridEmissionFactor } from "../data/emissionFactors";
import { setCbamCertificatePrice } from "../data/cbamReferenceData";
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
    "CBAM Certificate Price",
    { fuelType: "CBAM_CERTIFICATE_PRICE", unit: "EUR/tCO2e", sectorApplicability: "ALL" },
    input,
  );
  setCbamCertificatePrice(factor.value, factor.source, factor.validFrom);
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
 * Loads the two live-wired values from the DB into the in-memory cache the
 * calculation engine and PDF report builders read — called once at server
 * startup (see server.ts). Falls back silently to the code defaults in
 * emissionFactors.ts/cbamReferenceData.ts if a row is missing, e.g. on a
 * fresh DB before this migration's seed has run.
 */
export const hydrateEmissionFactorCache = async (): Promise<void> => {
  const [certPrice, gridFactor] = await Promise.all([
    prisma.emissionFactor.findFirst({ where: { name: "CBAM Certificate Price", isCurrent: true } }),
    prisma.emissionFactor.findFirst({ where: { name: "CEA Grid Emission Factor", isCurrent: true } }),
  ]);
  if (certPrice) setCbamCertificatePrice(certPrice.value, certPrice.source, certPrice.validFrom);
  if (gridFactor) setGridEmissionFactor(gridFactor.value, gridFactor.source);
};
