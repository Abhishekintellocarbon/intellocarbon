import { prisma } from "../config/prisma";

// Demo/investor-demonstration companies are excluded from every headline
// metric. Each one carries a fabricated year of activity data, so counting
// them overstates companies, users and reports alike. `user.count` filters on
// the owned company rather than the user directly: a demo company's owner is
// the only user it has, and users with no company at all (verifiers, internal
// operators, super admins) must still be counted.
const EXCLUDE_DEMO = { isDemoAccount: false } as const;

export const getOverviewMetrics = async () => {
  const [totalCompanies, totalUsers, totalReports, totalLeadCaptures] = await Promise.all([
    prisma.company.count({ where: EXCLUDE_DEMO }),
    prisma.user.count({ where: { OR: [{ company: null }, { company: EXCLUDE_DEMO }] } }),
    prisma.report.count({ where: { company: EXCLUDE_DEMO } }),
    prisma.leadCapture.count(),
  ]);
  return { totalCompanies, totalUsers, totalReports, totalLeadCaptures };
};

export const getRecentSignups = async (limit: number) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      company: { include: { subscriptions: { where: { status: "ACTIVE" } } } },
    },
  });

  return users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    companyName: u.company?.name ?? u.companyName,
    sector: u.company?.sector ?? null,
    // A company can hold several active tiers at once (see Subscription's schema comment).
    plans: u.company?.subscriptions.map((s) => s.tier) ?? [],
    approvalStatus: u.approvalStatus,
    createdAt: u.createdAt,
  }));
};

export const getRecentActivity = async (limit: number) => {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: { select: { email: true } } },
  });

  return logs.map((l) => ({
    id: l.id,
    userEmail: l.user?.email ?? null,
    action: l.action,
    detail: l.detail,
    createdAt: l.createdAt,
  }));
};

export const getRecentLeads = async (limit: number) =>
  prisma.leadCapture.findMany({ orderBy: { createdAt: "desc" }, take: limit });

export const getAdminOverview = async () => {
  const [metrics, recentSignups, recentActivity, recentLeads] = await Promise.all([
    getOverviewMetrics(),
    getRecentSignups(10),
    getRecentActivity(20),
    getRecentLeads(20),
  ]);

  return { metrics, recentSignups, recentActivity, recentLeads };
};
