import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../../config/prisma";
import { getGreenSteelAssessment, getGreenSteelAssessmentById } from "../greenSteel.service";
import { generateGreenSteelPdf } from "../greenSteelReport/build";

/**
 * End to end: a steel facility with submitted activity data through to a
 * generated summary, plus the case that must NOT produce one.
 *
 * The non-steel path is tested as hard as the steel one. A star rating shown
 * against a cement facility's intensity would be a meaningless number wearing
 * a regulatory badge, which is worse than an empty card.
 */

const PERIOD = "FY2025-26";
const suffix = Date.now();

let steelUserId: string;
let steelFacilityId: string;
let cementUserId: string;
let cementFacilityId: string;

/** One company + facility + a CBAM subscription, in the given sector. */
const makeClient = async (label: string, sector: "STEEL" | "CEMENT") => {
  const user = await prisma.user.create({
    data: {
      name: label,
      email: `${label}-${suffix}@example.test`,
      passwordHash: "x",
      approvalStatus: "APPROVED",
    },
  });
  const company = await prisma.company.create({
    data: { name: `${label} Ltd`, ownerId: user.id, sector, reportingFyStartMonth: 4 },
  });
  await prisma.subscription.create({
    data: { companyId: company.id, tier: "CBAM_COMPLIANCE", status: "ACTIVE" },
  });
  const facility = await prisma.facility.create({
    data: { name: `${label} plant`, companyId: company.id, isDraft: false },
  });
  return { userId: user.id, companyId: company.id, facilityId: facility.id };
};

/**
 * A submitted entry with a calculation result. `totalEmissionsCbamAr5` is the
 * number the module reuses, so it is set directly rather than run through the
 * calculation engine — this test is about the taxonomy layer, not the engine.
 */
const addEntry = async (
  facilityId: string,
  productionTonnes: number,
  totalEmissions: number,
  sector: "STEEL" | "CEMENT" = "STEEL",
) => {
  const entry = await prisma.activityData.create({
    data: {
      facilityId,
      sector,
      status: "SUBMITTED",
      productionQuantityT: productionTonnes,
      periodStart: new Date("2025-06-01"),
      periodEnd: new Date("2025-06-30"),
    },
  });
  await prisma.emissionCalculationResult.create({
    data: {
      activityDataId: entry.id,
      directCombustionCo2eAr5: 0,
      directCombustionCo2eAr2Bur3: 0,
      directProcessCo2e: 0,
      directPrecursorCo2e: 0,
      indirectElectricityCo2e: 0,
      indirectSteamCo2e: 0,
      totalDirectCo2eAr5: 0,
      totalDirectCo2eAr2Bur3: 0,
      totalEmissionsCbamAr5: totalEmissions,
      totalEmissionsCctsAr2Bur3: totalEmissions,
      specificEmbeddedEmissionsCbam: totalEmissions / productionTonnes,
      ghgIntensityCcts: totalEmissions / productionTonnes,
      gridEmissionFactorUsed: 0.716,
      breakdown: {},
    },
  });
  return entry;
};

beforeAll(async () => {
  const steel = await makeClient(`gs-steel-${suffix}`, "STEEL");
  steelUserId = steel.userId;
  steelFacilityId = steel.facilityId;
  // 1000 t at 1800 tCO2e -> 1.8 tCO2e/t, squarely four-star.
  await addEntry(steel.facilityId, 1000, 1800);

  const cement = await makeClient(`gs-cement-${suffix}`, "CEMENT");
  cementUserId = cement.userId;
  cementFacilityId = cement.facilityId;
  await addEntry(cement.facilityId, 1000, 600, "CEMENT");
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("green steel assessment — steel facility", () => {
  it("aggregates submitted activity data into an intensity and a band", async () => {
    const result = await getGreenSteelAssessment(steelUserId, steelFacilityId, PERIOD);
    expect(result.applicable).toBe(true);
    if (!result.applicable) return;

    expect(result.figures).not.toBeNull();
    expect(result.figures!.productionTonnes).toBe(1000);
    expect(result.figures!.totalEmissionsTco2e).toBe(1800);
    expect(result.figures!.emissionIntensity).toBeCloseTo(1.8, 4);
    expect(result.rating!.stars).toBe(4);
    expect(result.rating!.qualifiesAsGreen).toBe(true);
  });

  /** Production-weighted, not a mean of per-entry intensities. */
  it("weights by production when several entries exist", async () => {
    const extra = await makeClient(`gs-weight-${suffix}`, "STEEL");
    // 100 t at 1.0, then 900 t at 2.1 -> 2010/1000 = 2.01, three-star.
    // A naive mean of the two intensities would give 1.55 and read five-star.
    await addEntry(extra.facilityId, 100, 100);
    await addEntry(extra.facilityId, 900, 1910);

    const result = await getGreenSteelAssessment(extra.userId, extra.facilityId, PERIOD);
    if (!result.applicable) throw new Error("expected applicable");
    expect(result.figures!.emissionIntensity).toBeCloseTo(2.01, 3);
    expect(result.rating!.stars).toBe(3);
  });

  it("persists a snapshot that the PDF route can load", async () => {
    const result = await getGreenSteelAssessment(steelUserId, steelFacilityId, PERIOD);
    if (!result.applicable) throw new Error("expected applicable");
    expect(result.assessmentId).toBeTruthy();

    const stored = await getGreenSteelAssessmentById(steelUserId, result.assessmentId!);
    expect(stored.emissionIntensity).toBeCloseTo(1.8, 4);
    expect(stored.starRating).toBe(4);
  });

  it("carries the NISST notice on the response", async () => {
    const result = await getGreenSteelAssessment(steelUserId, steelFacilityId, PERIOD);
    if (!result.applicable) throw new Error("expected applicable");
    expect(result.certificationNotice).toMatch(/NISST/);
    expect(result.certificationNotice).toMatch(/does not itself certify/i);
  });

  it("generates a PDF without erroring", async () => {
    const result = await getGreenSteelAssessment(steelUserId, steelFacilityId, PERIOD);
    if (!result.applicable) throw new Error("expected applicable");
    const stored = await getGreenSteelAssessmentById(steelUserId, result.assessmentId!);

    const doc = generateGreenSteelPdf(stored, stored.facility);
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () => resolve());
      doc.on("error", reject);
      doc.end();
    });
    const pdf = Buffer.concat(chunks);
    expect(pdf.length).toBeGreaterThan(1000);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  });
});

describe("green steel assessment — NOT a steel facility", () => {
  /**
   * The explicit requirement: the module must not apply for a non-steel
   * client. It returns applicable:false rather than throwing so the dashboard
   * can simply not render the card.
   */
  it("does not apply to a cement account", async () => {
    const result = await getGreenSteelAssessment(cementUserId, cementFacilityId, PERIOD);
    expect(result.applicable).toBe(false);
    if (result.applicable) return;
    expect(result.sector).toBe("CEMENT");
    expect(result.reason).toMatch(/steel/i);
  });

  /** No figures, no rating and no stored row for a sector out of scope. */
  it("computes nothing and stores nothing for a cement account", async () => {
    await getGreenSteelAssessment(cementUserId, cementFacilityId, PERIOD);
    const rows = await prisma.greenSteelAssessment.count({ where: { facilityId: cementFacilityId } });
    expect(rows).toBe(0);
  });

  /**
   * A cement account has real emissions and real tonnes, so the arithmetic
   * would succeed and produce a flattering number — 0.6 tCO2e/t would render
   * as five-star. Refusing is the whole point.
   */
  it("refuses even though the arithmetic would have produced a five-star number", async () => {
    const result = await getGreenSteelAssessment(cementUserId, cementFacilityId, PERIOD);
    expect(result.applicable).toBe(false);
    expect(JSON.stringify(result)).not.toMatch(/star/i);
  });
});
