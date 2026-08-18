import { describe, it, expect } from "vitest";
import { assessCdpMaturity, isQuestionAnswered } from "../cdpMaturity.service";
import { CDP_MODULES, getCdpModule } from "../../data/cdpQuestionnaire";
import type { CdpMetrics, CdpReportWithRelations } from "../cdpCalculation.service";

/**
 * The maturity indicator is the one place this module makes a judgement about
 * the responder's position rather than recording what they typed. Its failure
 * mode is telling somebody they are ready for a questionnaire that is about to
 * mark them down — so the properties worth protecting are the caps: a module
 * answered in full but without the evidence CDP asks for must NOT reach
 * Strong, however many boxes are ticked.
 *
 * Pure unit tests — the assessment takes a loaded report and metrics, so no
 * database is involved.
 */

const emptyMetrics = (overrides: Partial<CdpMetrics["rollup"]> = {}): CdpMetrics => ({
  fyWindow: { start: new Date("2025-04-01"), end: new Date("2026-04-01"), label: "FY2025-26" } as never,
  rollup: {
    scope1Tco2e: 0,
    scope2LocationTco2e: 0,
    scope3Tco2e: null,
    scope3ByCategory: [],
    totalScope12Tco2e: 0,
    totalEnergyMwh: 0,
    purchasedElectricityMwh: 0,
    renewableElectricityMwh: 0,
    purchasedSteamMwh: 0,
    renewableSharePct: null,
    wasteGeneratedTonnes: null,
    waterWithdrawalM3: null,
    carbonCreditsCancelledTco2e: null,
    productionQuantityT: 0,
    activityDataCount: 0,
    ...overrides,
  },
  intensityPerRevenue: null,
  carbonPricingExposure: {
    observedSystems: [],
    appliesCbam: false,
    appliesCcts: false,
    cbamFrameworks: [],
    carbonPricePaidEurPerTonne: null,
    hasCctsTarget: false,
  },
});

/** A long-enough narrative that the trivial-answer guard accepts it. */
const NARRATIVE = "A substantive answer that a reviewer could actually use.";

/** Fills every stored question of a module with a type-appropriate value. */
const fullModuleRow = (moduleCode: string, overrides: Record<string, unknown> = {}): Record<string, unknown> => {
  const module = getCdpModule(moduleCode)!;
  const row: Record<string, unknown> = {};
  for (const question of module.questions) {
    if (question.derived) continue;
    switch (question.type) {
      case "narrative":
        row[question.field] = NARRATIVE;
        break;
      case "bool":
        row[question.field] = true;
        break;
      case "select":
        row[question.field] = question.options![0].value;
        break;
      case "year":
        row[question.field] = 2020;
        break;
      case "int":
        row[question.field] = 5;
        break;
      default:
        row[question.field] = 42.5;
    }
  }
  return { ...row, ...overrides };
};

const buildReport = (
  modules: Record<string, Record<string, unknown>> = {},
  extra: Partial<Pick<CdpReportWithRelations, "risks" | "targets" | "breakdownRows">> = {},
): CdpReportWithRelations => {
  const report: Record<string, unknown> = {
    id: "test",
    reportingPeriod: "FY2025-26",
    revenue: null,
    status: "DRAFT",
    risks: [],
    targets: [],
    breakdownRows: [],
    ...extra,
  };
  for (const module of CDP_MODULES) {
    report[module.relation] = modules[module.code] ?? null;
  }
  return report as unknown as CdpReportWithRelations;
};

const bandFor = (assessment: ReturnType<typeof assessCdpMaturity>, moduleCode: string) =>
  assessment.modules.find((m) => m.moduleCode === moduleCode)!;

/** Questions the indicator actually scores — constant ones carry no signal and are excluded. */
const scorableQuestionCount = (moduleCode?: string): number =>
  CDP_MODULES.filter((m) => !moduleCode || m.code === moduleCode).reduce(
    (sum, m) => sum + m.questions.filter((question) => !question.constant).length,
    0,
  );

describe("answered-ness", () => {
  it("treats an empty report as Not Started throughout", () => {
    const assessment = assessCdpMaturity(buildReport(), emptyMetrics());
    expect(assessment.modules.every((m) => m.band === "NOT_STARTED")).toBe(true);
    expect(assessment.overallBand).toBe("NOT_STARTED");
    expect(assessment.completenessPct).toBe(0);
  });

  /**
   * A one-word placeholder must not lift a module's band. CDP's questions ask
   * for explanation, and "n/a" in every box would otherwise read as a fully
   * answered module.
   */
  it("does not count a trivially short narrative as answered", () => {
    const question = getCdpModule("C1")!.questions.find((q) => q.field === "boardOversightDetail")!;
    expect(isQuestionAnswered(question, { boardOversightDetail: "n/a" }, emptyMetrics())).toBe(false);
    expect(isQuestionAnswered(question, { boardOversightDetail: NARRATIVE }, emptyMetrics())).toBe(true);
  });

  it("counts a derived question only when the calculation actually resolved", () => {
    const question = getCdpModule("C6")!.questions.find((q) => q.field === "scope1Tco2e")!;
    expect(isQuestionAnswered(question, null, emptyMetrics())).toBe(false);
    expect(isQuestionAnswered(question, null, emptyMetrics({ scope1Tco2e: 4000 }))).toBe(true);
  });

  /**
   * C0.2 is the reporting window, which resolves the moment a report exists.
   * Scored like any other derived question it would put every untouched
   * response on Developing with a non-zero completeness, which is precisely
   * the false reassurance this indicator exists to avoid.
   */
  it("ignores a constant question, so C0 stays Not Started until somebody enters something", () => {
    const assessment = assessCdpMaturity(buildReport(), emptyMetrics());
    const c0 = bandFor(assessment, "C0");
    expect(c0.band).toBe("NOT_STARTED");
    expect(c0.answered).toBe(0);
    expect(c0.total).toBe(scorableQuestionCount("C0"));
    expect(c0.unansweredCodes).not.toContain("C0.2");
  });

  it("counts a false boolean as answered — 'no' is an answer", () => {
    const question = getCdpModule("C1")!.questions.find((q) => q.field === "boardOversight")!;
    expect(isQuestionAnswered(question, { boardOversight: false }, emptyMetrics())).toBe(true);
  });
});

describe("evidence caps hold a module down regardless of completeness", () => {
  /**
   * The load-bearing test for this file. C4 is answered in full and truthfully
   * reports no target. That is a complete answer and a weak position, and the
   * indicator has to say the second thing rather than rewarding the first.
   */
  it("caps C4 at Developing when the response reports no emissions target", () => {
    const assessment = assessCdpMaturity(
      buildReport({ C4: fullModuleRow("C4", { targetType: "NONE" }) }),
      emptyMetrics(),
    );
    const c4 = bandFor(assessment, "C4");
    expect(c4.bandBeforeCaps).toBe("STRONG");
    expect(c4.band).toBe("DEVELOPING");
    expect(c4.evidenceGaps.join(" ")).toMatch(/no emissions reduction target/i);
  });

  it("caps C4 at Established when targets exist but none is science-based", () => {
    const assessment = assessCdpMaturity(
      buildReport(
        { C4: fullModuleRow("C4", { targetType: "ABSOLUTE", sbtiValidated: false }) },
        {
          targets: [
            { kind: "ABSOLUTE", baseYear: 2020, targetYear: 2030, isScienceBased: false } as never,
          ],
        },
      ),
      emptyMetrics(),
    );
    expect(bandFor(assessment, "C4").band).toBe("ESTABLISHED");
  });

  it("lets C4 reach Strong with a validated science-based target", () => {
    const assessment = assessCdpMaturity(
      buildReport(
        { C4: fullModuleRow("C4", { targetType: "ABSOLUTE", sbtiValidated: true }) },
        { targets: [{ kind: "ABSOLUTE", baseYear: 2020, targetYear: 2030, isScienceBased: true } as never] },
      ),
      emptyMetrics(),
    );
    expect(bandFor(assessment, "C4").band).toBe("STRONG");
    expect(bandFor(assessment, "C4").evidenceGaps).toEqual([]);
  });

  /**
   * The independent-verification principle this platform already applies to
   * BRSR, CBAM and CCTS. An unverified emissions figure is a weaker
   * disclosure, and a fully-typed C10 that reports no assurance at all must
   * not present as ready.
   */
  it("caps C10 at Developing when neither Scope 1 nor Scope 2 is verified", () => {
    const assessment = assessCdpMaturity(
      buildReport({ C10: fullModuleRow("C10", { scope1Assurance: "NONE", scope2Assurance: "NONE" }) }),
      emptyMetrics(),
    );
    const c10 = bandFor(assessment, "C10");
    expect(c10.bandBeforeCaps).toBe("STRONG");
    expect(c10.band).toBe("DEVELOPING");
    expect(c10.evidenceGaps.join(" ")).toMatch(/third-party verification/i);
  });

  it("caps C10 at Established when only one scope is verified", () => {
    const assessment = assessCdpMaturity(
      buildReport({ C10: fullModuleRow("C10", { scope1Assurance: "LIMITED", scope2Assurance: "NONE" }) }),
      emptyMetrics(),
    );
    expect(bandFor(assessment, "C10").band).toBe("ESTABLISHED");
  });

  it("caps C2 at Developing when no risks or opportunities are listed", () => {
    const assessment = assessCdpMaturity(buildReport({ C2: fullModuleRow("C2") }), emptyMetrics());
    expect(bandFor(assessment, "C2").band).toBe("DEVELOPING");
  });

  it("caps C2 at Established when risks are listed but no opportunities", () => {
    const assessment = assessCdpMaturity(
      buildReport({ C2: fullModuleRow("C2") }, { risks: [{ kind: "RISK" } as never] }),
      emptyMetrics(),
    );
    expect(bandFor(assessment, "C2").band).toBe("ESTABLISHED");
    expect(bandFor(assessment, "C2").evidenceGaps.join(" ")).toMatch(/opportunities/i);
  });

  it("caps C6 at Developing when no emissions have been calculated for the period", () => {
    const assessment = assessCdpMaturity(buildReport({ C6: fullModuleRow("C6") }), emptyMetrics());
    const c6 = bandFor(assessment, "C6");
    expect(c6.band).toBe("DEVELOPING");
    expect(c6.evidenceGaps.join(" ")).toMatch(/submit activity data/i);
  });

  it("caps C6 at Established when Scope 1 and 2 resolve but Scope 3 is absent", () => {
    const assessment = assessCdpMaturity(
      buildReport({ C6: fullModuleRow("C6") }),
      emptyMetrics({ scope1Tco2e: 4000, scope2LocationTco2e: 4383, totalScope12Tco2e: 8383 }),
    );
    expect(bandFor(assessment, "C6").band).toBe("ESTABLISHED");
  });

  it("caps C12 at Developing when no value chain engagement is reported", () => {
    const assessment = assessCdpMaturity(
      buildReport({ C12: fullModuleRow("C12", { engagesValueChain: false }) }),
      emptyMetrics(),
    );
    expect(bandFor(assessment, "C12").band).toBe("DEVELOPING");
  });

  /**
   * A cap must never lift a band. An untouched module stays Not Started even
   * though every cap's condition is technically satisfied by the emptiness.
   */
  it("never raises a band, and lists no gaps for a module nobody has started", () => {
    const assessment = assessCdpMaturity(buildReport(), emptyMetrics());
    expect(assessment.modules.every((m) => m.evidenceGaps.length === 0)).toBe(true);
  });
});

describe("the optional module is not counted as a gap", () => {
  /**
   * CDP issues C9 only to companies in the sectors its questions apply to. An
   * untouched C9 is not a failure to answer, and dragging the completeness
   * percentage down for it would tell a responder to go and fill in questions
   * they were never asked.
   */
  it("excludes an untouched C9 from the completeness denominator", () => {
    const withoutC9 = assessCdpMaturity(buildReport({ C1: fullModuleRow("C1") }), emptyMetrics());
    expect(withoutC9.total).toBe(scorableQuestionCount() - scorableQuestionCount("C9"));
  });

  it("counts C9 once it has been started", () => {
    const started = assessCdpMaturity(buildReport({ C9: fullModuleRow("C9") }), emptyMetrics());
    expect(started.total).toBe(scorableQuestionCount());
  });

  it("never lets C9 appear in the readiness actions", () => {
    const assessment = assessCdpMaturity(buildReport(), emptyMetrics());
    expect(assessment.readinessActions.some((a) => a.startsWith("C9"))).toBe(false);
  });
});

describe("the overall band", () => {
  it("cannot exceed the weakest started required module", () => {
    // C1 is answered in full with nothing capping it; C10 is answered in full
    // but unverified. The overall band must follow C10 down.
    const assessment = assessCdpMaturity(
      buildReport({
        C1: fullModuleRow("C1"),
        C10: fullModuleRow("C10", { scope1Assurance: "NONE", scope2Assurance: "NONE" }),
      }),
      emptyMetrics(),
    );
    expect(bandFor(assessment, "C1").band).toBe("STRONG");
    expect(assessment.overallBand).toBe("DEVELOPING");
  });

  it("reports the registry as unreconciled alongside the bands", () => {
    const assessment = assessCdpMaturity(buildReport(), emptyMetrics());
    expect(assessment.registryReconciled).toBe(false);
    expect(assessment.confirmedQuestions).toBe(0);
  });

  it("lists every unstarted required module as a readiness action", () => {
    const assessment = assessCdpMaturity(buildReport(), emptyMetrics());
    const required = CDP_MODULES.filter((m) => !m.optional).length;
    expect(assessment.readinessActions).toHaveLength(required);
    expect(assessment.readinessActions.every((a) => a.endsWith("not started."))).toBe(true);
  });
});
