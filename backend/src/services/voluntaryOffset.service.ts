import type { OffsetCategory, VoluntaryOffsetPurchase } from "@prisma/client";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";
import { requireOwnedFacilityForEsgBundle } from "./esgBundleAccess.service";
import { round } from "./dashboardShared.helpers";
import type { VoluntaryOffsetInput } from "../validators/voluntaryOffset.validators";

/**
 * Voluntary carbon credit purchase log — CRUD only.
 *
 * Every read and write goes through requireOwnedFacilityForEsgBundle, the same
 * single-round-trip ownership + ESG Disclosure Bundle gate that BRSR, ISSB and
 * Scope 3 use. Nothing here calculates, verifies or scores: the totals below
 * are sums of what the purchaser entered.
 */

export const OFFSET_CATEGORIES: OffsetCategory[] = [
  "AVOIDANCE_NATURE",
  "AVOIDANCE_ENGINEERED",
  "REMOVAL_NATURE",
  "REMOVAL_ENGINEERED",
];

export interface OffsetTotals {
  /** SUBMITTED purchases only — a draft is not yet a claim. */
  totalTonnage: number;
  byCategory: Record<OffsetCategory, number>;
  purchaseCount: number;
}

const emptyByCategory = (): Record<OffsetCategory, number> =>
  OFFSET_CATEGORIES.reduce(
    (acc, category) => ({ ...acc, [category]: 0 }),
    {} as Record<OffsetCategory, number>,
  );

/**
 * Sums SUBMITTED purchases. Exported because the ESG Overview aggregates the
 * same way company-wide — one definition of "tonnes offset", used in both
 * places, so the facility page and the dashboard can never disagree.
 */
export const summariseOffsets = (purchases: VoluntaryOffsetPurchase[]): OffsetTotals => {
  const submitted = purchases.filter((p) => p.status === "SUBMITTED");
  const byCategory = emptyByCategory();

  for (const purchase of submitted) {
    byCategory[purchase.category] += purchase.tonnageTco2e;
  }

  for (const category of OFFSET_CATEGORIES) {
    byCategory[category] = round(byCategory[category]);
  }

  return {
    totalTonnage: round(submitted.reduce((sum, p) => sum + p.tonnageTco2e, 0)),
    byCategory,
    purchaseCount: submitted.length,
  };
};

const requireOwnedPurchase = async (userId: string, facilityId: string, purchaseId: string) => {
  await requireOwnedFacilityForEsgBundle(userId, facilityId);
  const purchase = await prisma.voluntaryOffsetPurchase.findUnique({ where: { id: purchaseId } });
  if (!purchase || purchase.facilityId !== facilityId) {
    throw AppError.notFound("Offset purchase not found");
  }
  return purchase;
};

export const listOffsets = async (userId: string, facilityId: string) => {
  await requireOwnedFacilityForEsgBundle(userId, facilityId);
  const purchases = await prisma.voluntaryOffsetPurchase.findMany({
    where: { facilityId },
    orderBy: [{ purchaseDate: "desc" }, { createdAt: "desc" }],
  });
  return { purchases, totals: summariseOffsets(purchases) };
};

const toData = (input: VoluntaryOffsetInput, submit: boolean) => ({
  registry: input.registry,
  creditSerialNumber: input.creditSerialNumber,
  tonnageTco2e: input.tonnageTco2e,
  category: input.category,
  vintageYear: input.vintageYear,
  purchaseDate: input.purchaseDate,
  notes: input.notes || null,
  status: (submit ? "SUBMITTED" : "DRAFT") as "SUBMITTED" | "DRAFT",
});

export const createOffset = async (
  userId: string,
  facilityId: string,
  input: VoluntaryOffsetInput,
  submit: boolean,
) => {
  const facility = await requireOwnedFacilityForEsgBundle(userId, facilityId);
  return prisma.voluntaryOffsetPurchase.create({
    data: { companyId: facility.companyId, facilityId, ...toData(input, submit) },
  });
};

/**
 * Unlike Scope 3, a SUBMITTED purchase stays editable. A serial number or
 * tonnage typo on a retirement record has to be correctable, and since this
 * log makes no assurance claim there is nothing that locking it would protect.
 */
export const updateOffset = async (
  userId: string,
  facilityId: string,
  purchaseId: string,
  input: VoluntaryOffsetInput,
  submit: boolean,
) => {
  const purchase = await requireOwnedPurchase(userId, facilityId, purchaseId);
  return prisma.voluntaryOffsetPurchase.update({
    where: { id: purchase.id },
    data: toData(input, submit),
  });
};

export const deleteOffset = async (userId: string, facilityId: string, purchaseId: string) => {
  const purchase = await requireOwnedPurchase(userId, facilityId, purchaseId);
  await prisma.voluntaryOffsetPurchase.delete({ where: { id: purchase.id } });
};
