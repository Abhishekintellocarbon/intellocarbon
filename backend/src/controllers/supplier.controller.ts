import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { prisma } from "../config/prisma";
import { requireEsgBundleAccess } from "../services/esgBundleAccess.service";
import { buildSupplierScorecard } from "../services/supplierScorecard.service";
import { supplierSchema } from "../validators/supplier.validators";

const badRequest = (error: { issues: { path: (string | number)[]; message: string }[] }): never => {
  const issue = error.issues[0];
  throw AppError.badRequest(
    `${issue?.path.length ? `${issue.path.join(".")}: ` : ""}${issue?.message ?? "Invalid request body"}`,
    "VALIDATION_ERROR",
  );
};

const requireCompany = async (userId: string) => {
  const company = await prisma.company.findUnique({ where: { ownerId: userId }, select: { id: true } });
  if (!company) throw AppError.notFound("Company not found");
  await requireEsgBundleAccess(company.id);
  return company;
};

export const listSuppliers = asyncHandler(async (req, res) => {
  const company = await requireCompany(req.user!.sub);
  const suppliers = await prisma.supplier.findMany({
    where: { companyId: company.id },
    orderBy: [{ riskFlag: "asc" }, { name: "asc" }],
  });
  // SUBMITTED only in the scorecard, matching every other ledger here.
  const scorecard = buildSupplierScorecard(suppliers.filter((s) => s.status === "SUBMITTED"));
  res.status(200).json({ suppliers, scorecard });
});

const toData = (input: ReturnType<typeof supplierSchema.parse>) => ({
  name: input.name,
  sector: input.sector || null,
  country: input.country || null,
  hasEsgDisclosure: input.hasEsgDisclosure ?? false,
  esgDisclosureType: input.esgDisclosureType || null,
  riskFlag: input.riskFlag ?? ("NOT_ASSESSED" as const),
  riskNotes: input.riskNotes || null,
  spendSharePct: input.spendSharePct ?? null,
  lastReviewedAt: input.lastReviewedAt ?? null,
});

export const createSupplier = asyncHandler(async (req, res) => {
  const company = await requireCompany(req.user!.sub);
  const parsed = supplierSchema.safeParse(req.body);
  if (!parsed.success) badRequest(parsed.error);
  const supplier = await prisma.supplier.create({
    data: { companyId: company.id, ...toData(parsed.data!), status: req.body?.submit === true ? "SUBMITTED" : "DRAFT" },
  });
  res.status(201).json({ supplier });
});

const requireOwn = async (companyId: string, supplierId: string) => {
  const existing = await prisma.supplier.findUnique({ where: { id: supplierId } });
  if (!existing || existing.companyId !== companyId) throw AppError.notFound("Supplier not found");
  return existing;
};

export const updateSupplier = asyncHandler(async (req, res) => {
  const company = await requireCompany(req.user!.sub);
  await requireOwn(company.id, req.params.supplierId);
  const parsed = supplierSchema.safeParse(req.body);
  if (!parsed.success) badRequest(parsed.error);
  const supplier = await prisma.supplier.update({
    where: { id: req.params.supplierId },
    data: { ...toData(parsed.data!), status: req.body?.submit === true ? "SUBMITTED" : "DRAFT" },
  });
  res.status(200).json({ supplier });
});

export const deleteSupplier = asyncHandler(async (req, res) => {
  const company = await requireCompany(req.user!.sub);
  await requireOwn(company.id, req.params.supplierId);
  await prisma.supplier.delete({ where: { id: req.params.supplierId } });
  res.status(204).send();
});
