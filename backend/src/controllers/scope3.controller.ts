import { asyncHandler } from "../utils/asyncHandler";
import * as scope3Service from "../services/scope3.service";
import * as scope3RelevanceService from "../services/scope3Relevance.service";
import { parseScope3Entry } from "../validators/scope3.validators";
import {
  SCOPE3_CATEGORY_CATALOG,
  CATEGORY_NUMBER_BY_PRISMA_CATEGORY,
  PRISMA_CATEGORY_BY_NUMBER,
  isCalculableScope3Category,
} from "../data/scope3Categories";
import { AppError } from "../utils/AppError";

// Reference endpoint for the frontend's category picker — all 15 GHG
// Protocol categories, flagged with which 5 are actually calculable today,
// so the UI can show an honest "not yet supported" state for the rest.
export const listScope3Categories = asyncHandler(async (_req, res) => {
  res.status(200).json({ categories: SCOPE3_CATEGORY_CATALOG });
});

/**
 * All 15 categories tagged MANDATORY / OPTIONAL / NOT_APPLICABLE for one
 * company, from its sector plus ownershipModel and businessModel.
 */
export const getScope3Relevance = asyncHandler(async (req, res) => {
  const result = await scope3RelevanceService.getScope3RelevanceForCompany(req.user!.sub, req.params.companyId);
  res.status(200).json(result);
});

/**
 * Placeholder for the 10 categories that have relevance but no calculation
 * path yet. Returns the same "coming_soon" shape the UI already renders for
 * GRI/CSRD/CDP on /esg, so a client hitting a category it can see in the
 * relevance list gets an honest answer instead of a 404.
 */
export const getScope3CategoryStub = asyncHandler(async (req, res) => {
  const categoryNumber = Number(req.params.category);
  const prismaCategory = PRISMA_CATEGORY_BY_NUMBER[categoryNumber];

  if (!prismaCategory) {
    throw AppError.badRequest("Scope 3 category must be a GHG Protocol category number from 1 to 15", "VALIDATION_ERROR");
  }

  if (isCalculableScope3Category(prismaCategory)) {
    throw AppError.badRequest(
      `Scope 3 Category ${categoryNumber} is already supported — use the facility data endpoints instead`,
      "SCOPE3_CATEGORY_ALREADY_SUPPORTED",
    );
  }

  const entry = SCOPE3_CATEGORY_CATALOG.find((c) => c.number === categoryNumber)!;
  res.status(200).json({
    status: "coming_soon",
    category: CATEGORY_NUMBER_BY_PRISMA_CATEGORY[prismaCategory],
    name: entry.name,
    prismaCategory,
  });
});

export const listScope3Data = asyncHandler(async (req, res) => {
  const reportingPeriod = typeof req.query.reportingPeriod === "string" ? req.query.reportingPeriod : undefined;
  const result = await scope3Service.listScope3Data(req.user!.sub, req.params.facilityId, reportingPeriod);
  res.status(200).json(result);
});

export const saveScope3Data = asyncHandler(async (req, res) => {
  const submit = req.body?.submit === true;
  const parsed = parseScope3Entry(req.body);
  const entry = await scope3Service.saveScope3Data(req.user!.sub, req.params.facilityId, parsed, submit);
  res.status(200).json({ entry });
});

export const deleteScope3Data = asyncHandler(async (req, res) => {
  await scope3Service.deleteScope3Data(req.user!.sub, req.params.facilityId, req.params.period, req.params.category);
  res.status(204).send();
});
