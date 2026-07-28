import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";
import { createCctsObligatedEntitySchema } from "../validators/cctsObligatedEntity.validators";
import type {
  CreateCctsObligatedEntityInput,
  UpdateCctsObligatedEntityInput,
} from "../validators/cctsObligatedEntity.validators";

const cleanOptional = (value?: string) => (value ? value : undefined);

export interface ObligatedEntityFilters {
  state?: string;
  sector?: string;
  status?: "DRAFT" | "FINAL";
  search?: string;
}

const buildWhere = (filters: ObligatedEntityFilters) => ({
  ...(filters.state ? { state: { equals: filters.state, mode: "insensitive" as const } } : {}),
  ...(filters.sector ? { sector: { equals: filters.sector, mode: "insensitive" as const } } : {}),
  ...(filters.status ? { status: filters.status } : {}),
  ...(filters.search
    ? {
        OR: [
          { companyName: { contains: filters.search, mode: "insensitive" as const } },
          { district: { contains: filters.search, mode: "insensitive" as const } },
        ],
      }
    : {}),
});

export const listObligatedEntities = (filters: ObligatedEntityFilters = {}) =>
  prisma.cctsObligatedEntity.findMany({
    where: buildWhere(filters),
    orderBy: [{ state: "asc" }, { companyName: "asc" }],
  });

/**
 * Global "data last verified" timestamp for the public page — the most
 * recent verification pass across every entry. Null when the table is
 * empty (pre-launch "being compiled" state).
 */
export const getLastVerifiedDate = async (): Promise<Date | null> => {
  const latest = await prisma.cctsObligatedEntity.findFirst({
    orderBy: { lastVerifiedDate: "desc" },
    select: { lastVerifiedDate: true },
  });
  return latest?.lastVerifiedDate ?? null;
};

const toCreateData = (input: CreateCctsObligatedEntityInput) => ({
  companyName: input.companyName,
  sector: input.sector,
  subSector: cleanOptional(input.subSector),
  state: input.state,
  district: cleanOptional(input.district),
  notificationReference: input.notificationReference,
  notificationDate: input.notificationDate,
  status: input.status ?? "DRAFT",
  baselineIntensity: input.baselineIntensity ?? null,
  targetIntensity: input.targetIntensity ?? null,
  sourceUrl: cleanOptional(input.sourceUrl),
  lastVerifiedDate: input.lastVerifiedDate,
});

export const createObligatedEntity = (input: CreateCctsObligatedEntityInput) =>
  prisma.cctsObligatedEntity.create({ data: toCreateData(input) });

export const updateObligatedEntity = async (id: string, input: UpdateCctsObligatedEntityInput) => {
  const existing = await prisma.cctsObligatedEntity.findUnique({ where: { id } });
  if (!existing) {
    throw AppError.notFound("Obligated entity not found");
  }

  return prisma.cctsObligatedEntity.update({
    where: { id },
    data: {
      companyName: input.companyName,
      sector: input.sector,
      subSector: input.subSector !== undefined ? cleanOptional(input.subSector) : undefined,
      state: input.state,
      district: input.district !== undefined ? cleanOptional(input.district) : undefined,
      notificationReference: input.notificationReference,
      notificationDate: input.notificationDate,
      status: input.status,
      baselineIntensity: input.baselineIntensity,
      targetIntensity: input.targetIntensity,
      sourceUrl: input.sourceUrl !== undefined ? cleanOptional(input.sourceUrl) : undefined,
      lastVerifiedDate: input.lastVerifiedDate,
    },
  });
};

export const deleteObligatedEntity = async (id: string) => {
  const existing = await prisma.cctsObligatedEntity.findUnique({ where: { id } });
  if (!existing) {
    throw AppError.notFound("Obligated entity not found");
  }
  await prisma.cctsObligatedEntity.delete({ where: { id } });
};

export interface BulkImportRowResult {
  row: number;
  companyName?: string;
  success: boolean;
  error?: string;
}

/**
 * Validates and inserts each CSV row independently — one malformed row
 * (bad date, missing required field) doesn't block the rest of a verified
 * list from loading. Returns a per-row result so the admin UI can show
 * exactly which rows failed and why.
 */
export const bulkImportObligatedEntities = async (rows: unknown[]): Promise<BulkImportRowResult[]> => {
  const results: BulkImportRowResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const rowNumber = i + 1;
    const parsed = createCctsObligatedEntitySchema.safeParse(rows[i]);
    if (!parsed.success) {
      const rawCompanyName =
        typeof rows[i] === "object" && rows[i] !== null && "companyName" in (rows[i] as Record<string, unknown>)
          ? String((rows[i] as Record<string, unknown>).companyName)
          : undefined;
      results.push({
        row: rowNumber,
        companyName: rawCompanyName,
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid row",
      });
      continue;
    }

    try {
      const created = await createObligatedEntity(parsed.data);
      results.push({ row: rowNumber, companyName: created.companyName, success: true });
    } catch (err) {
      results.push({
        row: rowNumber,
        companyName: parsed.data.companyName,
        success: false,
        error: err instanceof Error ? err.message : "Couldn't save this row",
      });
    }
  }

  return results;
};
