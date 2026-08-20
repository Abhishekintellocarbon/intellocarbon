import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../../config/prisma";
import { saveMaterialityAssessment, saveCsrdData, getCsrdReportContextById } from "../csrd.service";
import { buildCsrdPdf } from "../csrdReport/build";
import { ESRS_2_DATAPOINTS, ESRS_STANDARDS, type EsrsDatapoint } from "../../data/esrsStandards";

/**
 * End-to-end: a real facility with real activity data, through the double
 * materiality assessment and datapoint entry, to a generated PDF — checking
 * that the ESRS disclosure index describes what the statement actually
 * contains.
 *
 * The properties worth protecting are the two-axis ones: a standard material
 * on financial grounds alone must be reportable, one below both thresholds
 * must be excluded with a rationale, and the conformity claim must stay at
 * "with reference" while the registry is unreconciled no matter how complete
 * the data entry is.
 */

const PERIOD = "FY2025-26";
const suffix = Date.now();

let userId: string;
let companyId: string;
let facilityId: string;
let reportId: string;

/** Material on impact, financial, and both — one of each, plus one below both thresholds. */
const IMPACT_ONLY = "ESRS_E1";
const FINANCIAL_ONLY = "ESRS_G1";
const BOTH_AXES = "ESRS_E3";
const BELOW_THRESHOLD = "ESRS_S4";
const MATERIAL = [IMPACT_ONLY, FINANCIAL_ONLY, BOTH_AXES];

const sampleFor = (d: EsrsDatapoint): unknown => {
  switch (d.type) {
    case "narrative":
      return "Reported for this period.";
    case "bool":
      return true;
    case "year":
      return 2024;
    case "pct":
      return 42;
    case "int":
      return 7;
    default:
      return 12.5;
  }
};

const payloadFor = (dps: EsrsDatapoint[]) =>
  Object.fromEntries(dps.filter((d) => !d.derived).map((d) => [d.field, sampleFor(d)]));

beforeAll(async () => {
  const user = await prisma.user.create({
    data: { name: "CSRD E2E", email: `csrd-e2e-${suffix}@example.com`, passwordHash: "x", approvalStatus: "APPROVED" },
  });
  userId = user.id;

  const company = await prisma.company.create({
    data: { ownerId: userId, name: `Northwind Steel ${suffix}`, sector: "STEEL", reportingFyStartMonth: 4 },
  });
  companyId = company.id;
  await prisma.subscription.create({ data: { companyId, tier: "BRSR_CORE_REPORTING", status: "ACTIVE" } });

  const facility = await prisma.facility.create({
    data: { companyId, name: "Chakan Works", facilityType: "EAF_MINI_MILL", isDraft: false },
  });
  facilityId = facility.id;

  const activity = await prisma.activityData.create({
    data: {
      facilityId,
      sector: "STEEL",
      periodStart: new Date(Date.UTC(2025, 5, 1)),
      periodEnd: new Date(Date.UTC(2025, 5, 30)),
      productionQuantityT: 12_000,
      gridElectricityMwh: 5_400,
      renewableElectricityMwh: 1_350,
      steamImportedGj: 900,
      status: "SUBMITTED",
      waterEntries: {
        create: [
          { sourceType: "MUNICIPAL", withdrawnM3: 48_000, dischargedM3: 21_000 },
          { sourceType: "RECYCLED", withdrawnM3: 12_000, dischargedM3: 4_000 },
        ],
      },
    },
  });

  await prisma.emissionCalculationResult.create({
    data: {
      activityDataId: activity.id,
      directCombustionCo2eAr5: 3_100,
      directCombustionCo2eAr2Bur3: 3_050,
      directProcessCo2e: 900,
      directPrecursorCo2e: 0,
      indirectElectricityCo2e: 4_320,
      indirectSteamCo2e: 63,
      totalDirectCo2eAr5: 4_000,
      totalDirectCo2eAr2Bur3: 3_950,
      totalEmissionsCbamAr5: 8_383,
      totalEmissionsCctsAr2Bur3: 8_333,
      specificEmbeddedEmissionsCbam: 0.6986,
      ghgIntensityCcts: 0.6944,
      gridEmissionFactorUsed: 0.8,
      breakdown: {},
    },
  });

  await prisma.scope3Data.create({
    data: {
      companyId,
      facilityId,
      reportingPeriod: PERIOD,
      category: "CAT1_PURCHASED_GOODS_SERVICES",
      calculationMethod: "ACTIVITY_BASED",
      inputData: { materialType: "STEEL", quantityKg: 900_000 },
      calculatedEmissionsTco2e: 1_314,
      emissionFactorSource: "Test fixture",
      status: "SUBMITTED",
    },
  });

  await saveMaterialityAssessment(userId, facilityId, {
    reportingPeriod: PERIOD,
    stakeholderGroups: ["Employees", "Local communities", "Investors"],
    engagementApproach: "Works council, community forum and investor briefings.",
    iroIdentificationProcess: "Cross-functional workshop against the ESRS topic list, with value-chain mapping.",
    prioritisationProcess: "Scored by the sustainability committee and reviewed with the CFO for financial effects.",
    impactThreshold: 3,
    financialThreshold: 3,
    complete: true,
    iros: [
      // Impact-only: severe outward impact, no financial score at all.
      {
        standardCode: IMPACT_ONLY,
        description: "GHG emissions from electric arc furnace operation",
        kind: "IMPACT",
        valueChainLocation: "OWN_OPERATIONS",
        impactType: "NEGATIVE_ACTUAL",
        scale: 5,
        scope: 5,
        irremediability: 4,
      },
      // Financial-only: no outward impact scored, but a material financial risk.
      {
        standardCode: FINANCIAL_ONLY,
        description: "Exposure to anti-bribery enforcement in export markets",
        kind: "FINANCIAL",
        valueChainLocation: "DOWNSTREAM",
        financialEffectType: "RISK",
        magnitude: 4,
        financialLikelihood: 4,
      },
      // Both axes.
      {
        standardCode: BOTH_AXES,
        description: "Freshwater withdrawal in a seasonally water-stressed district",
        kind: "BOTH",
        valueChainLocation: "OWN_OPERATIONS",
        impactType: "NEGATIVE_ACTUAL",
        scale: 4,
        scope: 4,
        irremediability: 3,
        financialEffectType: "RISK",
        magnitude: 4,
        financialLikelihood: 3,
      },
      // Below both thresholds — must be excluded with a rationale.
      {
        standardCode: BELOW_THRESHOLD,
        description: "Limited direct consumer relationships; B2B contracts only",
        kind: "BOTH",
        valueChainLocation: "DOWNSTREAM",
        impactType: "NEGATIVE_POTENTIAL",
        scale: 2,
        scope: 1,
        irremediability: 1,
        impactLikelihood: 1,
        financialEffectType: "RISK",
        magnitude: 1,
        financialLikelihood: 1,
      },
    ],
  } as never);

  await saveCsrdData(
    userId,
    facilityId,
    {
      reportingPeriod: PERIOD,
      netRevenueEur: 50_000_000,
      general: payloadFor(ESRS_2_DATAPOINTS),
      materialTopics: MATERIAL.map((standardCode) => ({
        standardCode,
        isMaterial: true,
        policies: "Stated.",
        actions: "Stated.",
        targets: "Stated.",
        metrics: "Stated.",
      })),
      standards: Object.fromEntries(
        MATERIAL.map((code) => [code, payloadFor(ESRS_STANDARDS.find((s) => s.code === code)!.datapoints)]),
      ),
    } as never,
    true,
  );

  reportId = (await prisma.csrdReport.findFirstOrThrow({ where: { facilityId } })).id;
});

afterAll(async () => {
  await prisma.scope3Data.deleteMany({ where: { facilityId } });
  await prisma.subscription.deleteMany({ where: { companyId } });
  await prisma.company.deleteMany({ where: { id: companyId } });
  await prisma.user.deleteMany({ where: { id: userId } });
});

describe("double materiality — the two axes are independent", () => {
  it("makes a standard material on impact alone", async () => {
    const topic = await prisma.csrdMaterialTopic.findFirstOrThrow({
      where: { csrdReport: { facilityId }, standardCode: IMPACT_ONLY },
    });
    expect(topic.isMaterial).toBe(true);
    expect(topic.impactMaterial).toBe(true);
    expect(topic.financialMaterial).toBe(false);
    expect(topic.financialScore).toBeNull();
  });

  // The case a single-axis design would silently drop.
  it("makes a standard material on financial grounds alone, with no impact score", async () => {
    const topic = await prisma.csrdMaterialTopic.findFirstOrThrow({
      where: { csrdReport: { facilityId }, standardCode: FINANCIAL_ONLY },
    });
    expect(topic.isMaterial).toBe(true);
    expect(topic.financialMaterial).toBe(true);
    expect(topic.impactMaterial).toBe(false);
    expect(topic.impactScore).toBeNull();
  });

  it("records both axes when a matter qualifies on both", async () => {
    const topic = await prisma.csrdMaterialTopic.findFirstOrThrow({
      where: { csrdReport: { facilityId }, standardCode: BOTH_AXES },
    });
    expect(topic.impactMaterial).toBe(true);
    expect(topic.financialMaterial).toBe(true);
  });

  it("excludes a standard below both thresholds, with a rationale naming both", async () => {
    const topic = await prisma.csrdMaterialTopic.findFirstOrThrow({
      where: { csrdReport: { facilityId }, standardCode: BELOW_THRESHOLD },
    });
    expect(topic.isMaterial).toBe(false);
    expect(topic.notMaterialRationale).toContain("impact materiality");
    expect(topic.notMaterialRationale).toContain("financial materiality");
  });

  it("writes a record for every ESRS standard, material or not", async () => {
    const topics = await prisma.csrdMaterialTopic.findMany({ where: { csrdReport: { facilityId } } });
    expect(topics).toHaveLength(ESRS_STANDARDS.length);
    expect(topics.filter((t) => !t.isMaterial).every((t) => t.notMaterialRationale)).toBe(true);
  });

  // Sent with resubmit intent, because the fixture has already submitted and
  // the draft guard would otherwise fire first. That ordering is correct — a
  // submitted statement refuses silent edits before it considers anything
  // else — but it is not the property under test here.
  it("rejects datapoints for a standard assessed as not material", async () => {
    await expect(
      saveCsrdData(
        userId,
        facilityId,
        { reportingPeriod: PERIOD, standards: { [BELOW_THRESHOLD]: { consumerComplaints: 3 } } } as never,
        true,
      ),
    ).rejects.toMatchObject({ code: "CSRD_STANDARD_NOT_MATERIAL" });

    const row = await prisma.csrdConsumersDisclosure.findFirst({ where: { csrdReport: { facilityId } } });
    expect(row).toBeNull();
  });

  it("refuses a silent draft edit to a submitted statement", async () => {
    await expect(
      saveCsrdData(userId, facilityId, { reportingPeriod: PERIOD } as never, false),
    ).rejects.toMatchObject({ code: "CSRD_REPORT_NOT_DRAFT" });
  });
});

describe("derived figures come from the existing engines", () => {
  it("reuses Scope 1/2 on the AR5 basis ESRS follows", async () => {
    const { metrics } = await getCsrdReportContextById(userId, reportId);
    expect(metrics.rollup.scope1Tco2e).toBe(4_000);
    expect(metrics.rollup.scope2LocationTco2e).toBe(4_383);
    expect(metrics.rollup.scope3Tco2e).toBe(1_314);
  });

  it("states energy in MWh, converting imported steam from GJ", async () => {
    const { metrics } = await getCsrdReportContextById(userId, reportId);
    // 5,400 + 1,350 MWh electricity + 900 GJ / 3.6 = 7,000 MWh
    expect(metrics.rollup.totalEnergyMwh).toBe(7_000);
  });

  it("states water in cubic metres, with consumption derived", async () => {
    const { metrics } = await getCsrdReportContextById(userId, reportId);
    expect(metrics.rollup.waterWithdrawalM3).toBe(60_000);
    expect(metrics.rollup.waterDischargeM3).toBe(25_000);
    expect(metrics.rollup.waterConsumptionM3).toBe(35_000);
  });

  it("computes intensities per euro of net revenue", async () => {
    const { metrics } = await getCsrdReportContextById(userId, reportId);
    expect(metrics.intensities.ghgPerRevenue).toBeCloseTo(9_697 / 50_000_000, 10);
  });
});

describe("the conformity claim cannot outrun the registry", () => {
  /**
   * The load-bearing test for this whole module. Every customer-side
   * requirement is satisfied by the fixture above, so the ONLY thing standing
   * between this statement and a conformity claim is that the datapoint
   * definitions have not been reconciled with the adopted ESRS (2026) text.
   * If this ever passes as conformant while the registry is unreconciled, the
   * platform is making a compliance claim on the customer's behalf that
   * nobody checked.
   */
  it("stays at 'prepared with reference' while any datapoint is unreconciled", async () => {
    const { metrics, disclosureIndex } = await getCsrdReportContextById(userId, reportId);

    expect(metrics.conformity.registryReconciled).toBe(false);
    expect(metrics.conformity.conformant).toBe(false);
    expect(disclosureIndex.claimLevel).toBe("PREPARED_WITH_REFERENCE");
    expect(disclosureIndex.claimStatement).toContain("must not be filed");
  });

  it("reports the reconciliation gap separately from the preparer's own gaps", async () => {
    const { metrics } = await getCsrdReportContextById(userId, reportId);
    const registryBlocker = metrics.conformity.blockers.find((b) => b.includes("not yet reconciled"));
    expect(registryBlocker).toBeDefined();
    // Everything the preparer controls is complete, so that is the only blocker.
    expect(metrics.conformity.blockers).toHaveLength(1);
    expect(metrics.conformity.generalDisclosuresReported).toBe(
      metrics.conformity.generalDisclosuresTotal,
    );
  });
});

describe("the disclosure index matches the statement", () => {
  it("covers exactly the material standards, and no excluded one", async () => {
    const { disclosureIndex } = await getCsrdReportContextById(userId, reportId);
    const covered = new Set(disclosureIndex.entries.filter((e) => e.standardCode).map((e) => e.standardCode));
    expect([...covered].sort()).toEqual([...MATERIAL].sort());
    expect(covered.has(BELOW_THRESHOLD)).toBe(false);
  });

  it("lists every excluded standard with a rationale", async () => {
    const { disclosureIndex } = await getCsrdReportContextById(userId, reportId);
    expect(disclosureIndex.excludedStandards).toHaveLength(ESRS_STANDARDS.length - MATERIAL.length);
    expect(disclosureIndex.excludedStandards.every((s) => s.rationale !== "No rationale stated.")).toBe(true);
  });

  it("marks phase-in datapoints as phase-in relief rather than unavailable", async () => {
    const { disclosureIndex } = await getCsrdReportContextById(userId, reportId);
    // Every stored datapoint was filled, so any omission left must be a
    // derived one that did not resolve — never a mislabelled phase-in.
    const phaseInEntries = disclosureIndex.entries.filter((e) => e.phaseIn && !e.reported);
    expect(phaseInEntries.every((e) => e.omissionReason === "PHASE_IN_RELIEF")).toBe(true);
  });

  it("flags every datapoint's reconciliation status", async () => {
    const { disclosureIndex } = await getCsrdReportContextById(userId, reportId);
    expect(disclosureIndex.entries.every((e) => e.status === "PENDING_SOURCE")).toBe(true);
    expect(disclosureIndex.confirmedDatapoints).toBe(0);
  });
});

describe("the generated PDF", () => {
  it("renders, and every index entry cites a page the document has", async () => {
    const { report, facility, metrics, disclosureIndex, phase2 } = await getCsrdReportContextById(userId, reportId);

    const doc = await buildCsrdPdf(report, facility as never, metrics, disclosureIndex, phase2);
    const chunks: Buffer[] = [];
    const pdf = await new Promise<Buffer>((resolve, reject) => {
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
      doc.end();
    });

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(20_000);

    const unpaged = disclosureIndex.entries.filter((e) => e.pageNumber == null);
    expect(unpaged.map((e) => e.code)).toEqual([]);

    const pageCount = pdf.toString("latin1").split("/Type /Page").length - 2;
    expect(Math.max(...disclosureIndex.entries.map((e) => e.pageNumber!))).toBeLessThanOrEqual(pageCount);
  });
});
