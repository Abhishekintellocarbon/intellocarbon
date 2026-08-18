import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { prisma } from "../config/prisma";
import { requireOwnedFacilityForEsgBundle, requireEsgBundleAccess } from "../services/esgBundleAccess.service";
import { buildProductFootprint } from "../services/productFootprint.service";
import { resolveFyWindow, rollupFacilityGhgForFy } from "../services/brsrCalculation.service";
import { productSkuSchema } from "../validators/productSku.validators";

const badRequest = (error: { issues: { path: (string | number)[]; message: string }[] }): never => {
  const issue = error.issues[0];
  throw AppError.badRequest(
    `${issue?.path.length ? `${issue.path.join(".")}: ` : ""}${issue?.message ?? "Invalid request body"}`,
    "VALIDATION_ERROR",
  );
};

const requireCompany = async (userId: string) => {
  const company = await prisma.company.findUnique({ where: { ownerId: userId } });
  if (!company) throw AppError.notFound("Company not found");
  await requireEsgBundleAccess(company.id);
  return company;
};

/**
 * The allocation for one facility and period. Scoped that way because both the
 * emissions being divided and the product mix dividing them are period-bound.
 */
export const getAllocation = asyncHandler(async (req, res) => {
  const company = await requireCompany(req.user!.sub);
  const facility = await requireOwnedFacilityForEsgBundle(req.user!.sub, req.params.facilityId);
  const period = req.params.period;

  const window = resolveFyWindow(period, company.reportingFyStartMonth);
  // The GHG rollup already carries the FY's production total, so there is no
  // second aggregate query and no chance of the two disagreeing.
  const [skus, ghg] = await Promise.all([
    prisma.productSku.findMany({
      where: { facilityId: facility.id, reportingPeriod: period, status: "SUBMITTED" },
      orderBy: { name: "asc" },
    }),
    rollupFacilityGhgForFy(facility.id, window),
  ]);

  const allocation = buildProductFootprint(
    period,
    ghg.totalCo2e,
    skus.map((s) => ({
      id: s.id,
      name: s.name,
      skuCode: s.skuCode,
      productionQuantity: s.productionQuantity,
      unit: s.unit,
    })),
    ghg.productionQuantityT > 0 ? ghg.productionQuantityT : null,
    "tonnes",
  );

  res.status(200).json({ allocation, skus });
});

export const createSku = asyncHandler(async (req, res) => {
  const parsed = productSkuSchema.safeParse(req.body);
  if (!parsed.success) badRequest(parsed.error);
  const input = parsed.data!;
  const facility = await requireOwnedFacilityForEsgBundle(req.user!.sub, input.facilityId);

  const skuRow = await prisma.productSku.create({
    data: {
      companyId: facility.companyId,
      facilityId: facility.id,
      name: input.name,
      skuCode: input.skuCode || null,
      reportingPeriod: input.reportingPeriod,
      productionQuantity: input.productionQuantity,
      unit: input.unit,
      notes: input.notes || null,
      status: req.body?.submit === true ? "SUBMITTED" : "DRAFT",
    },
  });
  res.status(201).json({ sku: skuRow });
});

export const deleteSku = asyncHandler(async (req, res) => {
  const company = await requireCompany(req.user!.sub);
  const existing = await prisma.productSku.findUnique({ where: { id: req.params.skuId } });
  if (!existing || existing.companyId !== company.id) throw AppError.notFound("Product not found");
  await prisma.productSku.delete({ where: { id: req.params.skuId } });
  res.status(204).send();
});
