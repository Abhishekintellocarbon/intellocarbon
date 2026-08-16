import { isNegativeImpact, isPotentialImpact } from "./esrs-standards";

/**
 * Client-side preview of the backend's double materiality scoring.
 *
 * A deliberate duplicate of computeImpactScore / computeFinancialScore in
 * backend/src/services/csrdCalculation.service.ts. The server's values are
 * authoritative and are what get persisted; this exists so the scoring step
 * can show the consequence of a rating immediately rather than making the
 * preparer save to find out whether a standard just became material.
 *
 * The two must stay in step — a preview that disagrees with the server would
 * show a standard as material and then have it silently excluded on save. It
 * lives here rather than inside the wizard so it can be unit-tested against
 * the backend's own values.
 *
 * Impact severity is the same construction GRI uses, because ESRS aligned to
 * it. Financial materiality has no severity construction: a financial effect
 * has a size and a probability, not a scope or an irremediability.
 */
const LIKELIHOOD_FLOOR = 0.5;

const likelihoodWeight = (likelihood: number | string | null | undefined): number =>
  likelihood != null && likelihood !== ""
    ? LIKELIHOOD_FLOOR + (1 - LIKELIHOOD_FLOOR) * (Number(likelihood) / 5)
    : 1;

export interface CsrdScorableIro {
  kind: string;
  impactType?: string | null;
  scale?: number | string | null;
  scope?: number | string | null;
  irremediability?: number | string | null;
  impactLikelihood?: number | string | null;
  magnitude?: number | string | null;
  financialLikelihood?: number | string | null;
}

const present = (v: unknown): boolean => v != null && v !== "";

/** Null when the entry is not scored on the impact axis at all. */
export const previewImpactScore = (iro: CsrdScorableIro): number | null => {
  if (iro.kind === "FINANCIAL") return null;
  if (!iro.impactType || !present(iro.scale) || !present(iro.scope)) return null;

  const attrs: number[] = [Number(iro.scale), Number(iro.scope)];
  if (isNegativeImpact(iro.impactType) && present(iro.irremediability)) {
    attrs.push(Number(iro.irremediability));
  }
  const base = attrs.reduce((sum, v) => sum + v, 0) / attrs.length;
  const weight = isPotentialImpact(iro.impactType) ? likelihoodWeight(iro.impactLikelihood) : 1;
  return Math.round(base * weight * 100) / 100;
};

/** Null when the entry is not scored on the financial axis at all. */
export const previewFinancialScore = (iro: CsrdScorableIro): number | null => {
  if (iro.kind === "IMPACT") return null;
  if (!present(iro.magnitude)) return null;
  return Math.round(Number(iro.magnitude) * likelihoodWeight(iro.financialLikelihood) * 100) / 100;
};

export interface CsrdPreviewScore {
  standardCode: string;
  impactScore: number | null;
  financialScore: number | null;
  impactMaterial: boolean;
  financialMaterial: boolean;
  isMaterial: boolean;
}

/**
 * Rolls IROs up per standard, taking the maximum on each axis and OR-ing the
 * two determinations — matching rankStandardsByIros on the backend. Averaging
 * would let a cluster of minor matters dilute a severe one; requiring both
 * axes would be stricter than ESRS sets.
 */
export const previewScores = (
  iros: (CsrdScorableIro & { standardCode: string })[],
  impactThreshold: number,
  financialThreshold: number,
): CsrdPreviewScore[] => {
  const byStandard = new Map<string, { impact: number | null; financial: number | null }>();

  for (const iro of iros) {
    const existing = byStandard.get(iro.standardCode) ?? { impact: null, financial: null };
    const impact = previewImpactScore(iro);
    const financial = previewFinancialScore(iro);
    if (impact != null) existing.impact = existing.impact == null ? impact : Math.max(existing.impact, impact);
    if (financial != null) {
      existing.financial = existing.financial == null ? financial : Math.max(existing.financial, financial);
    }
    byStandard.set(iro.standardCode, existing);
  }

  return Array.from(byStandard.entries())
    .map(([standardCode, { impact, financial }]) => {
      const impactMaterial = impact != null && impact >= impactThreshold;
      const financialMaterial = financial != null && financial >= financialThreshold;
      return {
        standardCode,
        impactScore: impact,
        financialScore: financial,
        impactMaterial,
        financialMaterial,
        isMaterial: impactMaterial || financialMaterial,
      };
    })
    .sort(
      (a, b) =>
        Math.max(b.impactScore ?? 0, b.financialScore ?? 0) - Math.max(a.impactScore ?? 0, a.financialScore ?? 0) ||
        a.standardCode.localeCompare(b.standardCode),
    );
};
