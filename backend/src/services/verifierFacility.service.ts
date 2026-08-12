import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";
import { requireCompanyAssigned, getAssignedCompanyIds } from "./verifierAssignment.service";
import { computeCbamFinancialImpact } from "./cbamFinancialImpact.service";
import { computeUkCbamFinancialImpact } from "./ukCbamFinancialImpact.service";
import type { ReportContext } from "./report.service";
import { CALCULATION_METHODOLOGY, UK_CBAM_METHODOLOGY } from "../data/verificationMethodology";

/**
 * Facilities under companies assigned to this verifier that have at least
 * one submitted entry to review. Pass `companyId` to scope to a single
 * assigned company (used by getCompanyDetail below) — narrows the same
 * query rather than fetching everything and filtering client-side.
 */
export const listAssignedFacilities = async (verifierId: string, companyId?: string) => {
  const assignedCompanyIds = await getAssignedCompanyIds(verifierId);
  const companyIds = companyId ? assignedCompanyIds.filter((id) => id === companyId) : assignedCompanyIds;
  if (companyIds.length === 0) return [];

  const facilities = await prisma.facility.findMany({
    where: { companyId: { in: companyIds }, activityData: { some: { status: "SUBMITTED" } } },
    include: {
      company: { select: { id: true, name: true, sector: true } },
      _count: { select: { activityData: { where: { status: "SUBMITTED" } } } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const pendingEntries = await prisma.activityData.findMany({
    where: {
      facilityId: { in: facilities.map((f) => f.id) },
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
    company: f.company,
    submittedEntryCount: f._count.activityData,
    evidencePending: evidencePendingFacilityIds.has(f.id),
  }));
};

/**
 * Every company this verifier is assigned to, each with its qualifying
 * facilities (possibly none, if the company hasn't submitted anything yet)
 * — unlike listAssignedFacilities, a company isn't silently dropped just
 * because it has no facility to show yet.
 */
export const listAssignedCompanies = async (verifierId: string) => {
  const companyIds = await getAssignedCompanyIds(verifierId);
  if (companyIds.length === 0) return [];

  const [companies, facilities] = await Promise.all([
    prisma.company.findMany({
      where: { id: { in: companyIds } },
      select: { id: true, name: true, sector: true },
      orderBy: { name: "asc" },
    }),
    listAssignedFacilities(verifierId),
  ]);

  const facilitiesByCompany = new Map<string, typeof facilities>();
  for (const f of facilities) {
    const list = facilitiesByCompany.get(f.company.id) ?? [];
    list.push(f);
    facilitiesByCompany.set(f.company.id, list);
  }

  return companies.map((c) => ({ ...c, facilities: facilitiesByCompany.get(c.id) ?? [] }));
};

export const getCompanyDetail = async (verifierId: string, companyId: string) => {
  await requireCompanyAssigned(verifierId, companyId);
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true, sector: true },
  });
  if (!company) {
    throw AppError.notFound("Company not found");
  }
  const facilities = await listAssignedFacilities(verifierId, companyId);
  return { company, facilities };
};

export const getFacilityDetail = async (verifierId: string, facilityId: string) => {
  const facility = await prisma.facility.findUnique({
    where: { id: facilityId },
    include: { company: { include: { owner: { select: { id: true, name: true, email: true } } } } },
  });
  if (!facility) {
    throw AppError.notFound("Facility not found");
  }
  await requireCompanyAssigned(verifierId, facility.companyId);

  const activityData = await prisma.activityData.findMany({
    where: { facilityId, status: "SUBMITTED" },
    include: {
      calculationResult: true,
      fuelEntries: true,
      processMaterialEntries: true,
      precursorEntries: true,
      _count: { select: { documents: { where: { documentType: "SUPPORTING_EVIDENCE" } } } },
      verificationRequest: { include: { verifier: { select: { name: true } } } },
    },
    orderBy: { periodEnd: "desc" },
  });

  const documents = await prisma.document.findMany({ where: { facilityId }, orderBy: { createdAt: "desc" } });

  // "Who submitted it" — this app has one user per company (no multi-seat
  // team model), so the submitter is always the company owner.
  const enrichedEntries = activityData.map((entry) => {
    const evidencePending = entry._count.documents === 0;

    let financials = null;
    // Separate from `financials` rather than merged into it: a verifier has
    // to be able to see which regime each figure belongs to, and the UK's
    // emissions boundary and currency differ from the EU's. Null whenever
    // the company isn't in UK scope, so the panel simply doesn't render.
    let ukCbamFinancials = null;
    if (entry.calculationResult && entry.periodStart && entry.periodEnd && entry.productionQuantityT != null) {
      const ctx = {
        ...entry,
        facility: { ...facility, productionRoute: facility.productionRoute ?? "OTHER" },
      } as unknown as ReportContext;
      const impact = computeCbamFinancialImpact(ctx, "CBAM");

      financials = {
        actualSee: impact.actualSee,
        defaultSee: impact.defaultSee,
        seeUnit: facility.company.sector === "ELECTRICITY" ? "tCO2e/MWh" : "tCO2e/t",
        certificatesRequired: impact.certificatesRequired,
        certificatePrice: impact.certificatePrice,
        certificatePriceQuarter: impact.certificatePriceQuarter,
        grossLiabilityEur: impact.grossLiabilityEur,
        article9DeductionTonnes: impact.article9DeductionTonnes,
        article9DeductionEur: impact.article9DeductionEur,
        netLiabilityEur: impact.netLiabilityEur,
        ghgIntensityCcts: entry.calculationResult.ghgIntensityCcts,
        cctsTargetIntensity: impact.cctsPosition.pending ? null : impact.cctsPosition.targetIntensity,
        cctsDeltaTco2e: impact.cctsPosition.pending ? null : impact.cctsPosition.deltaTco2e,
        methodology: CALCULATION_METHODOLOGY,
      };

      if (facility.company.cbamFrameworks.includes("UK_CBAM")) {
        const ukImpact = computeUkCbamFinancialImpact(ctx);
        ukCbamFinancials =
          ukImpact.status === "OUT_OF_SCOPE"
            ? { status: ukImpact.status, reason: ukImpact.reason }
            : {
                status: ukImpact.status,
                emissionsTco2e: ukImpact.emissionsTco2e,
                specificEmbeddedEmissions: ukImpact.specificEmbeddedEmissions,
                excludedIndirectTco2e: ukImpact.excludedIndirectTco2e,
                rateGbpPerTonne: ukImpact.status === "CALCULATED" ? ukImpact.rateGbpPerTonne : null,
                rateQuarter: ukImpact.status === "CALCULATED" ? ukImpact.rateQuarter : null,
                grossLiabilityGbp: ukImpact.status === "CALCULATED" ? ukImpact.grossLiabilityGbp : null,
                overseasCarbonPriceDeductionGbp:
                  ukImpact.status === "CALCULATED" ? ukImpact.overseasCarbonPriceDeductionGbp : null,
                netLiabilityGbp: ukImpact.status === "CALCULATED" ? ukImpact.netLiabilityGbp : null,
                reason: ukImpact.status === "RATE_PENDING" ? ukImpact.reason : null,
                methodology: UK_CBAM_METHODOLOGY,
              };
      }
    }

    return { ...entry, evidencePending, financials, ukCbamFinancials };
  });

  return {
    facility,
    activityData: enrichedEntries,
    documents,
  };
};

export const getDocumentFile = async (verifierId: string, facilityId: string, documentId: string) => {
  const facility = await prisma.facility.findUnique({ where: { id: facilityId } });
  if (!facility) {
    throw AppError.notFound("Facility not found");
  }
  await requireCompanyAssigned(verifierId, facility.companyId);

  const document = await prisma.document.findUnique({ where: { id: documentId } });
  if (!document || document.facilityId !== facilityId) {
    throw AppError.notFound("Document not found");
  }
  return { fileName: document.fileName, fileData: document.fileData };
};
