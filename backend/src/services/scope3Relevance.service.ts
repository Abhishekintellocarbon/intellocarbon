import type { BusinessModel, Company, OwnershipModel, Scope3Relevance, Sector } from "@prisma/client";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";
import { requireEsgBundleAccess } from "./esgBundleAccess.service";
import { SCOPE3_CATEGORY_CATALOG } from "../data/scope3Categories";
import { SCOPE3_RELEVANCE_BASELINE } from "../data/scope3RelevanceBaseline";

export interface ResolvedCategoryRelevance {
  category: number;
  name: string;
  prismaCategory: string;
  /** False for the 10 categories with no calculation path yet — UI shows "Coming soon". */
  calculable: boolean;
  relevance: Scope3Relevance;
  reasoning: string;
}

const hasLeasedAssets = (ownershipModel: OwnershipModel) => ownershipModel === "LEASED" || ownershipModel === "MIXED";

const OWNERSHIP_LABEL: Record<OwnershipModel, string> = {
  OWNED: "owned",
  LEASED: "leased",
  MIXED: "a mix of owned and leased",
};

/**
 * Applies the company-specific overrides that the per-sector baseline can't
 * know about. Categories 8 and 13 exist only if the company leases assets;
 * 14 only for a franchisor; 15 only for a financial institution; and 9 drops
 * from mandatory to optional when the company isn't the manufacturer setting
 * the terms of onward distribution.
 *
 * Returning the overridden `reasoning` alongside the relevance is the point —
 * it's what the UI shows in the tooltip on a greyed-out category, and it's
 * the audit trail for why a category was left out of the inventory.
 */
const applyCompanyOverrides = (
  category: number,
  baseline: { relevance: Scope3Relevance; reasoning: string },
  ownershipModel: OwnershipModel,
  businessModel: BusinessModel,
): { relevance: Scope3Relevance; reasoning: string } => {
  switch (category) {
    case 8:
      return hasLeasedAssets(ownershipModel)
        ? {
            relevance: "OPTIONAL",
            reasoning: `The company's assets are recorded as ${OWNERSHIP_LABEL[ownershipModel]}, so upstream leased assets are in scope. Report them where the leased asset's energy use isn't already inside your Scope 1 and 2 boundary.`,
          }
        : baseline;

    case 9:
      return businessModel === "MANUFACTURER"
        ? baseline
        : {
            relevance: "OPTIONAL",
            reasoning:
              "Downstream transportation is optional for a company that isn't the manufacturer — report it where you, rather than your customer, pay for and control onward freight.",
          };

    case 13:
      return hasLeasedAssets(ownershipModel)
        ? {
            relevance: "OPTIONAL",
            reasoning: `The company's assets are recorded as ${OWNERSHIP_LABEL[ownershipModel]}, so assets leased out to others are in scope and their operating emissions are attributable to you as lessor.`,
          }
        : baseline;

    case 14:
      return businessModel === "FRANCHISOR"
        ? {
            relevance: "MANDATORY",
            reasoning:
              "The company's business model is Franchisor, so emissions from franchisee operations are attributable and must be reported.",
          }
        : baseline;

    case 15:
      return businessModel === "FINANCIAL_INSTITUTION"
        ? {
            relevance: "MANDATORY",
            reasoning:
              "The company's business model is Financial institution, so financed emissions from investments, loans and underwriting are attributable and are normally the dominant category.",
          }
        : baseline;

    default:
      return baseline;
  }
};

/**
 * Falls back to the in-code baseline when the DB table hasn't been seeded for
 * a sector. The endpoint answering "which categories must I disclose" should
 * never 500 or silently return a short list because a seed didn't run — a
 * missing row means the deployment is unseeded, not that the category is
 * irrelevant.
 */
const loadSectorBaseline = async (sector: Sector) => {
  const rows = await prisma.scope3CategoryRelevance.findMany({ where: { sector } });
  const bySector = new Map(rows.map((r) => [r.category, { relevance: r.relevance, reasoning: r.reasoning }]));

  for (const row of SCOPE3_RELEVANCE_BASELINE) {
    if (row.sector === sector && !bySector.has(row.category)) {
      bySector.set(row.category, { relevance: row.relevance, reasoning: row.reasoning });
    }
  }
  return bySector;
};

/**
 * The relevance resolution itself, against an already-loaded company record —
 * split out from getScope3RelevanceForCompany so callers that have their own
 * company row and their own access gate (the ESG Overview aggregate, which
 * needs the mandatory-category list to score Scope 3 completeness) can reuse
 * the exact same determination instead of re-deriving it. This performs no
 * ownership or subscription check of its own; the exported endpoint below
 * still does both.
 */
export const resolveScope3Relevance = async (
  company: Pick<Company, "sector" | "ownershipModel" | "businessModel">,
): Promise<ResolvedCategoryRelevance[]> => {
  const baseline = await loadSectorBaseline(company.sector);

  return SCOPE3_CATEGORY_CATALOG.map((entry) => {
    const row = baseline.get(entry.number) ?? {
      relevance: "OPTIONAL" as Scope3Relevance,
      reasoning: "No sector-level materiality guidance is recorded for this category — assess and report if material.",
    };
    const resolved = applyCompanyOverrides(entry.number, row, company.ownershipModel, company.businessModel);

    return {
      category: entry.number,
      name: entry.name,
      prismaCategory: entry.prismaCategory,
      calculable: entry.calculable,
      relevance: resolved.relevance,
      reasoning: resolved.reasoning,
    };
  });
};

/**
 * All 15 categories tagged MANDATORY / OPTIONAL / NOT_APPLICABLE for one
 * company, from its sector plus its ownership and business model. Read-only
 * — this never writes and never touches Scope3Data.
 */
export const getScope3RelevanceForCompany = async (userId: string, companyId: string) => {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, ownerId: true, sector: true, ownershipModel: true, businessModel: true },
  });

  // Same shape of answer as an unowned facility elsewhere in this module: a
  // company the caller doesn't own is reported as absent, not as forbidden.
  if (!company || company.ownerId !== userId) {
    throw AppError.notFound("Company not found");
  }
  await requireEsgBundleAccess(company.id);

  return {
    companyId: company.id,
    sector: company.sector,
    ownershipModel: company.ownershipModel,
    businessModel: company.businessModel,
    categories: await resolveScope3Relevance(company),
  };
};
