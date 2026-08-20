import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { saveMaterialityAssessment, saveGriData, getGriReportContextById } from "../gri.service";
import { buildGriPdf } from "../griReport/build";
import { GRI_UNIVERSAL_DISCLOSURES, GRI_3_3_REQUIREMENTS, GRI_TOPIC_STANDARDS } from "../../data/griStandards";

/**
 * End-to-end: a real facility with real activity data, through the materiality
 * assessment and disclosure entry, to a generated PDF — checking that the
 * content index describes what the report actually contains.
 *
 * The property under test is the one a GRI content index exists to guarantee:
 * every material topic appears, every excluded topic does not, every omission
 * carries a permitted reason, and every page reference points at a page the
 * document really has. A content index that disagrees with its own report is
 * a failed compliance claim, and nothing else in the suite would catch it.
 */

const PERIOD = "FY2025-26";
const suffix = Date.now();

let userId: string;
let companyId: string;
let facilityId: string;
let reportId: string;

const MATERIAL = ["GRI_305", "GRI_303", "GRI_403", "GRI_404"];

const UNIVERSAL_FIELD_TYPES = new Map(
  Prisma.dmmf.datamodel.models
    .find((m) => m.name === "GriUniversalDisclosures")!
    .fields.map((f) => [f.name, f.type]),
);

const sampleValueFor = (field: string): unknown => {
  switch (UNIVERSAL_FIELD_TYPES.get(field)) {
    case "Int":
    case "Float":
      return 12;
    case "Boolean":
      return false;
    case "DateTime":
      return new Date();
    default:
      return "Disclosed for this reporting period.";
  }
};

beforeAll(async () => {
  const user = await prisma.user.create({
    data: {
      name: "GRI E2E",
      email: `gri-e2e-${suffix}@example.com`,
      passwordHash: "x",
      approvalStatus: "APPROVED",
    },
  });
  userId = user.id;

  const company = await prisma.company.create({
    data: {
      ownerId: userId,
      name: `Northwind Steel ${suffix}`,
      sector: "STEEL",
      city: "Pune",
      state: "Maharashtra",
      country: "India",
      annualTurnoverInr: 4_500_000_000,
      reportingFyStartMonth: 4,
    },
  });
  companyId = company.id;

  await prisma.subscription.create({ data: { companyId, tier: "BRSR_CORE_REPORTING", status: "ACTIVE" } });

  const facility = await prisma.facility.create({
    data: { companyId, name: "Chakan Works", facilityType: "EAF_MINI_MILL", isDraft: false },
  });
  facilityId = facility.id;

  // Real activity data, so the derived figures come from the actual engine
  // rather than being asserted against fixtures of themselves.
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
    stakeholderGroups: ["Employees", "Local communities", "Customers", "Regulators", "Investors"],
    stakeholderEngagementApproach: "Quarterly works-council meetings and an annual community forum.",
    impactIdentificationProcess: "Cross-functional workshop, review of environmental clearances, stakeholder interviews.",
    prioritisationProcess: "Scored by the sustainability committee and validated with plant leadership.",
    materialityThreshold: 3,
    complete: true,
    impacts: [
      {
        topicCode: "GRI_305",
        description: "GHG emissions from electric arc furnace operation and purchased grid electricity",
        impactType: "NEGATIVE_ACTUAL",
        valueChainLocation: "OWN_OPERATIONS",
        scale: 5,
        scope: 5,
        irremediability: 4,
      },
      {
        topicCode: "GRI_303",
        description: "Freshwater withdrawal in a seasonally water-stressed district",
        impactType: "NEGATIVE_ACTUAL",
        valueChainLocation: "OWN_OPERATIONS",
        scale: 4,
        scope: 4,
        irremediability: 3,
      },
      {
        topicCode: "GRI_403",
        description: "Risk of heat and molten-metal injury to furnace operators",
        impactType: "NEGATIVE_POTENTIAL",
        valueChainLocation: "OWN_OPERATIONS",
        scale: 5,
        scope: 3,
        irremediability: 5,
        likelihood: 3,
      },
      {
        topicCode: "GRI_404",
        description: "Skills development raising local technical employability",
        impactType: "POSITIVE_ACTUAL",
        valueChainLocation: "OWN_OPERATIONS",
        scale: 3,
        scope: 3,
      },
      // Deliberately below threshold.
      {
        topicCode: "GRI_418",
        description: "Limited customer personal data held; B2B contracts only",
        impactType: "NEGATIVE_POTENTIAL",
        valueChainLocation: "DOWNSTREAM",
        scale: 2,
        scope: 1,
        irremediability: 1,
        likelihood: 1,
      },
    ],
  } as never);

  await saveGriData(
    userId,
    facilityId,
    {
      reportingPeriod: PERIOD,
      turnoverInr: 4_500_000_000,
      notes: "First GRI reporting cycle for this facility.",
      universal: Object.fromEntries(
        GRI_UNIVERSAL_DISCLOSURES.flatMap((d) => d.fields.map((f) => [f, sampleValueFor(f)])),
      ),
      materialTopics: MATERIAL.map((topicCode) => ({
        topicCode,
        isMaterial: true,
        ...Object.fromEntries(GRI_3_3_REQUIREMENTS.map((r) => [r.field, `Stated for ${topicCode}.`])),
      })),
      topics: {
        GRI_305: {
          scope2MarketBasedTco2e: 4_100,
          baseYear: 2022,
          gasesIncluded: "CO2, CH4, N2O",
          consolidationApproach: "Operational control",
          intensityDenominatorDescription: "Tonnes of crude steel produced",
          reductionTco2e: 1_417,
          noxTonnes: 18.4,
          // 305-6 (ODS) deliberately left blank so a real omission is exercised.
        },
        GRI_303: {
          interactionsNarrative: "Municipal and recycled supply; discharge to a common effluent treatment plant.",
          dischargeImpactManagement: "Treated on site before transfer.",
          withdrawalWaterStressedMl: 48,
          dischargeWaterStressedMl: 21,
          consumptionWaterStressedMl: 27,
        },
        GRI_403: {
          managementSystemDescription: "OHS management system covering employees and contractors.",
          managementSystemIsIso45001: true,
          hazardIdentificationProcess: "Job hazard analysis on every task.",
          occupationalHealthServices: "On-site occupational health centre.",
          workerParticipation: "Joint management-worker safety committee.",
          workerOhsTraining: "Induction plus 16 hours refresher a year.",
          workerHealthPromotion: "Annual health checks.",
          businessRelationshipOhsImpacts: "Contractors audited to the same standard.",
          workersCoveredCount: 820,
          workersCoveredPct: 100,
          hoursWorked: 1_640_000,
          rateBasisHours: 200_000,
          fatalitiesEmployees: 0,
          recordableInjuriesEmployees: 9,
          recordableInjuriesNonEmployees: 3,
          highConsequenceInjuriesEmployees: 1,
          illHealthCasesEmployees: 2,
        },
        GRI_404: {
          avgTrainingHoursPerEmployee: 24.5,
          skillsProgramsDescription: "Apprenticeship scheme with the local ITI.",
          performanceReviewPct: 94,
        },
      },
    } as never,
    true,
  );

  reportId = (await prisma.griReport.findFirstOrThrow({ where: { facilityId, reportingPeriod: PERIOD } })).id;
});

afterAll(async () => {
  await prisma.scope3Data.deleteMany({ where: { facilityId } });
  await prisma.subscription.deleteMany({ where: { companyId } });
  await prisma.company.deleteMany({ where: { id: companyId } });
  await prisma.user.deleteMany({ where: { id: userId } });
});

describe("GRI end-to-end — derived figures come from the existing engines", () => {
  it("reuses Scope 1 and 2 on the AR5 basis GRI 305 follows, not the AR2/BUR3 basis BRSR uses", async () => {
    const { metrics } = await getGriReportContextById(userId, reportId);
    // AR5 columns: totalDirectCo2eAr5 = 4000, electricity 4320 + steam 63.
    // The AR2/BUR3 total (3950) must NOT appear.
    expect(metrics.ghg.scope1Co2e).toBe(4_000);
    expect(metrics.ghg.scope2LocationBasedCo2e).toBe(4_383);
  });

  it("rolls up Scope 3 from submitted value-chain entries", async () => {
    const { metrics } = await getGriReportContextById(userId, reportId);
    expect(metrics.ghg.scope3Co2e).toBe(1_314);
    expect(metrics.ghg.scope3CategoryCount).toBe(1);
  });

  it("converts the ISO 14046 water inventory from cubic metres to megalitres", async () => {
    const { metrics } = await getGriReportContextById(userId, reportId);
    // 60,000 m3 withdrawn, 25,000 discharged -> 60 ML and 25 ML.
    expect(metrics.water.withdrawalTotalMl).toBe(60);
    expect(metrics.water.dischargeTotalMl).toBe(25);
    // Consumption is derived, never stored, so the three always reconcile.
    expect(metrics.water.consumptionTotalMl).toBe(35);
  });

  it("derives GRI 403-9 injury rates from counts and hours worked", async () => {
    const { metrics } = await getGriReportContextById(userId, reportId);
    expect(metrics.safety.recordableInjuryRate).toBe(1.463);
    expect(metrics.safety.rateBasisHours).toBe(200_000);
  });

  it("computes intensity ratios against production and turnover", async () => {
    const { metrics } = await getGriReportContextById(userId, reportId);
    expect(metrics.intensity.emissionsPerTonneProduct).toBeCloseTo(0.698583, 5);
    expect(metrics.intensity.energyPerTonneProduct).toBeCloseTo(2.1, 5);
  });
});

describe("GRI end-to-end — the content index matches the report", () => {
  it("claims in accordance once every requirement is met", async () => {
    const { metrics, contentIndex } = await getGriReportContextById(userId, reportId);
    expect(metrics.accordance.blockers).toEqual([]);
    expect(contentIndex.claimLevel).toBe("IN_ACCORDANCE");
  });

  it("covers exactly the material topics, and no excluded topic", async () => {
    const { contentIndex } = await getGriReportContextById(userId, reportId);
    const indexed = new Set(contentIndex.entries.filter((e) => e.topicCode).map((e) => e.topicCode));
    expect([...indexed].sort()).toEqual([...MATERIAL].sort());
    expect(indexed.has("GRI_418")).toBe(false);
  });

  it("lists every excluded topic with a rationale", async () => {
    const { contentIndex } = await getGriReportContextById(userId, reportId);
    expect(contentIndex.excludedTopics).toHaveLength(GRI_TOPIC_STANDARDS.length - MATERIAL.length);
    expect(contentIndex.excludedTopics.every((t) => t.rationale && t.rationale !== "No rationale stated.")).toBe(true);
  });

  it("lists all 30 GRI 2 disclosures", async () => {
    const { contentIndex } = await getGriReportContextById(userId, reportId);
    expect(contentIndex.entries.filter((e) => e.section === "UNIVERSAL")).toHaveLength(30);
  });

  it("records a permitted omission reason for the disclosure left blank", async () => {
    const { contentIndex } = await getGriReportContextById(userId, reportId);
    const ods = contentIndex.entries.find((e) => e.disclosureNumber === "305-6")!;
    expect(ods.reported).toBe(false);
    expect(ods.omissionReason).toBe("INFORMATION_UNAVAILABLE_INCOMPLETE");
  });
});

describe("GRI end-to-end — the generated PDF", () => {
  it("renders, and every content-index page reference points at a page it really has", async () => {
    const { report, facility, metrics, contentIndex, phase2 } = await getGriReportContextById(userId, reportId);

    const doc = await buildGriPdf(report, facility as never, metrics, contentIndex, phase2);
    const chunks: Buffer[] = [];
    const pdf = await new Promise<Buffer>((resolve, reject) => {
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
      doc.end();
    });

    expect(pdf.length).toBeGreaterThan(20_000);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");

    // Page references are stamped during rendering, so they only exist after
    // buildGriPdf has run. An unstamped entry means a section never rendered.
    const unpaged = contentIndex.entries.filter((e) => e.pageNumber == null);
    expect(unpaged.map((e) => e.disclosureNumber)).toEqual([]);

    // /Type /Pages is the page tree node; /Type /Page are the leaves.
    const pageCount = pdf.toString("latin1").split("/Type /Page").length - 1 - 1;
    const highestCited = Math.max(...contentIndex.entries.map((e) => e.pageNumber!));
    expect(highestCited).toBeLessThanOrEqual(pageCount);
  });

  it("groups each topic's disclosures onto the one page its section starts on", async () => {
    const { report, facility, metrics, contentIndex, phase2 } = await getGriReportContextById(userId, reportId);
    const doc = await buildGriPdf(report, facility as never, metrics, contentIndex, phase2);
    doc.end();

    for (const code of MATERIAL) {
      const pages = new Set(contentIndex.entries.filter((e) => e.topicCode === code).map((e) => e.pageNumber));
      expect(pages.size, `${code} disclosures cite more than one page`).toBe(1);
    }
  });
});
