import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";
import { requireOwnedFacility } from "./facility.service";
import { calculateScope3Emissions } from "./scope3Calculation.service";
import type { Scope3EntryBaseInput } from "../validators/scope3.validators";

export const listScope3Data = async (userId: string, facilityId: string, reportingPeriod?: string) => {
  await requireOwnedFacility(userId, facilityId);
  const entries = await prisma.scope3Data.findMany({
    where: { facilityId, ...(reportingPeriod ? { reportingPeriod } : {}) },
    orderBy: [{ reportingPeriod: "desc" }, { category: "asc" }],
  });

  const totalSubmittedTco2e = entries
    .filter((e) => e.status === "SUBMITTED")
    .reduce((sum, e) => sum + e.calculatedEmissionsTco2e, 0);

  return { entries, totalSubmittedTco2e: Math.round(totalSubmittedTco2e * 10000) / 10000 };
};

const requireOwnedScope3Entry = async (userId: string, facilityId: string, reportingPeriod: string, category: string) => {
  await requireOwnedFacility(userId, facilityId);
  const entry = await prisma.scope3Data.findUnique({
    where: { facilityId_reportingPeriod_category: { facilityId, reportingPeriod, category: category as never } },
  });
  if (!entry) {
    throw AppError.notFound("Scope 3 entry not found for this facility, reporting period, and category");
  }
  return entry;
};

/**
 * Upserts on the (facilityId, reportingPeriod, category) natural key —
 * resaving the same category replaces its previous calculation rather than
 * accumulating duplicate rows. Runs the calculation engine synchronously on
 * every save so `calculatedEmissionsTco2e` is always current — there's no
 * separate "calculate" step to trigger.
 */
export const saveScope3Data = async (userId: string, facilityId: string, input: Scope3EntryBaseInput, submit: boolean) => {
  const facility = await requireOwnedFacility(userId, facilityId);

  const existing = await prisma.scope3Data.findUnique({
    where: {
      facilityId_reportingPeriod_category: {
        facilityId,
        reportingPeriod: input.reportingPeriod,
        category: input.category,
      },
    },
  });

  if (existing && existing.status === "SUBMITTED" && !submit) {
    throw AppError.badRequest(
      "This Scope 3 entry has already been submitted — resubmit explicitly to edit it",
      "SCOPE3_ENTRY_NOT_DRAFT",
    );
  }

  const { calculatedEmissionsTco2e, emissionFactorSource } = calculateScope3Emissions(
    input.category,
    input.calculationMethod,
    input.inputData as Record<string, unknown>,
  );

  const data = {
    companyId: facility.companyId,
    facilityId,
    reportingPeriod: input.reportingPeriod,
    category: input.category,
    calculationMethod: input.calculationMethod,
    inputData: input.inputData as object,
    calculatedEmissionsTco2e,
    emissionFactorSource,
    notes: input.notes || null,
    status: (submit ? "SUBMITTED" : "DRAFT") as "SUBMITTED" | "DRAFT",
  };

  return prisma.scope3Data.upsert({
    where: {
      facilityId_reportingPeriod_category: {
        facilityId,
        reportingPeriod: input.reportingPeriod,
        category: input.category,
      },
    },
    create: data,
    update: data,
  });
};

export const deleteScope3Data = async (userId: string, facilityId: string, reportingPeriod: string, category: string) => {
  const entry = await requireOwnedScope3Entry(userId, facilityId, reportingPeriod, category);
  await prisma.scope3Data.delete({ where: { id: entry.id } });
};
