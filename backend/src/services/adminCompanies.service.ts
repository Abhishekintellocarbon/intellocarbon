import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";

export const listCompanies = async () => {
  const companies = await prisma.company.findMany({
    include: {
      owner: { select: { email: true } },
      subscriptions: { where: { status: "ACTIVE" } },
      _count: { select: { facilities: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // "Last activity" = the most recently updated facility under this company,
  // falling back to the company's own updatedAt. One query for every
  // company's facilities rather than N+1 per row.
  const facilities = await prisma.facility.findMany({ select: { companyId: true, updatedAt: true } });
  const lastFacilityActivity = new Map<string, Date>();
  for (const f of facilities) {
    const existing = lastFacilityActivity.get(f.companyId);
    if (!existing || f.updatedAt > existing) lastFacilityActivity.set(f.companyId, f.updatedAt);
  }

  return companies.map((c) => {
    const facilityActivity = lastFacilityActivity.get(c.id);
    const lastActivity = facilityActivity && facilityActivity > c.updatedAt ? facilityActivity : c.updatedAt;
    return {
      id: c.id,
      name: c.name,
      registrationNumber: c.registrationNumber,
      sector: c.sector,
      ownerEmail: c.owner.email,
      plans: c.subscriptions.map((s) => s.tier),
      facilityCount: c._count.facilities,
      lastActivity,
      createdAt: c.createdAt,
    };
  });
};

export const getCompanyDetail = async (companyId: string) => {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      owner: { select: { id: true, name: true, email: true, approvalStatus: true, createdAt: true } },
      subscriptions: true,
      facilities: {
        include: { _count: { select: { activityData: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!company) {
    throw AppError.notFound("Company not found");
  }

  return company;
};
