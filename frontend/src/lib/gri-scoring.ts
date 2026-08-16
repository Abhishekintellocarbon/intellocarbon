// Relative rather than the "@/" alias: no vitest config defines that alias, so
// an aliased import here would break this module's unit tests. Every other
// module in src/lib follows the same convention.
import { isNegativeImpact, isPotentialImpact } from "./gri-standards";

/**
 * Client-side preview of the backend's GRI 3 impact scoring.
 *
 * This is a deliberate duplicate of `computeImpactSignificance` in
 * backend/src/services/griCalculation.service.ts. The server's value is
 * authoritative and is what gets persisted; this exists only so the scoring
 * step can show the consequence of changing a rating immediately, instead of
 * making the user save to find out whether a topic just became material.
 *
 * The two MUST stay in step — a preview that disagrees with the server would
 * show a topic as material and then have it silently excluded on save. It
 * lives here rather than inside the wizard component so it can be unit-tested
 * against the backend's own values (see __tests__/gri-scoring.test.ts).
 *
 * Method, mirroring GRI 3:
 *  - Negative impacts: significance is severity — the mean of scale, scope and
 *    irremediability.
 *  - Positive impacts: severity does not apply; the mean of scale and scope.
 *  - Potential impacts of either direction: weighted by likelihood, bounded to
 *    0.6-1.0 so likelihood can discount an uncertain impact but can never on
 *    its own drop a severe one below the threshold.
 */
const LIKELIHOOD_FLOOR = 0.5;

export interface GriScorableImpact {
  impactType: string;
  scale: number | string;
  scope: number | string;
  irremediability?: number | string | null;
  likelihood?: number | string | null;
}

export const previewSignificance = (impact: GriScorableImpact): number => {
  const attrs: number[] = [Number(impact.scale), Number(impact.scope)];
  if (isNegativeImpact(impact.impactType) && impact.irremediability != null) {
    attrs.push(Number(impact.irremediability));
  }
  const base = attrs.reduce((sum, v) => sum + v, 0) / attrs.length;

  const weight =
    isPotentialImpact(impact.impactType) && impact.likelihood != null
      ? LIKELIHOOD_FLOOR + (1 - LIKELIHOOD_FLOOR) * (Number(impact.likelihood) / 5)
      : 1;

  return Math.round(base * weight * 100) / 100;
};

export interface GriPreviewRanking {
  topicCode: string;
  significanceScore: number;
  meetsThreshold: boolean;
}

/**
 * Rolls impacts up per topic, taking the MAXIMUM significance rather than the
 * mean — matching rankTopicsByImpacts on the backend. Averaging would let a
 * cluster of minor impacts dilute a severe one out of the report.
 */
export const previewRankings = (
  impacts: GriScorableImpact[] & { topicCode: string }[],
  threshold: number,
): GriPreviewRanking[] => {
  const byTopic = new Map<string, number>();
  for (const impact of impacts) {
    const score = previewSignificance(impact);
    byTopic.set(impact.topicCode, Math.max(byTopic.get(impact.topicCode) ?? 0, score));
  }
  return Array.from(byTopic.entries())
    .map(([topicCode, significanceScore]) => ({
      topicCode,
      significanceScore,
      meetsThreshold: significanceScore >= threshold,
    }))
    // Ties break on topic code so the order is deterministic, as on the server.
    .sort((a, b) => b.significanceScore - a.significanceScore || a.topicCode.localeCompare(b.topicCode));
};

/** Severity alone, without the likelihood weighting — the matrix's y-axis. */
export const severityOf = (impact: GriScorableImpact): number => {
  const attrs: number[] = [Number(impact.scale), Number(impact.scope)];
  if (isNegativeImpact(impact.impactType) && impact.irremediability != null) {
    attrs.push(Number(impact.irremediability));
  }
  return attrs.reduce((sum, v) => sum + v, 0) / attrs.length;
};

/** An impact that has already occurred is certain, so it plots at the top of the likelihood axis. */
export const likelihoodOf = (impact: GriScorableImpact): number =>
  isPotentialImpact(impact.impactType) && impact.likelihood != null ? Number(impact.likelihood) : 5;
