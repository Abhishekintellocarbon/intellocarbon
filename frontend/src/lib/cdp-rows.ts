/**
 * The three repeating blocks CDP asks for, and the rules deciding when a row
 * is complete enough to save: risks and opportunities (C2.3 / C2.4), emissions
 * reduction targets (C4.1a / C4.1b), and emissions breakdown rows (C7).
 *
 * A deliberate duplicate of the row refinements in
 * backend/src/validators/cdp.validators.ts. The server's schemas are
 * authoritative and are what reject a bad row; these exist so the form can say
 * why a row is not being saved yet, at the moment the user is looking at it,
 * rather than letting an autosave fail invisibly.
 *
 * The two must stay in step. If this file is more permissive than the server,
 * a row passes the client filter and then fails the whole autosave request,
 * taking every other unsaved answer on the page with it — which is exactly the
 * failure this filtering exists to prevent.
 *
 * It lives here rather than inside the form component so it can be unit-tested
 * against the backend's own rules, the same reason csrd-scoring.ts sits in lib
 * rather than in the double materiality wizard.
 *
 * Fields are held as strings while being edited and coerced on save, the same
 * convention every other form here uses — a half-typed number must not become
 * 0.
 */

export interface RiskRow {
  kind: string;
  riskType: string;
  description: string;
  valueChainStage: string;
  timeHorizon: string;
  likelihood: string;
  magnitude: string;
  financialImpactMin: string;
  financialImpactMax: string;
  impactDescription: string;
  responseStrategy: string;
  responseCost: string;
}

export interface TargetRow {
  kind: string;
  scopesCovered: string;
  baseYear: string;
  baseYearEmissionsTco2e: string;
  targetYear: string;
  reductionPct: string;
  intensityMetric: string;
  baseYearIntensity: string;
  targetIntensity: string;
  percentAchieved: string;
  isScienceBased: boolean;
  description: string;
}

export interface BreakdownRow {
  dimension: string;
  scope: string;
  label: string;
  emissionsTco2e: string;
}

export const emptyRisk = (kind: string): RiskRow => ({
  kind,
  riskType: "",
  description: "",
  valueChainStage: "",
  timeHorizon: "",
  likelihood: "",
  magnitude: "",
  financialImpactMin: "",
  financialImpactMax: "",
  impactDescription: "",
  responseStrategy: "",
  responseCost: "",
});

export const emptyTarget = (): TargetRow => ({
  kind: "ABSOLUTE",
  scopesCovered: "",
  baseYear: "",
  baseYearEmissionsTco2e: "",
  targetYear: "",
  reductionPct: "",
  intensityMetric: "",
  baseYearIntensity: "",
  targetIntensity: "",
  percentAchieved: "",
  isScienceBased: false,
  description: "",
});

export const emptyBreakdown = (): BreakdownRow => ({
  dimension: "GAS",
  scope: "SCOPE_1",
  label: "",
  emissionsTco2e: "",
});

// ---------------------------------------------------------------------------
// Why a row is not being saved yet, in the responder's terms. Null when it is
// complete. `is*Complete` is derived from these rather than written twice, so
// the hint on screen and the payload filter can never disagree about what
// counts as complete.
// ---------------------------------------------------------------------------

export const riskIncompleteReason = (r: RiskRow): string | null => {
  if (!r.riskType.trim()) return "Add a type before this is saved.";
  if (!r.description.trim()) return "Add a description before this is saved.";
  if (
    r.financialImpactMin !== "" &&
    r.financialImpactMax !== "" &&
    Number(r.financialImpactMin) > Number(r.financialImpactMax)
  ) {
    return "The minimum financial effect cannot exceed the maximum.";
  }
  return null;
};

export const targetIncompleteReason = (t: TargetRow): string | null => {
  if (!t.scopesCovered.trim()) return "State which scopes this target covers before it is saved.";
  if (!t.baseYear || !t.targetYear) return "Add a base year and a target year before this is saved.";
  if (Number(t.targetYear) <= Number(t.baseYear)) return "The target year must be after the base year.";
  if (t.kind === "INTENSITY" && !t.intensityMetric.trim()) {
    return "An intensity target needs the metric it is stated per — for example tCO2e per tonne of product.";
  }
  return null;
};

export const breakdownIncompleteReason = (b: BreakdownRow): string | null => {
  if (!b.label.trim()) return "Name the gas, country, division or activity before this is saved.";
  if (b.emissionsTco2e === "") return "Add the tCO2e figure before this is saved.";
  if (Number.isNaN(Number(b.emissionsTco2e))) return "Enter the tCO2e figure as a number.";
  return null;
};

export const isRiskComplete = (r: RiskRow): boolean => riskIncompleteReason(r) === null;
export const isTargetComplete = (t: TargetRow): boolean => targetIncompleteReason(t) === null;
export const isBreakdownComplete = (b: BreakdownRow): boolean => breakdownIncompleteReason(b) === null;
