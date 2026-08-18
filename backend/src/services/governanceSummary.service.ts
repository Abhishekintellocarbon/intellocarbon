/**
 * Governance, gathered from the disclosures a company has already filed.
 *
 * Nothing new is collected here. Governance data is currently spread across
 * four surfaces that were built at different times and never spoke to each
 * other:
 *
 *   GRI 2 (universal disclosures) — structure, committees, chair role,
 *   conflicts of interest, whistleblowing, remuneration, policy commitments.
 *   The richest source.
 *   ESRS 2 (CSRD general disclosures) — the board composition numbers:
 *   executive and non-executive counts, independence and gender diversity.
 *   ESRS G1 (CSRD business conduct) — conduct policy and anti-corruption.
 *   CDP C1 — climate-specific board oversight.
 *
 * ===========================================================================
 * "COMPLETENESS" HERE MEANS DISCLOSED, NOT ADEQUATE.
 *
 * A ticked policy means the company wrote something in that field of a
 * disclosure. It does not mean the policy is good, current, board-approved or
 * enforced — this platform reads none of that and cannot judge it. Equally, an
 * unticked row means "not disclosed in the frameworks filed here", NOT "no
 * such policy exists": a company may well have a code of conduct and simply
 * not have filed the disclosure that asks about it.
 *
 * Both readings have to survive into the UI. A governance checklist that looks
 * like an audit result is the failure mode, and it is an easy one to fall
 * into because a row of ticks and crosses reads as a verdict.
 * ===========================================================================
 */

export type GovernanceItemState = "DISCLOSED" | "NOT_DISCLOSED";

export interface GovernancePolicyItem {
  key: string;
  label: string;
  state: GovernanceItemState;
  /** Which disclosure the answer came from, e.g. "GRI 2-23". */
  source: string;
  /** The framework that would collect it, shown when nothing has been filed. */
  collectedBy: string;
}

export interface BoardStructure {
  hasData: boolean;
  executiveMembers: number | null;
  nonExecutiveMembers: number | null;
  totalMembers: number | null;
  independentPct: number | null;
  genderDiversityPct: number | null;
  /** GRI 2-11: whether the chair is also a senior executive. Null when not disclosed. */
  chairIsSeniorExecutive: boolean | null;
  committees: string | null;
  source: string | null;
}

export interface GovernanceSummary {
  hasAnyData: boolean;
  boardStructure: BoardStructure;
  policies: GovernancePolicyItem[];
  disclosedCount: number;
  totalCount: number;
  /** Frameworks that actually contributed something. */
  sources: string[];
}

const has = (v: unknown): boolean => {
  if (v == null) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (typeof v === "boolean") return true;
  if (typeof v === "number") return true;
  return false;
};

export interface GovernanceInputs {
  /** GRI 2 universal disclosures from the latest submitted GRI report. */
  gri?: Record<string, unknown> | null;
  /** ESRS 2 general disclosures from the latest submitted CSRD statement. */
  esrs2?: Record<string, unknown> | null;
  /** ESRS G1 business conduct from the same statement. */
  esrsG1?: Record<string, unknown> | null;
  /** CDP C1 governance from the latest submitted CDP response. */
  cdp?: Record<string, unknown> | null;
}

/**
 * The checklist.
 *
 * Each row names the disclosure it reads and the framework that collects it,
 * so an undisclosed row tells the user where to go rather than just showing a
 * cross. Ordered by how commonly a buyer or investor asks for them.
 */
const POLICY_ITEMS: {
  key: string;
  label: string;
  source: string;
  collectedBy: string;
  read: (i: GovernanceInputs) => unknown;
}[] = [
  {
    key: "conductPolicies",
    label: "Code of conduct / business conduct policy",
    source: "ESRS G1-1",
    collectedBy: "CSRD",
    read: (i) => i.esrsG1?.conductPolicies,
  },
  {
    key: "antiCorruption",
    label: "Anti-corruption and bribery prevention",
    source: "ESRS G1-3",
    collectedBy: "CSRD",
    read: (i) => i.esrsG1?.corruptionPrevention,
  },
  {
    key: "humanRights",
    label: "Human rights policy commitment",
    source: "GRI 2-23",
    collectedBy: "GRI",
    read: (i) => i.gri?.humanRightsPolicyCommitment,
  },
  {
    key: "conflictsOfInterest",
    label: "Conflicts of interest process",
    source: "GRI 2-15",
    collectedBy: "GRI",
    read: (i) => i.gri?.conflictsOfInterestProcess,
  },
  {
    key: "whistleblowing",
    label: "Raising concerns / whistleblowing mechanism",
    source: "GRI 2-16, 2-26",
    collectedBy: "GRI",
    read: (i) => i.gri?.criticalConcernsProcess ?? i.gri?.adviceAndConcernsMechanisms,
  },
  {
    key: "remuneration",
    label: "Remuneration policy",
    source: "GRI 2-19",
    collectedBy: "GRI",
    read: (i) => i.gri?.remunerationPolicies,
  },
  {
    key: "boardClimateOversight",
    label: "Board oversight of climate issues",
    source: "CDP C1.1 / ESRS GOV-1",
    collectedBy: "CDP or CSRD",
    read: (i) => i.cdp?.boardOversight ?? i.esrs2?.governanceBodiesRole,
  },
  {
    key: "dueDiligence",
    label: "Due diligence statement",
    source: "ESRS GOV-4",
    collectedBy: "CSRD",
    read: (i) => i.esrs2?.dueDiligenceStatement,
  },
];

export const buildGovernanceSummary = (inputs: GovernanceInputs): GovernanceSummary => {
  const policies: GovernancePolicyItem[] = POLICY_ITEMS.map((item) => ({
    key: item.key,
    label: item.label,
    state: has(item.read(inputs)) ? "DISCLOSED" : "NOT_DISCLOSED",
    source: item.source,
    collectedBy: item.collectedBy,
  }));

  const exec = (inputs.esrs2?.governanceExecutiveMembers as number | null | undefined) ?? null;
  const nonExec = (inputs.esrs2?.governanceNonExecutiveMembers as number | null | undefined) ?? null;
  const independentPct = (inputs.esrs2?.governanceIndependentPct as number | null | undefined) ?? null;
  const genderPct = (inputs.esrs2?.governanceGenderDiversityPct as number | null | undefined) ?? null;
  const chairIsSeniorExecutive = (inputs.gri?.chairIsSeniorExecutive as boolean | null | undefined) ?? null;
  const committees = (inputs.gri?.governanceCommittees as string | null | undefined) ?? null;

  const boardFields = [exec, nonExec, independentPct, genderPct, chairIsSeniorExecutive, committees];
  const boardHasData = boardFields.some(has);

  const sources: string[] = [];
  if (inputs.gri && Object.values(inputs.gri).some(has)) sources.push("GRI 2");
  if (inputs.esrs2 && Object.values(inputs.esrs2).some(has)) sources.push("ESRS 2");
  if (inputs.esrsG1 && Object.values(inputs.esrsG1).some(has)) sources.push("ESRS G1");
  if (inputs.cdp && Object.values(inputs.cdp).some(has)) sources.push("CDP C1");

  return {
    hasAnyData: boardHasData || policies.some((p) => p.state === "DISCLOSED"),
    boardStructure: {
      hasData: boardHasData,
      executiveMembers: exec,
      nonExecutiveMembers: nonExec,
      // Only meaningful when both halves are present; one alone is not a total.
      totalMembers: exec != null && nonExec != null ? exec + nonExec : null,
      independentPct,
      genderDiversityPct: genderPct,
      chairIsSeniorExecutive,
      committees,
      source: boardHasData ? "ESRS 2 GOV-1 / GRI 2-9 to 2-11" : null,
    },
    policies,
    disclosedCount: policies.filter((p) => p.state === "DISCLOSED").length,
    totalCount: policies.length,
    sources,
  };
};

/** Rendered with the checklist. Asserted on substance by tests. */
export const GOVERNANCE_DISCLOSURE_NOTICE =
  "This shows what you have disclosed, not how good it is. A ticked row means the field was filled in one of your " +
  "filed disclosures — Intellocarbon does not read, review or judge the underlying policy. An unticked row means " +
  "it has not been disclosed in the frameworks you have filed here, which is not the same as the policy not " +
  "existing.";
