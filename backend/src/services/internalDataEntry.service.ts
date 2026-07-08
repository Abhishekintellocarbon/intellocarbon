import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";
import { getAssignedFacilityIds, requireFacilityAssigned } from "./facilityAssignment.service";

/**
 * Facilities assigned to this internal (DATA_ENTRY_INTERNAL) operator — the
 * "My Assigned Facilities" list. Deliberately thin (no financials, no
 * calculation breakdown, no revenue/billing) since this portal is scoped to
 * data entry only, unlike the owner dashboard or verifier portal.
 */
export const listAssignedFacilities = async (userId: string) => {
  const facilityIds = await getAssignedFacilityIds(userId);
  if (facilityIds.length === 0) return [];

  const facilities = await prisma.facility.findMany({
    where: { id: { in: facilityIds } },
    include: {
      company: { select: { id: true, name: true, sector: true } },
      _count: { select: { activityData: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const pendingEntries = await prisma.activityData.findMany({
    where: {
      facilityId: { in: facilityIds },
      status: "SUBMITTED",
      documents: { none: { documentType: "SUPPORTING_EVIDENCE" } },
    },
    select: { facilityId: true },
    distinct: ["facilityId"],
  });
  const evidencePendingFacilityIds = new Set(pendingEntries.map((e) => e.facilityId));

  return facilities.map((f) => ({
    id: f.id,
    name: f.name,
    sector: f.company.sector,
    company: f.company,
    entryCount: f._count.activityData,
    evidencePending: evidencePendingFacilityIds.has(f.id),
  }));
};

/**
 * A single assigned facility's data-entry summary — entries list (with
 * per-entry Evidence Pending status) only. No calculation breakdown, no
 * CBAM/CCTS financials, no report generation — those stay owner-only.
 */
export const getAssignedFacilityDetail = async (userId: string, facilityId: string) => {
  const facility = await prisma.facility.findUnique({
    where: { id: facilityId },
    include: { company: { select: { id: true, name: true, sector: true } } },
  });
  if (!facility) {
    throw AppError.notFound("Facility not found");
  }
  await requireFacilityAssigned(userId, facilityId);

  const entries = await prisma.activityData.findMany({
    where: { facilityId },
    include: { _count: { select: { documents: { where: { documentType: "SUPPORTING_EVIDENCE" } } } } },
    orderBy: { periodStart: "desc" },
  });

  return {
    facility: {
      id: facility.id,
      name: facility.name,
      sector: facility.company.sector,
      productionRoute: facility.productionRoute,
      isDraft: facility.isDraft,
      company: facility.company,
    },
    entries: entries.map((entry) => ({
      id: entry.id,
      periodStart: entry.periodStart,
      periodEnd: entry.periodEnd,
      productCategory: entry.productCategory,
      productionQuantityT: entry.productionQuantityT,
      status: entry.status,
      evidencePending: entry.status === "SUBMITTED" && entry._count.documents === 0,
      updatedAt: entry.updatedAt,
    })),
  };
};
