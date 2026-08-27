import type { Citation } from "../../data/decarbonizationBenchmarks";

/**
 * Where a number on a card came from. Rendered next to the value in Phase 3 so
 * a customer can tell their own verified data apart from a published benchmark
 * apart from something read off a bill by OCR — three quite different levels of
 * confidence that would otherwise look identical on screen.
 */
export type InputSource =
  /** A column the platform's own calculation engine wrote for this facility. */
  | "PLATFORM_CALCULATION"
  /** Read off an uploaded bill by IntelloAdvisor Phase 1 (Bill Intelligence). */
  | "BILL_EXTRACTION"
  /** A published external figure from data/decarbonizationBenchmarks.ts. */
  | "PUBLISHED_BENCHMARK"
  /** Recorded on the facility by the customer. */
  | "FACILITY_PROFILE";

export type RecommendationInput = {
  label: string;
  value: string;
  source: InputSource;
};

/**
 * An impact estimate, always a range.
 *
 * Never a single number: these are directional estimates built on a design
 * range and a published yield range, not verified project calculations, and a
 * single figure would claim a precision the inputs do not carry. `basis` says
 * in words what the two ends of the range actually are, so "8%–17%" is never
 * left to be interpreted as a confidence interval.
 */
export type ImpactRange = {
  metric: string;
  unit: "PERCENT_OF_TOTAL_EMISSIONS" | "TCO2E_PER_YEAR";
  low: number;
  high: number;
  basis: string;
};

export type RecommendationCard = {
  /** Stable rule identifier — safe for the UI to key on and for tests to assert. */
  id: string;
  category: "SCOPE_2_ELECTRICITY" | "SCOPE_1_COMBUSTION" | "LIABILITY_STRUCTURE";
  title: string;
  /** Templated plain language with values substituted in. No generated prose. */
  explanation: string;
  /** Every figure quoted in the explanation, with its provenance. */
  inputs: RecommendationInput[];
  /** Null when the data needed to size an impact is missing — never a guess. */
  impact: ImpactRange | null;
  citations: Citation[];
  /** Things that would change the answer, stated rather than buried. */
  caveats: string[];
  /**
   * True when any citation on this card is still NEEDS_COMPLIANCE_REVIEW.
   * Phase 3 must badge these; they are not yet sign-off quality.
   */
  requiresComplianceReview: boolean;
};
