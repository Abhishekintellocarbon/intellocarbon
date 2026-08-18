import { describe, it, expect } from "vitest";
import {
  buildEcovadisReadiness,
  READINESS_BAND_LABELS,
  ECOVADIS_NOT_A_SCORE_NOTICE,
  ECOVADIS_NOT_A_SUBMISSION_NOTICE,
  type EcovadisInputs,
} from "../ecovadisReadiness.service";

/**
 * EcoVadis scores 0-100 and awards medals using a proprietary, analyst-applied
 * methodology weighted by sector, size and country. Nothing here may look like
 * a prediction of that. The tests below cover the mapping, and — more
 * importantly — that no output is expressible as a score or a medal.
 */

const nothing: EcovadisInputs = {
  hasScope12: false,
  hasScope3: false,
  hasEnergySplit: false,
  hasRenewableProcurement: false,
  hasWaterData: false,
  hasWasteData: false,
  hasEmissionsTarget: false,
  hasEmployeeHeadcount: false,
  hasGenderDiversity: false,
  hasSafetyIncidents: false,
  hasHumanRightsPolicy: false,
  hasCollectiveBargaining: false,
  hasCodeOfConduct: false,
  hasAntiCorruption: false,
  hasWhistleblowing: false,
  hasConflictsOfInterest: false,
  hasBoardOversight: false,
  hasSupplierList: false,
  hasSupplierDisclosures: false,
  hasSupplierScreening: false,
  hasSupplierRiskAssessment: false,
};

const everything: EcovadisInputs = Object.fromEntries(
  Object.keys(nothing).map((k) => [k, true]),
) as unknown as EcovadisInputs;

describe("the four themes", () => {
  it("covers exactly EcoVadis's four", () => {
    const r = buildEcovadisReadiness(nothing);
    expect(r.themes.map((t) => t.key)).toEqual([
      "ENVIRONMENT",
      "LABOUR_HUMAN_RIGHTS",
      "ETHICS",
      "SUSTAINABLE_PROCUREMENT",
    ]);
  });

  it("reports every theme not started when nothing has been collected", () => {
    const r = buildEcovadisReadiness(nothing);
    expect(r.themes.every((t) => t.band === "NOT_STARTED")).toBe(true);
    expect(r.overallBand).toBe("NOT_STARTED");
    expect(r.coveragePct).toBe(0);
  });

  it("reports every theme strong when everything has been collected", () => {
    const r = buildEcovadisReadiness(everything);
    expect(r.themes.every((t) => t.band === "STRONG")).toBe(true);
    expect(r.overallBand).toBe("STRONG");
    expect(r.coveragePct).toBe(100);
    expect(r.gaps).toEqual([]);
  });

  it("maps each indicator to the surface it comes from", () => {
    const r = buildEcovadisReadiness(nothing);
    const all = r.themes.flatMap((t) => t.indicators);
    expect(all.every((i) => i.sourcedFrom.length > 0)).toBe(true);
    // A gap should point somewhere actionable, not just show a cross.
    expect(all.find((i) => i.key === "renewableProcurement")?.sourcedFrom).toMatch(/REC ledger/);
  });
});

describe("the overall band cannot exceed the weakest theme", () => {
  /**
   * The load-bearing rule. EcoVadis assesses all four themes, so excellent
   * environmental data with nothing on ethics is not a well-prepared position.
   * A plain average would hide exactly that, and would hide it in the
   * flattering direction.
   */
  it("is held down by an untouched theme even when overall coverage is high", () => {
    const strongExceptEthics: EcovadisInputs = {
      ...everything,
      hasCodeOfConduct: false,
      hasAntiCorruption: false,
      hasWhistleblowing: false,
      hasConflictsOfInterest: false,
      hasBoardOversight: false,
    };
    const r = buildEcovadisReadiness(strongExceptEthics);
    expect(r.coveragePct).toBeGreaterThan(70);
    expect(r.themes.find((t) => t.key === "ETHICS")?.band).toBe("NOT_STARTED");
    expect(r.overallBand).toBe("NOT_STARTED");
  });

  it("rises only when every theme does", () => {
    const halfEverywhere: EcovadisInputs = {
      ...nothing,
      hasScope12: true,
      hasScope3: true,
      hasEnergySplit: true,
      hasWaterData: true,
      hasEmployeeHeadcount: true,
      hasGenderDiversity: true,
      hasSafetyIncidents: true,
      hasCodeOfConduct: true,
      hasAntiCorruption: true,
      hasWhistleblowing: true,
      hasSupplierList: true,
      hasSupplierDisclosures: true,
    };
    const r = buildEcovadisReadiness(halfEverywhere);
    expect(r.themes.every((t) => t.band !== "NOT_STARTED")).toBe(true);
    expect(r.overallBand).toBe("ESTABLISHED");
  });
});

describe("gaps", () => {
  it("lists the worst-covered theme first and names what is missing", () => {
    const r = buildEcovadisReadiness({ ...everything, hasSupplierList: false, hasSupplierDisclosures: false, hasSupplierScreening: false, hasSupplierRiskAssessment: false });
    expect(r.gaps[0]).toMatch(/^Sustainable Procurement/);
    expect(r.gaps[0]).toMatch(/4 of 4 not covered/);
  });

  it("says nothing for a fully covered theme", () => {
    const r = buildEcovadisReadiness(everything);
    expect(r.gaps).toEqual([]);
  });
});

describe("nothing here is a score or a medal", () => {
  /**
   * The whole point of the module's honesty pattern. A 0-100 number or a metal
   * name anywhere in the output would read as an EcoVadis result, which is
   * theirs to award and not ours to guess.
   */
  it("uses no band label resembling a medal or a grade", () => {
    for (const label of Object.values(READINESS_BAND_LABELS)) {
      expect(label).not.toMatch(/bronze|silver|gold|platinum/i);
      expect(label).not.toMatch(/^\d+$/);
      expect(label).not.toMatch(/score|rating|medal/i);
    }
  });

  it("states plainly that it neither is nor predicts an EcoVadis score", () => {
    expect(ECOVADIS_NOT_A_SCORE_NOTICE).toMatch(/not an EcoVadis score and does not predict one/i);
    expect(ECOVADIS_NOT_A_SCORE_NOTICE).toMatch(/its own\s+methodology/i);
  });

  it("states it is preparation only and not a submission route", () => {
    expect(ECOVADIS_NOT_A_SUBMISSION_NOTICE).toMatch(/completed on EcoVadis's own platform/i);
    expect(ECOVADIS_NOT_A_SUBMISSION_NOTICE).toMatch(/nothing here is sent to/i);
  });

  /**
   * The mapping is ours, not EcoVadis's question set — which is issued per
   * company and which nobody here has. Claiming otherwise would imply a
   * fidelity this does not have.
   */
  it("states the mapping is ours rather than EcoVadis's question set", () => {
    expect(ECOVADIS_NOT_A_SUBMISSION_NOTICE).toMatch(/our mapping of your data, not EcoVadis's\s+question set/i);
  });

  it("carries both notices on every result", () => {
    const r = buildEcovadisReadiness(nothing);
    expect(r.notScoreNotice).toBe(ECOVADIS_NOT_A_SCORE_NOTICE);
    expect(r.notSubmissionNotice).toBe(ECOVADIS_NOT_A_SUBMISSION_NOTICE);
  });
});
