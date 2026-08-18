import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { prisma } from "../config/prisma";
import { requireOwnedFacilityForEsgBundle, requireEsgBundleAccess } from "../services/esgBundleAccess.service";
import { buildRecCoverage } from "../services/recCoverage.service";
import { recPurchaseSchema } from "../validators/rec.validators";

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

/** The ledger, plus coverage computed against the same facilities' electricity. */
export const listRecs = asyncHandler(async (req, res) => {
  const company = await requireCompany(req.user!.sub);
  const facilities = await prisma.facility.findMany({ where: { companyId: company.id }, select: { id: true } });
  const facilityIds = facilities.map((f) => f.id);

  const [purchases, activity] = await Promise.all([
    prisma.recPurchase.findMany({
      where: { companyId: company.id },
      orderBy: [{ vintageYear: "desc" }, { createdAt: "desc" }],
      include: { facility: { select: { name: true } } },
    }),
    facilityIds.length === 0
      ? Promise.resolve([])
      : prisma.activityData.findMany({
          where: { facilityId: { in: facilityIds }, status: "SUBMITTED" },
          select: { periodStart: true, gridElectricityMwh: true, renewableElectricityMwh: true },
        }),
  ]);

  // Only SUBMITTED certificates count toward coverage, matching how the
  // offsets summary treats purchases.
  const coverage = buildRecCoverage(
    purchases.filter((p) => p.status === "SUBMITTED").map((p) => ({ vintageYear: p.vintageYear, quantityMwh: p.quantityMwh })),
    activity,
  );

  res.status(200).json({ purchases, coverage });
});

export const createRec = asyncHandler(async (req, res) => {
  const parsed = recPurchaseSchema.safeParse(req.body);
  if (!parsed.success) badRequest(parsed.error);
  const input = parsed.data!;
  const facility = await requireOwnedFacilityForEsgBundle(req.user!.sub, input.facilityId);

  const purchase = await prisma.recPurchase.create({
    data: {
      companyId: facility.companyId,
      facilityId: facility.id,
      registry: input.registry,
      certificateReference: input.certificateReference,
      quantityMwh: input.quantityMwh,
      vintageYear: input.vintageYear,
      purchaseDate: input.purchaseDate,
      notes: input.notes || null,
      status: req.body?.submit === true ? "SUBMITTED" : "DRAFT",
    },
  });
  res.status(201).json({ purchase });
});

export const deleteRec = asyncHandler(async (req, res) => {
  const company = await requireCompany(req.user!.sub);
  const existing = await prisma.recPurchase.findUnique({ where: { id: req.params.recId } });
  if (!existing || existing.companyId !== company.id) throw AppError.notFound("Certificate not found");
  await prisma.recPurchase.delete({ where: { id: req.params.recId } });
  res.status(204).send();
});
