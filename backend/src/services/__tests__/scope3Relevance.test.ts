import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../../config/prisma";
import { getScope3RelevanceForCompany } from "../scope3Relevance.service";
import { activateSubscriptionForTier } from "../billing.service";

/**
 * Sector-driven relevance for all 15 GHG Protocol categories, exercised
 * against the dev database in the same integration style as
 * facilityCapacity.test.ts. Assumes the reference seed has been run
 * (`npm run prisma:seed`); the service falls back to the in-code baseline
 * when a sector's rows are missing, so these expectations hold either way.
 */
describe("Scope 3 category relevance for a STEEL company", () => {
  const email = `scope3-relevance-test-${Date.now()}@example.com`;
  let userId: string;
  let companyId: string;

  const relevanceOf = async (category: number) => {
    const result = await getScope3RelevanceForCompany(userId, companyId);
    return result.categories.find((c) => c.category === category)!;
  };

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { name: "Scope 3 Relevance Test", email, passwordHash: "x", approvalStatus: "APPROVED" },
    });
    userId = user.id;
    const company = await prisma.company.create({
      data: { ownerId: userId, name: "Scope 3 Relevance Test Steel Co", sector: "STEEL" },
    });
    companyId = company.id;
    // Scope 3 sits inside the ESG Disclosure Bundle, so the relevance
    // endpoint is gated on that subscription like every other Scope 3 route.
    await activateSubscriptionForTier(companyId, "BRSR_CORE_REPORTING", new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
  });

  afterAll(async () => {
    await prisma.subscription.deleteMany({ where: { companyId } });
    await prisma.company.deleteMany({ where: { id: companyId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it("returns all 15 categories, numbered 1 to 15 in order", async () => {
    const result = await getScope3RelevanceForCompany(userId, companyId);
    expect(result.categories).toHaveLength(15);
    expect(result.categories.map((c) => c.category)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  });

  it("flags exactly the 5 built categories as calculable", async () => {
    const result = await getScope3RelevanceForCompany(userId, companyId);
    expect(result.categories.filter((c) => c.calculable).map((c) => c.category)).toEqual([1, 4, 6, 7, 11]);
  });

  it("marks Categories 1, 3, 4, 5, 11 and 12 mandatory for steel", async () => {
    for (const category of [1, 3, 4, 5, 11, 12]) {
      expect((await relevanceOf(category)).relevance).toBe("MANDATORY");
    }
  });

  it("marks Category 10 mandatory for steel — crude steel is an intermediate good", async () => {
    const cat10 = await relevanceOf(10);
    expect(cat10.relevance).toBe("MANDATORY");
    expect(cat10.reasoning).toMatch(/intermediate good/i);
  });

  it("marks Categories 2, 6 and 7 optional", async () => {
    for (const category of [2, 6, 7]) {
      expect((await relevanceOf(category)).relevance).toBe("OPTIONAL");
    }
  });

  it("marks Categories 14 and 15 not applicable for a manufacturer", async () => {
    for (const category of [14, 15]) {
      const resolved = await relevanceOf(category);
      expect(resolved.relevance).toBe("NOT_APPLICABLE");
      expect(resolved.reasoning).toMatch(/not applicable/i);
    }
  });

  it("marks Categories 8 and 13 not applicable while the company's assets are OWNED", async () => {
    for (const category of [8, 13]) {
      const resolved = await relevanceOf(category);
      expect(resolved.relevance).toBe("NOT_APPLICABLE");
      expect(resolved.reasoning).toMatch(/no leased assets on record/i);
    }
  });

  it("turns Categories 8 and 13 on when ownershipModel becomes LEASED", async () => {
    await prisma.company.update({ where: { id: companyId }, data: { ownershipModel: "LEASED" } });
    for (const category of [8, 13]) {
      const resolved = await relevanceOf(category);
      expect(resolved.relevance).toBe("OPTIONAL");
      expect(resolved.reasoning).toMatch(/recorded as leased/i);
    }
    await prisma.company.update({ where: { id: companyId }, data: { ownershipModel: "OWNED" } });
  });

  it("turns Categories 8 and 13 on for MIXED ownership too", async () => {
    await prisma.company.update({ where: { id: companyId }, data: { ownershipModel: "MIXED" } });
    expect((await relevanceOf(8)).relevance).toBe("OPTIONAL");
    await prisma.company.update({ where: { id: companyId }, data: { ownershipModel: "OWNED" } });
  });

  it("makes Category 14 mandatory for a FRANCHISOR and 15 for a FINANCIAL_INSTITUTION", async () => {
    await prisma.company.update({ where: { id: companyId }, data: { businessModel: "FRANCHISOR" } });
    expect((await relevanceOf(14)).relevance).toBe("MANDATORY");
    expect((await relevanceOf(15)).relevance).toBe("NOT_APPLICABLE");

    await prisma.company.update({ where: { id: companyId }, data: { businessModel: "FINANCIAL_INSTITUTION" } });
    expect((await relevanceOf(15)).relevance).toBe("MANDATORY");
    expect((await relevanceOf(14)).relevance).toBe("NOT_APPLICABLE");

    await prisma.company.update({ where: { id: companyId }, data: { businessModel: "MANUFACTURER" } });
  });

  it("downgrades Category 9 from mandatory to optional when the company isn't a manufacturer", async () => {
    expect((await relevanceOf(9)).relevance).toBe("MANDATORY");
    await prisma.company.update({ where: { id: companyId }, data: { businessModel: "DISTRIBUTOR" } });
    expect((await relevanceOf(9)).relevance).toBe("OPTIONAL");
    await prisma.company.update({ where: { id: companyId }, data: { businessModel: "MANUFACTURER" } });
  });

  it("refuses to answer for a company the caller doesn't own", async () => {
    await expect(getScope3RelevanceForCompany("some-other-user-id", companyId)).rejects.toMatchObject({
      message: "Company not found",
    });
  });
});
