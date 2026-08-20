import { describe, it, expect } from "vitest";
import {
  allowedEmissionsFor,
  evaluateTargetProgress,
  resolveEffectiveTarget,
  TARGET_SELF_REPORTED_NOTICE,
  TARGET_STATUS_LABELS,
  SBTI_STATUS_LABELS,
} from "../companyTarget.service";
import { effectiveCdpTargets } from "../cdpCalculation.service";
import type { CompanyTarget } from "@prisma/client";

/**
 * The tracker states a position on whether a company is meeting its own
 * commitment. Two things therefore matter more than the arithmetic: it must
 * refuse to assess rather than guess when the data cannot support one, and
 * nothing it produces may read as an SBTi endorsement.
 */

const target = (over: Partial<CompanyTarget> = {}): CompanyTarget =>
  ({
    id: "t1",
    companyId: "c1",
    kind: "ABSOLUTE",
    scopesCovered: "Scope 1+2",
    baselineYear: 2020,
    baselineEmissionsTco2e: 1000,
    targetYear: 2030,
    reductionPct: 50,
    intensityMetric: null,
    baselineIntensity: null,
    targetIntensity: null,
    isNetZero: false,
    sbtiStatus: "NOT_SUBMITTED",
    description: null,
    status: "SUBMITTED",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  }) as CompanyTarget;

describe("the linear path", () => {
  it("starts at the baseline and ends at the target level", () => {
    const t = target();
    expect(allowedEmissionsFor(t, 2020)).toBe(1000);
    expect(allowedEmissionsFor(t, 2030)).toBe(500);
  });

  it("interpolates evenly between the two", () => {
    const t = target();
    expect(allowedEmissionsFor(t, 2025)).toBe(750);
    expect(allowedEmissionsFor(t, 2022)).toBe(900);
  });

  it("holds at the target level beyond the target year", () => {
    expect(allowedEmissionsFor(target(), 2035)).toBe(500);
  });

  /**
   * A target says nothing about the years before it starts. Extrapolating
   * backwards would invent an allowance the company never committed to.
   */
  it("is undefined before the baseline year", () => {
    expect(allowedEmissionsFor(target(), 2019)).toBeNull();
  });

  it("is undefined without a reduction percentage", () => {
    expect(allowedEmissionsFor(target({ reductionPct: null }), 2025)).toBeNull();
  });
});

describe("status against the path", () => {
  it("reports ON_TRACK within tolerance", () => {
    const p = evaluateTargetProgress(target(), [{ year: 2025, totalTco2e: 750 }]);
    expect(p.status).toBe("ON_TRACK");
    expect(p.allowedTco2e).toBe(750);
    expect(p.varianceTco2e).toBe(0);
  });

  it("reports AHEAD when comfortably below the path", () => {
    const p = evaluateTargetProgress(target(), [{ year: 2025, totalTco2e: 600 }]);
    expect(p.status).toBe("AHEAD");
    expect(p.varianceTco2e).toBe(-150);
    expect(p.achievedReductionPct).toBe(40);
    expect(p.requiredReductionPct).toBe(25);
  });

  it("reports BEHIND when comfortably above the path", () => {
    const p = evaluateTargetProgress(target(), [{ year: 2025, totalTco2e: 900 }]);
    expect(p.status).toBe("BEHIND");
    expect(p.varianceTco2e).toBe(150);
  });

  it("reports ACHIEVED once emissions reach the target level early", () => {
    const p = evaluateTargetProgress(target(), [{ year: 2025, totalTco2e: 480 }]);
    expect(p.status).toBe("ACHIEVED");
    expect(p.yearsRemaining).toBe(5);
  });

  /**
   * Annual figures move for reasons other than decarbonisation — output,
   * acquisitions, a methodology change. A 1% miss calling a company "behind"
   * would make the indicator noise rather than signal.
   */
  it("absorbs small drift rather than flipping status on noise", () => {
    // 5% of the 750 allowance is 37.5.
    expect(evaluateTargetProgress(target(), [{ year: 2025, totalTco2e: 780 }]).status).toBe("ON_TRACK");
    expect(evaluateTargetProgress(target(), [{ year: 2025, totalTco2e: 720 }]).status).toBe("ON_TRACK");
    expect(evaluateTargetProgress(target(), [{ year: 2025, totalTco2e: 800 }]).status).toBe("BEHIND");
  });

  it("uses the latest year with data", () => {
    const p = evaluateTargetProgress(target(), [
      { year: 2022, totalTco2e: 950 },
      { year: 2025, totalTco2e: 600 },
    ]);
    expect(p.actualYear).toBe(2025);
    expect(p.status).toBe("AHEAD");
  });
});

describe("it refuses to assess rather than guessing", () => {
  /**
   * The load-bearing behaviour. Every one of these could be made to produce a
   * plausible-looking status, and each would be an assessment invented from
   * absent data.
   */
  it("is NOT_TRACKABLE with no reduction percentage", () => {
    const p = evaluateTargetProgress(target({ reductionPct: null }), [{ year: 2025, totalTco2e: 700 }]);
    expect(p.status).toBe("NOT_TRACKABLE");
    expect(p.reason).toMatch(/no reduction percentage/i);
  });

  it("is NOT_TRACKABLE with no actual data from the baseline onward", () => {
    const p = evaluateTargetProgress(target(), [{ year: 2018, totalTco2e: 900 }]);
    expect(p.status).toBe("NOT_TRACKABLE");
    expect(p.reason).toMatch(/no submitted emissions data/i);
  });

  it("is NOT_TRACKABLE with a zero baseline", () => {
    const p = evaluateTargetProgress(target({ baselineEmissionsTco2e: 0 }), [{ year: 2025, totalTco2e: 100 }]);
    expect(p.status).toBe("NOT_TRACKABLE");
    expect(p.reason).toMatch(/zero/i);
  });

  it("is NOT_TRACKABLE when the target year is not after the baseline", () => {
    const p = evaluateTargetProgress(target({ targetYear: 2020 }), [{ year: 2025, totalTco2e: 100 }]);
    expect(p.status).toBe("NOT_TRACKABLE");
  });

  /**
   * An intensity target needs a production denominator per year, which this
   * comparison does not read. Tracking it against absolute emissions would
   * silently answer a different question.
   */
  it("records but does not track intensity targets", () => {
    const p = evaluateTargetProgress(target({ kind: "INTENSITY", intensityMetric: "tCO2e/t steel" }), [
      { year: 2025, totalTco2e: 700 },
    ]);
    expect(p.status).toBe("NOT_TRACKABLE");
    expect(p.reason).toMatch(/production denominator/i);
  });

  it("never returns a status without a stated reason when not trackable", () => {
    const cases = [
      evaluateTargetProgress(target({ reductionPct: null }), []),
      evaluateTargetProgress(target(), []),
      evaluateTargetProgress(target({ kind: "INTENSITY" }), []),
    ];
    expect(cases.every((c) => c.status === "NOT_TRACKABLE" && c.reason.length > 20)).toBe(true);
  });
});

describe("nothing here claims SBTi endorsement", () => {
  it("states plainly that the target is self-reported and unvalidated", () => {
    expect(TARGET_SELF_REPORTED_NOTICE).toMatch(/self-reported/i);
    expect(TARGET_SELF_REPORTED_NOTICE).toMatch(/does not validate/i);
    expect(TARGET_SELF_REPORTED_NOTICE).toMatch(/no relationship with the Science Based Targets initiative/i);
  });

  /**
   * A status label reading "Science-based" or "Validated" on the platform's
   * own authority is exactly the unearned compliance claim this module must
   * not produce.
   */
  it("uses no status label implying validation or scientific alignment", () => {
    for (const label of Object.values(TARGET_STATUS_LABELS)) {
      expect(label).not.toMatch(/science|validat|approv|align/i);
    }
  });

  it("marks every self-declared SBTi status as self-reported except the default", () => {
    expect(SBTI_STATUS_LABELS.VALIDATED).toMatch(/self-reported/i);
    expect(SBTI_STATUS_LABELS.SUBMITTED).toMatch(/self-reported/i);
    expect(SBTI_STATUS_LABELS.COMMITTED).toMatch(/self-reported/i);
  });
});

describe("framework precedence", () => {
  /**
   * A submitted ISSB report or CDP response is a document someone signed.
   * Rewriting its stated target year from another table would change a filed
   * disclosure after the fact, so the framework's own explicit value wins and
   * the company target only fills a gap.
   */
  it("keeps a framework's explicitly set value", () => {
    expect(resolveEffectiveTarget(2035, 2030)).toBe(2035);
  });

  it("falls back to the company target when the framework has none", () => {
    expect(resolveEffectiveTarget(null, 2030)).toBe(2030);
    expect(resolveEffectiveTarget(undefined, 2030)).toBe(2030);
  });

  it("returns null when neither has a value", () => {
    expect(resolveEffectiveTarget(null, null)).toBeNull();
  });

  /**
   * Zero is a real disclosed value, not an absence. Coalescing it away would
   * silently replace a stated figure.
   */
  it("does not treat zero as absent", () => {
    expect(resolveEffectiveTarget(0, 500)).toBe(0);
  });
});

/**
 * CDP discloses targets as a list rather than as scalar fields, so it resolves
 * against the register with effectiveCdpTargets rather than
 * resolveEffectiveTarget. The precedence rule is the same one.
 */
describe("effectiveCdpTargets", () => {
  const companyTarget = (overrides: Partial<CompanyTarget> = {}): CompanyTarget =>
    ({
      id: "ct1",
      kind: "ABSOLUTE",
      scopesCovered: "Scope 1+2 (location-based)",
      baselineYear: 2020,
      baselineEmissionsTco2e: 1000,
      targetYear: 2030,
      reductionPct: 42,
      intensityMetric: null,
      baselineIntensity: null,
      targetIntensity: null,
      isNetZero: false,
      sbtiStatus: "NOT_SUBMITTED",
      description: null,
      ...overrides,
    }) as CompanyTarget;

  const reportTarget = (overrides: Record<string, unknown> = {}) =>
    ({
      kind: "ABSOLUTE",
      scopesCovered: "Scope 1",
      baseYear: 2019,
      baseYearEmissionsTco2e: 900,
      targetYear: 2035,
      reductionPct: 30,
      intensityMetric: null,
      baseYearIntensity: null,
      targetIntensity: null,
      percentAchieved: 12,
      isScienceBased: true,
      description: null,
      ...overrides,
    }) as never;

  it("discloses the response's own targets when it has any", () => {
    const result = effectiveCdpTargets([reportTarget()], [companyTarget()]);
    expect(result.fromCompanyTarget).toBe(false);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].targetYear).toBe(2035);
  });

  /**
   * The failure this guards against is a submitted response silently gaining a
   * target row the company never put in it.
   */
  it("never merges register targets into a response that states its own", () => {
    const result = effectiveCdpTargets([reportTarget()], [companyTarget(), companyTarget({ id: "ct2" })]);
    expect(result.rows).toHaveLength(1);
  });

  it("falls back to the register when the response states no target", () => {
    const result = effectiveCdpTargets([], [companyTarget()]);
    expect(result.fromCompanyTarget).toBe(true);
    expect(result.rows[0]).toMatchObject({ baseYear: 2020, targetYear: 2030, reductionPct: 42 });
  });

  /**
   * The whole discipline of companyTarget.service in one assertion: a company
   * saying it is SBTi-validated is not the platform certifying the target as
   * science-based, and C4's flag is the latter.
   */
  it("never promotes a self-declared SBTi status to the science-based flag", () => {
    const result = effectiveCdpTargets([], [companyTarget({ sbtiStatus: "VALIDATED" })]);
    expect(result.rows[0].isScienceBased).toBe(false);
    expect(result.rows[0].sbtiStatus).toBe("VALIDATED");
  });

  /** Percent achieved is a reported figure; the register does not hold one. */
  it("leaves percent achieved empty on fallback rows", () => {
    expect(effectiveCdpTargets([], [companyTarget()]).rows[0].percentAchieved).toBeNull();
  });

  it("reports no fallback when neither side has a target", () => {
    expect(effectiveCdpTargets([], [])).toEqual({ rows: [], fromCompanyTarget: false });
  });

  it("carries the intensity denominator through the fallback", () => {
    const result = effectiveCdpTargets(
      [],
      [
        companyTarget({
          kind: "INTENSITY",
          intensityMetric: "tCO2e per tonne of cement",
          baselineIntensity: 0.8,
          targetIntensity: 0.5,
        }),
      ],
    );
    expect(result.rows[0]).toMatchObject({
      kind: "INTENSITY",
      intensityMetric: "tCO2e per tonne of cement",
      baseYearIntensity: 0.8,
      targetIntensity: 0.5,
    });
  });
});
