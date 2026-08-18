import { describe, it, expect } from "vitest";
import { buildGovernanceSummary, GOVERNANCE_DISCLOSURE_NOTICE } from "../governanceSummary.service";

/**
 * A governance checklist reads as a verdict — a row of ticks and crosses looks
 * like an audit result whether or not it is one. It is not: a tick means a
 * field was filled, and a cross means nothing was filed here, which is not the
 * same as a policy not existing.
 *
 * These tests protect the aggregation across four disclosure surfaces and,
 * more importantly, that both of those readings survive.
 */

describe("aggregating across frameworks", () => {
  it("reads the conduct and anti-corruption policies from ESRS G1", () => {
    const s = buildGovernanceSummary({
      esrsG1: { conductPolicies: "A stated code of conduct.", corruptionPrevention: "Training and controls." },
    });
    expect(s.policies.find((p) => p.key === "conductPolicies")?.state).toBe("DISCLOSED");
    expect(s.policies.find((p) => p.key === "antiCorruption")?.state).toBe("DISCLOSED");
    expect(s.sources).toContain("ESRS G1");
  });

  it("reads human rights, conflicts and whistleblowing from GRI 2", () => {
    const s = buildGovernanceSummary({
      gri: {
        humanRightsPolicyCommitment: "Committed.",
        conflictsOfInterestProcess: "Declared annually.",
        criticalConcernsProcess: "Escalation path to the audit committee.",
      },
    });
    expect(s.disclosedCount).toBe(3);
    expect(s.sources).toEqual(["GRI 2"]);
  });

  it("accepts either GRI field as evidence of a concerns mechanism", () => {
    const viaAdvice = buildGovernanceSummary({ gri: { adviceAndConcernsMechanisms: "A hotline." } });
    expect(viaAdvice.policies.find((p) => p.key === "whistleblowing")?.state).toBe("DISCLOSED");
  });

  it("accepts board climate oversight from either CDP or ESRS", () => {
    expect(
      buildGovernanceSummary({ cdp: { boardOversight: true } }).policies.find((p) => p.key === "boardClimateOversight")
        ?.state,
    ).toBe("DISCLOSED");
    expect(
      buildGovernanceSummary({ esrs2: { governanceBodiesRole: "The board reviews climate quarterly." } }).policies.find(
        (p) => p.key === "boardClimateOversight",
      )?.state,
    ).toBe("DISCLOSED");
  });

  /**
   * `false` is a disclosed answer — a company stating its board does NOT
   * oversee climate has answered the question. Treating it as missing would
   * push a company toward the more flattering non-answer.
   */
  it("treats an explicit false as disclosed, not missing", () => {
    const s = buildGovernanceSummary({ cdp: { boardOversight: false } });
    expect(s.policies.find((p) => p.key === "boardClimateOversight")?.state).toBe("DISCLOSED");
  });

  it("lists only the frameworks that actually contributed", () => {
    const s = buildGovernanceSummary({ gri: { humanRightsPolicyCommitment: "Yes." }, esrsG1: {}, cdp: null });
    expect(s.sources).toEqual(["GRI 2"]);
  });
});

describe("board structure", () => {
  it("reads composition from ESRS 2 and the chair role from GRI 2", () => {
    const s = buildGovernanceSummary({
      esrs2: {
        governanceExecutiveMembers: 3,
        governanceNonExecutiveMembers: 6,
        governanceIndependentPct: 55.5,
        governanceGenderDiversityPct: 33,
      },
      gri: { chairIsSeniorExecutive: false, governanceCommittees: "Audit, Risk, Remuneration" },
    });
    expect(s.boardStructure.totalMembers).toBe(9);
    expect(s.boardStructure.independentPct).toBe(55.5);
    expect(s.boardStructure.chairIsSeniorExecutive).toBe(false);
    expect(s.boardStructure.committees).toContain("Audit");
  });

  /**
   * One half of the split is not a total. Reporting executives alone as the
   * board size would understate it, and there is no way to tell from the data
   * that the other half is missing rather than zero.
   */
  it("does not compute a total from one half of the composition", () => {
    const s = buildGovernanceSummary({ esrs2: { governanceExecutiveMembers: 3 } });
    expect(s.boardStructure.totalMembers).toBeNull();
    expect(s.boardStructure.executiveMembers).toBe(3);
    expect(s.boardStructure.hasData).toBe(true);
  });

  it("reports no board data when nothing composition-related was filed", () => {
    const s = buildGovernanceSummary({ gri: { humanRightsPolicyCommitment: "Yes." } });
    expect(s.boardStructure.hasData).toBe(false);
    expect(s.boardStructure.source).toBeNull();
  });

  it("counts a zero board figure as disclosed rather than absent", () => {
    const s = buildGovernanceSummary({ esrs2: { governanceExecutiveMembers: 0, governanceNonExecutiveMembers: 7 } });
    expect(s.boardStructure.totalMembers).toBe(7);
  });
});

describe("nothing here is an audit result", () => {
  /**
   * The load-bearing distinction. An unticked row must be readable as "not
   * disclosed here", never as "no such policy". Every row therefore names
   * where it would be collected, so the cross points somewhere actionable.
   */
  it("tells the user which framework collects each undisclosed item", () => {
    const s = buildGovernanceSummary({});
    expect(s.disclosedCount).toBe(0);
    expect(s.policies.every((p) => p.state === "NOT_DISCLOSED")).toBe(true);
    expect(s.policies.every((p) => p.collectedBy.length > 0 && p.source.length > 0)).toBe(true);
  });

  it("states that a tick means disclosed rather than adequate", () => {
    expect(GOVERNANCE_DISCLOSURE_NOTICE).toMatch(/not how good it is/i);
    expect(GOVERNANCE_DISCLOSURE_NOTICE).toMatch(/does not read, review or judge/i);
  });

  it("states that an unticked row is not the same as the policy not existing", () => {
    expect(GOVERNANCE_DISCLOSURE_NOTICE).toMatch(/not the same as the policy not\s+existing/i);
  });

  it("reports no data at all rather than an all-crosses scorecard for a company that filed nothing", () => {
    const s = buildGovernanceSummary({});
    expect(s.hasAnyData).toBe(false);
  });

  it("has data once a single item is disclosed", () => {
    const s = buildGovernanceSummary({ esrsG1: { conductPolicies: "Stated." } });
    expect(s.hasAnyData).toBe(true);
    expect(s.disclosedCount).toBe(1);
    expect(s.totalCount).toBe(8);
  });
});
