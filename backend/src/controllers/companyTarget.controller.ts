import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { prisma } from "../config/prisma";
import * as targetService from "../services/companyTarget.service";
import { companyTargetSchema } from "../validators/companyTarget.validators";
import { requireEsgBundleAccess } from "../services/esgBundleAccess.service";

const badRequest = (error: { issues: { path: (string | number)[]; message: string }[] }): never => {
  const issue = error.issues[0];
  throw AppError.badRequest(
    `${issue?.path.length ? `${issue.path.join(".")}: ` : ""}${issue?.message ?? "Invalid request body"}`,
    "VALIDATION_ERROR",
  );
};

/** Targets are company-level, so every route resolves the caller's company first. */
const requireCompany = async (userId: string) => {
  const company = await prisma.company.findUnique({ where: { ownerId: userId }, select: { id: true } });
  if (!company) throw AppError.notFound("Company not found");
  await requireEsgBundleAccess(company.id);
  return company;
};

export const listTargets = asyncHandler(async (req, res) => {
  const company = await requireCompany(req.user!.sub);
  const facilities = await prisma.facility.findMany({ where: { companyId: company.id }, select: { id: true } });
  const data = await targetService.listCompanyTargets(company.id, facilities.map((f) => f.id));
  res.status(200).json(data);
});

export const createTarget = asyncHandler(async (req, res) => {
  const company = await requireCompany(req.user!.sub);
  const parsed = companyTargetSchema.safeParse(req.body);
  if (!parsed.success) badRequest(parsed.error);
  const target = await targetService.createCompanyTarget(
    company.id,
    parsed.data as never,
    req.body?.submit === true,
  );
  res.status(201).json({ target });
});

export const updateTarget = asyncHandler(async (req, res) => {
  const company = await requireCompany(req.user!.sub);
  const parsed = companyTargetSchema.safeParse(req.body);
  if (!parsed.success) badRequest(parsed.error);
  const target = await targetService.updateCompanyTarget(
    company.id,
    req.params.targetId,
    parsed.data as never,
    req.body?.submit === true,
  );
  res.status(200).json({ target });
});

export const deleteTarget = asyncHandler(async (req, res) => {
  const company = await requireCompany(req.user!.sub);
  await targetService.deleteCompanyTarget(company.id, req.params.targetId);
  res.status(204).send();
});
