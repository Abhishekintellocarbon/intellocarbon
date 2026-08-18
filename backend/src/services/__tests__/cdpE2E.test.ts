import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../../config/prisma";
import { saveCdpData, getCdpReportContextById, getCdpDraft } from "../cdp.service";
import { buildCdpPdf } from "../cdpReport/build";
import { CDP_MODULES, getCdpModule, type CdpQuestion } from "../../data/cdpQuestionnaire";
import { cdpDataSchema } from "../../validators/cdp.validators";

/**
 * End-to-end: a real facility with real activity data, through CDP module
 * entry, to a generated PDF — checking that the response index describes what
 * the pack actually contains.
 *
 * The properties worth protecting here are the ones specific to CDP. Figures
 * must be reused from the existing engines rather than re-keyed. The readiness
 * bands must reflect the evidence actually present, not just the boxes filled.
 * And nothing anywhere may present the pack as a CDP submission or as carrying
 * a CDP score.
 */

const PERIOD = "FY2025-26";
const suffix = Date.now();

let userId: string;
let companyId: string;
let facilityId: string;
let reportId: string;

const sampleFor = (question: CdpQuestion): unknown => {
  switch (question.type) {
    case "narrative":
      return "Answered substantively for this reporting period.";
    case "bool":
      return true;
    case "select":
      return question.options![0].value;
    case "year":
      return 2020;
    case "pct":
      return 42;
    case "int":
      return 7;
    default:
      return 12.5;
  }
};

const payloadFor = (moduleCode: string, overrides: Record<string, unknown> = {}) => ({
  ...Object.fromEntries(
    getCdpModule(moduleCode)!
      .questions.filter((question) => !question.derived)
      .map((question) => [question.field, sampleFor(question)]),
  ),
  ...overrides,
});

beforeAll(async () => {
  const user = await prisma.user.create({
    data: { name: "CDP E2E", email: `cdp-e2e-${suffix}@example.com`, passwordHash: "x", approvalStatus: "APPROVED" },
  });
  userId = user.id;

  const company = await prisma.company.create({
    data: {
      ownerId: userId,
      name: `Southwind Steel ${suffix}`,
      sector: "STEEL",
      reportingFyStartMonth: 4,
      appliesCbam: true,
      appliesCcts: true,
      cbamFrameworks: ["EU_CBAM"],
    },
  });
  companyId = company.id;
  await prisma.subscription.create({ data: { companyId, tier: "BRSR_CORE_REPORTING", status: "ACTIVE" } });

  const facility = await prisma.facility.create({
    data: { companyId, name: "Pune Works", facilityType: "EAF_MINI_MILL", isDraft: false },
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
      carbonPricePaidEurPerTonne: 42.5,
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

  // Two Scope 3 categories, so the C6.5 per-category breakdown has something
  // to order and the total is not just a passthrough of one row.
  await prisma.scope3Data.createMany({
    data: [
      {
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
      {
        companyId,
        facilityId,
        reportingPeriod: PERIOD,
        category: "CAT6_BUSINESS_TRAVEL",
        calculationMethod: "ACTIVITY_BASED",
        inputData: { mode: "AIR", passengerKm: 400_000 },
        calculatedEmissionsTco2e: 86,
        emissionFactorSource: "Test fixture",
        status: "SUBMITTED",
      },
    ],
  });

  await prisma.voluntaryOffsetPurchase.create({
    data: {
      facilityId,
      companyId,
      registry: "VERRA",
      creditSerialNumber: `TEST-${suffix}`,
      tonnageTco2e: 500,
      category: "REMOVAL_NATURE",
      vintageYear: 2024,
      purchaseDate: new Date(Date.UTC(2025, 8, 1)),
      status: "SUBMITTED",
    },
  });

  await saveCdpData(
    userId,
    facilityId,
    {
      reportingPeriod: PERIOD,
      revenue: 500_000_000,
      modules: Object.fromEntries(
        CDP_MODULES.map((m) => {
          // C10 is deliberately left unverified so the verification cap has a
          // subject; everything else is answered in full.
          if (m.code === "C10") {
            return [m.code, payloadFor(m.code, { scope1Assurance: "NONE", scope2Assurance: "NONE" })];
          }
          if (m.code === "C4") return [m.code, payloadFor(m.code, { targetType: "ABSOLUTE", sbtiValidated: true })];
          return [m.code, payloadFor(m.code)];
        }),
      ),
      risks: [
        {
          kind: "RISK",
          riskType: "Transition — policy and legal",
          description: "EU CBAM definitive-period certificate cost on exported billets",
          valueChainStage: "Downstream",
          timeHorizon: "SHORT_TERM",
          likelihood: "Very likely",
          magnitude: "High",
          financialImpactMin: 4_000_000,
          financialImpactMax: 9_000_000,
          impactDescription: "Certificate surrender against embedded emissions on EU-bound tonnage.",
          responseStrategy: "Scrap-route share increase and verified emissions data to avoid default values.",
          responseCost: 1_200_000,
        },
        {
          kind: "OPPORTUNITY",
          riskType: "Market — low-carbon products",
          description: "Premium for low-embedded-carbon steel with EU buyers",
          valueChainStage: "Downstream",
          timeHorizon: "MEDIUM_TERM",
          likelihood: "Likely",
          magnitude: "Medium",
          financialImpactMin: 2_000_000,
          impactDescription: "Buyers tendering with embedded-carbon ceilings.",
          responseStrategy: "Third-party verified product carbon footprints.",
        },
      ],
      targets: [
        {
          kind: "ABSOLUTE",
          scopesCovered: "Scope 1 + 2 (location-based)",
          baseYear: 2020,
          baseYearEmissionsTco2e: 11_000,
          targetYear: 2030,
          reductionPct: 42,
          percentAchieved: 18,
          isScienceBased: true,
          description: "SBTi-validated near-term target.",
        },
        {
          kind: "INTENSITY",
          scopesCovered: "Scope 1 + 2",
          baseYear: 2020,
          targetYear: 2030,
          intensityMetric: "tCO2e per tonne of crude steel",
          baseYearIntensity: 0.92,
          targetIntensity: 0.53,
          isScienceBased: false,
        },
      ],
      breakdownRows: [
        { dimension: "GAS", scope: "SCOPE_1", label: "CO2", emissionsTco2e: 3_820 },
        { dimension: "GAS", scope: "SCOPE_1", label: "CH4", emissionsTco2e: 130 },
        { dimension: "GAS", scope: "SCOPE_1", label: "N2O", emissionsTco2e: 50 },
        { dimension: "COUNTRY", scope: "SCOPE_1", label: "India", emissionsTco2e: 4_000 },
        { dimension: "BUSINESS_DIVISION", scope: "SCOPE_2", label: "Long products", emissionsTco2e: 4_383 },
      ],
    } as never,
    true,
  );

  reportId = (await prisma.cdpReport.findFirstOrThrow({ where: { facilityId } })).id;
});

afterAll(async () => {
  await prisma.scope3Data.deleteMany({ where: { facilityId } });
  await prisma.voluntaryOffsetPurchase.deleteMany({ where: { facilityId } });
  await prisma.subscription.deleteMany({ where: { companyId } });
  await prisma.company.deleteMany({ where: { id: companyId } });
  await prisma.user.deleteMany({ where: { id: userId } });
});

describe("derived figures come from the existing engines", () => {
  it("reuses Scope 1/2 on the AR5 basis CDP expects, not the CCTS AR2/BUR3 figures", async () => {
    const { metrics } = await getCdpReportContextById(userId, reportId);
    expect(metrics.rollup.scope1Tco2e).toBe(4_000);
    expect(metrics.rollup.scope2LocationTco2e).toBe(4_383);
    expect(metrics.rollup.totalScope12Tco2e).toBe(8_383);
    // The AR2/BUR3 total on the same record is 3,950 — if that ever leaks
    // into a CDP response the figure is wrong for this framework.
    expect(metrics.rollup.scope1Tco2e).not.toBe(3_950);
  });

  it("splits Scope 3 by GHG Protocol category, ordered by category number", async () => {
    const { metrics } = await getCdpReportContextById(userId, reportId);
    expect(metrics.rollup.scope3Tco2e).toBe(1_400);
    expect(metrics.rollup.scope3ByCategory.map((c) => c.category)).toEqual([
      "CAT1_PURCHASED_GOODS_SERVICES",
      "CAT6_BUSINESS_TRAVEL",
    ]);
  });

  it("states energy in MWh, converting imported steam from GJ", async () => {
    const { metrics } = await getCdpReportContextById(userId, reportId);
    // 5,400 + 1,350 MWh purchased electricity + 900 GJ / 3.6 = 7,000 MWh
    expect(metrics.rollup.purchasedElectricityMwh).toBe(6_750);
    expect(metrics.rollup.purchasedSteamMwh).toBe(250);
    expect(metrics.rollup.totalEnergyMwh).toBe(7_000);
    // Rounded to two decimals by the rollup, as every other reported share is.
    expect(metrics.rollup.renewableSharePct).toBe(19.29);
  });

  it("computes C6.10 intensity from Scope 1 + 2 over revenue", async () => {
    const { metrics } = await getCdpReportContextById(userId, reportId);
    expect(metrics.intensityPerRevenue).toBeCloseTo(8_383 / 500_000_000, 12);
  });

  it("reuses cancelled offsets for C11.2a", async () => {
    const { metrics } = await getCdpReportContextById(userId, reportId);
    expect(metrics.rollup.carbonCreditsCancelledTco2e).toBe(500);
  });

  /**
   * The C11 bridge is a prompt, not an answer. It reports what the platform
   * observed and leaves C11.1 to the responder, because whether an operation
   * is actually regulated turns on entity-level facts the platform cannot see.
   */
  it("observes CBAM and CCTS exposure without asserting regulatory status", async () => {
    const { metrics } = await getCdpReportContextById(userId, reportId);
    const exposure = metrics.carbonPricingExposure;
    expect(exposure.appliesCbam).toBe(true);
    expect(exposure.appliesCcts).toBe(true);
    expect(exposure.carbonPricePaidEurPerTonne).toBe(42.5);
    expect(exposure.observedSystems.join(" ")).toMatch(/Carbon Border Adjustment Mechanism/);
    expect(exposure.observedSystems.join(" ")).toMatch(/Carbon Credit Trading Scheme/);
  });
});

describe("repeating blocks", () => {
  it("stores risks and opportunities in one block, distinguished by kind", async () => {
    const { report } = await getCdpReportContextById(userId, reportId);
    expect(report.risks.filter((r) => r.kind === "RISK")).toHaveLength(1);
    expect(report.risks.filter((r) => r.kind === "OPPORTUNITY")).toHaveLength(1);
  });

  it("stores both absolute and intensity targets, with the intensity denominator", async () => {
    const { report } = await getCdpReportContextById(userId, reportId);
    const intensity = report.targets.find((t) => t.kind === "INTENSITY")!;
    expect(intensity.intensityMetric).toBe("tCO2e per tonne of crude steel");
    expect(report.targets.find((t) => t.kind === "ABSOLUTE")!.isScienceBased).toBe(true);
  });

  /**
   * Target and risk rows are typed arrays on the request schema, so they are
   * validated once at the controller boundary and the service trusts them —
   * the same split GRI and CSRD use for their own repeating blocks. These
   * therefore exercise the schema, which is where the rule actually lives;
   * asserting against the service would only prove the service does not
   * re-validate, which is by design.
   */
  it("rejects an intensity target with no denominator", () => {
    const parsed = cdpDataSchema.safeParse({
      reportingPeriod: PERIOD,
      targets: [{ kind: "INTENSITY", scopesCovered: "Scope 1", baseYear: 2020, targetYear: 2030 }],
    });
    expect(parsed.success).toBe(false);
    expect(parsed.error!.issues[0].message).toMatch(/intensity target needs the metric/i);
  });

  it("rejects a target year at or before the base year", () => {
    const parsed = cdpDataSchema.safeParse({
      reportingPeriod: PERIOD,
      targets: [{ kind: "ABSOLUTE", scopesCovered: "Scope 1", baseYear: 2030, targetYear: 2030 }],
    });
    expect(parsed.success).toBe(false);
    expect(parsed.error!.issues[0].message).toMatch(/target year must be after the base year/i);
  });

  it("rejects a financial impact range whose minimum exceeds its maximum", () => {
    const parsed = cdpDataSchema.safeParse({
      reportingPeriod: PERIOD,
      risks: [
        {
          kind: "RISK",
          riskType: "Physical — acute",
          description: "Flooding at the works",
          financialImpactMin: 900,
          financialImpactMax: 100,
        },
      ],
    });
    expect(parsed.success).toBe(false);
    expect(parsed.error!.issues[0].message).toMatch(/cannot exceed the maximum/i);
  });

  /**
   * The partial-save rule the GRI and CSRD services were both fixed for. An
   * absent key means "not mentioned", not "delete everything" — a save that
   * touches one module must not wipe the risks entered on another screen.
   */
  it("does not wipe repeating blocks a partial save did not mention", async () => {
    await saveCdpData(
      userId,
      facilityId,
      { reportingPeriod: PERIOD, modules: { C1: { boardOversight: true } } } as never,
      true,
    );
    const { report } = await getCdpReportContextById(userId, reportId);
    expect(report.risks).toHaveLength(2);
    expect(report.targets).toHaveLength(2);
    expect(report.breakdownRows).toHaveLength(5);
    // And the scalar fields the partial save did not mention survive too.
    expect(report.revenue).toBe(500_000_000);
  });
});

describe("readiness reflects evidence, not just answers", () => {
  /**
   * The load-bearing test for this module. Every question in C10 is answered,
   * so a pure completeness measure would call it Strong. It reports no
   * third-party verification, which is exactly what CDP and requesting buyers
   * weight most heavily — so the band must be held down and the reason stated.
   */
  it("holds C10 at Developing when the emissions data is unverified, despite being fully answered", async () => {
    const { maturity } = await getCdpReportContextById(userId, reportId);
    const c10 = maturity.modules.find((m) => m.moduleCode === "C10")!;
    expect(c10.answered).toBe(c10.total);
    expect(c10.bandBeforeCaps).toBe("STRONG");
    expect(c10.band).toBe("DEVELOPING");
    expect(c10.evidenceGaps.join(" ")).toMatch(/third-party verification/i);
  });

  it("lets C4 reach Strong on a validated science-based target", async () => {
    const { maturity } = await getCdpReportContextById(userId, reportId);
    expect(maturity.modules.find((m) => m.moduleCode === "C4")!.band).toBe("STRONG");
  });

  it("lets C2 reach Strong once both risks and opportunities are listed", async () => {
    const { maturity } = await getCdpReportContextById(userId, reportId);
    expect(maturity.modules.find((m) => m.moduleCode === "C2")!.band).toBe("STRONG");
  });

  it("caps the overall band at the weakest started required module", async () => {
    const { maturity } = await getCdpReportContextById(userId, reportId);
    expect(maturity.overallBand).toBe("DEVELOPING");
    expect(maturity.completenessPct).toBeGreaterThan(90);
  });

  it("never expresses readiness on CDP's own A-to-D- scale", async () => {
    const { maturity } = await getCdpReportContextById(userId, reportId);
    const bands = maturity.modules.map((m) => m.band);
    expect(bands.every((b) => ["NOT_STARTED", "DEVELOPING", "ESTABLISHED", "STRONG"].includes(b))).toBe(true);
  });
});

describe("draft and submit", () => {
  it("refuses a silent draft edit to a response already marked complete", async () => {
    await expect(
      saveCdpData(userId, facilityId, { reportingPeriod: PERIOD } as never, false),
    ).rejects.toMatchObject({ code: "CDP_REPORT_NOT_DRAFT" });
  });

  it("rejects an unknown module code", async () => {
    await expect(
      saveCdpData(userId, facilityId, { reportingPeriod: PERIOD, modules: { C13: {} } } as never, true),
    ).rejects.toThrow(/Unknown CDP module/i);
  });

  /**
   * A response can only be marked complete once it says who is responding and
   * who signed it. Everything else is allowed to be thin: CDP accepts partial
   * responses and scores them accordingly, so refusing to save one would be
   * stricter than CDP and leave the responder with nothing to send.
   */
  it("requires an organization description and a signoff job title to mark complete", async () => {
    const otherFacility = await prisma.facility.create({
      data: { companyId, name: "Nashik Works", facilityType: "EAF_MINI_MILL", isDraft: false },
    });

    await expect(
      saveCdpData(userId, otherFacility.id, { reportingPeriod: PERIOD, modules: { C1: {} } } as never, true),
    ).rejects.toMatchObject({ code: "CDP_RESPONSE_INCOMPLETE" });

    // A thin but identifiable response is accepted — this is the case that
    // must NOT be blocked.
    await expect(
      saveCdpData(
        userId,
        otherFacility.id,
        {
          reportingPeriod: PERIOD,
          modules: {
            C0: { organizationDescription: "A steel re-rolling facility serving domestic construction." },
            C15: { submitterJobTitle: "Head of Sustainability" },
          },
        } as never,
        true,
      ),
    ).resolves.toBeTruthy();

    await prisma.facility.delete({ where: { id: otherFacility.id } });
  });

  it("returns a null report and no maturity before anything is entered", async () => {
    const fresh = await prisma.facility.create({
      data: { companyId, name: "Nagpur Works", facilityType: "EAF_MINI_MILL", isDraft: false },
    });
    const draft = await getCdpDraft(userId, fresh.id, PERIOD);
    expect(draft.report).toBeNull();
    expect(draft.maturity).toBeNull();
    await prisma.facility.delete({ where: { id: fresh.id } });
  });
});

describe("the response index matches the pack", () => {
  it("covers every question in every module, in questionnaire order", async () => {
    const { responseIndex } = await getCdpReportContextById(userId, reportId);
    expect(responseIndex.entries).toHaveLength(CDP_MODULES.reduce((sum, m) => sum + m.questions.length, 0));
    expect(responseIndex.entries.map((e) => e.moduleCode)).toEqual(
      CDP_MODULES.flatMap((m) => m.questions.map(() => m.code)),
    );
  });

  it("flags every question's reconciliation status as unconfirmed", async () => {
    const { responseIndex } = await getCdpReportContextById(userId, reportId);
    expect(responseIndex.entries.every((e) => e.status === "PENDING_SOURCE")).toBe(true);
    expect(responseIndex.confirmedQuestions).toBe(0);
    expect(responseIndex.questionnaireVersion).toBeNull();
  });

  it("distinguishes calculated answers from entered ones", async () => {
    const { responseIndex } = await getCdpReportContextById(userId, reportId);
    const derived = responseIndex.entries.filter((e) => e.derived);
    expect(derived.length).toBeGreaterThan(0);
    expect(responseIndex.derivedCount).toBe(derived.filter((e) => e.answered).length);
  });

  /**
   * The notices are the guard against this pack being mistaken for a
   * submission or for a CDP score. Asserted on the index because that is what
   * the PDF and the API both read.
   */
  it("carries the voluntary, not-a-submission and not-a-score notices", async () => {
    const { responseIndex } = await getCdpReportContextById(userId, reportId);
    expect(responseIndex.applicabilityNotice).toMatch(/voluntary/i);
    expect(responseIndex.submissionNotice).toMatch(/does not submit/i);
    expect(responseIndex.scoringNotice).toMatch(/not a CDP grade/i);
    expect(responseIndex.preparationStatement).toMatch(/not a CDP submission/i);
  });
});

describe("the generated PDF", () => {
  it("renders, and every index entry cites a page the document has", async () => {
    const { report, facility, metrics, maturity, responseIndex } = await getCdpReportContextById(userId, reportId);

    const doc = await buildCdpPdf(report, facility as never, metrics, maturity, responseIndex);
    const chunks: Buffer[] = [];
    const pdf = await new Promise<Buffer>((resolve, reject) => {
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
      doc.end();
    });

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(20_000);

    const unpaged = responseIndex.entries.filter((e) => e.pageNumber == null);
    expect(unpaged.map((e) => e.code)).toEqual([]);

    const pageCount = pdf.toString("latin1").split("/Type /Page").length - 2;
    expect(Math.max(...responseIndex.entries.map((e) => e.pageNumber!))).toBeLessThanOrEqual(pageCount);
  });
});
