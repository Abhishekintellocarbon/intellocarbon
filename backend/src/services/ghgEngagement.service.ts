import type { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";
import { calculateGhgEngagement, type Scope1Entry, type Scope2Entry, type Scope3Entry } from "./ghgCalculation.service";
import type { CreateGhgEngagementInput, UpdateGhgEngagementInput } from "../validators/ghgEngagement.validators";

const asJson = (v: unknown) => v as Prisma.InputJsonValue;

export const asScope1Entries = (v: Prisma.JsonValue): Scope1Entry[] => (v as unknown as Scope1Entry[]) ?? [];
export const asScope2Entries = (v: Prisma.JsonValue): Scope2Entry[] => (v as unknown as Scope2Entry[]) ?? [];
export const asScope3Entries = (v: Prisma.JsonValue): Scope3Entry[] => (v as unknown as Scope3Entry[]) ?? [];

export const listEngagements = (search?: string) =>
  prisma.ghgEngagement.findMany({
    where: search ? { organizationName: { contains: search, mode: "insensitive" } } : undefined,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      organizationName: true,
      country: true,
      jurisdiction: true,
      reportingPeriodStart: true,
      reportingPeriodEnd: true,
      numberOfSites: true,
      status: true,
      scope1TotalTco2e: true,
      scope2TotalTco2e: true,
      totalTco2e: true,
      reportGeneratedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

export const getEngagement = async (id: string) => {
  const engagement = await prisma.ghgEngagement.findUnique({ where: { id } });
  if (!engagement) {
    throw AppError.notFound("Engagement not found");
  }
  return engagement;
};

const engagementWriteData = (input: CreateGhgEngagementInput | UpdateGhgEngagementInput) => {
  const calc = calculateGhgEngagement(input.scope1Entries, input.scope2Entries, input.jurisdiction);
  return {
    organizationName: input.organizationName,
    country: input.country,
    reportingPeriodStart: input.reportingPeriodStart,
    reportingPeriodEnd: input.reportingPeriodEnd,
    jurisdiction: input.jurisdiction,
    numberOfSites: input.numberOfSites ?? null,
    scope1Entries: asJson(input.scope1Entries),
    scope2Entries: asJson(input.scope2Entries),
    scope3Entries: asJson(input.scope3Entries),
    scope1TotalTco2e: calc.scope1TotalTco2e,
    scope2TotalTco2e: calc.scope2TotalTco2e,
    totalTco2e: calc.totalTco2e,
    gwpSchemeUsed: calc.gwpScheme,
  };
};

export const createEngagement = (input: CreateGhgEngagementInput, createdBy: string) =>
  prisma.ghgEngagement.create({
    data: { ...engagementWriteData(input), status: "DRAFT", createdBy },
  });

const requireDraftEngagement = async (id: string) => {
  const engagement = await prisma.ghgEngagement.findUnique({ where: { id } });
  if (!engagement) {
    throw AppError.notFound("Engagement not found");
  }
  if (engagement.status !== "DRAFT") {
    throw AppError.badRequest(
      "Finalized engagements are locked — duplicate it to make changes",
      "ENGAGEMENT_FINALIZED",
    );
  }
  return engagement;
};

export const updateEngagement = async (id: string, input: UpdateGhgEngagementInput) => {
  await requireDraftEngagement(id);
  return prisma.ghgEngagement.update({ where: { id }, data: engagementWriteData(input) });
};

export const finalizeEngagement = async (id: string) => {
  await requireDraftEngagement(id);
  return prisma.ghgEngagement.update({ where: { id }, data: { status: "FINALIZED" } });
};

export const duplicateEngagement = async (id: string, createdBy: string) => {
  const source = await getEngagement(id);
  return prisma.ghgEngagement.create({
    data: {
      organizationName: `${source.organizationName} (Copy)`,
      country: source.country,
      reportingPeriodStart: source.reportingPeriodStart,
      reportingPeriodEnd: source.reportingPeriodEnd,
      jurisdiction: source.jurisdiction,
      numberOfSites: source.numberOfSites,
      scope1Entries: asJson(source.scope1Entries),
      scope2Entries: asJson(source.scope2Entries),
      scope3Entries: asJson(source.scope3Entries),
      scope1TotalTco2e: source.scope1TotalTco2e,
      scope2TotalTco2e: source.scope2TotalTco2e,
      totalTco2e: source.totalTco2e,
      gwpSchemeUsed: source.gwpSchemeUsed,
      status: "DRAFT",
      createdBy,
    },
  });
};

