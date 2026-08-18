import { CDP_MODULES, CDP_APPLICABILITY_NOTICE, CDP_SUBMISSION_NOTICE, CDP_SCORING_NOTICE, CDP_MATURITY_BAND_LABELS, CDP_MATURITY_BAND_DESCRIPTIONS } from "../data/cdpQuestionnaire";

const j = (v: unknown) => JSON.stringify(v);

const question = (q: Record<string, unknown>) => {
  const parts = [`code: ${j(q.code)}`, `label: ${j(q.label)}`, `type: ${j(q.type)}`, `field: ${j(q.field)}`, `status: ${j(q.status)}`];
  if (q.options) parts.push(`options: ${j(q.options)}`);
  if (q.unit) parts.push(`unit: ${j(q.unit)}`);
  if (q.hint) parts.push(`hint: ${j(q.hint)}`);
  if (q.derived) parts.push(`derived: true`);
  if (q.constant) parts.push(`constant: true`);
  if (q.shortAnswer) parts.push(`shortAnswer: true`);
  return `      { ${parts.join(", ")} },`;
};

const modules = CDP_MODULES.map((m) => `  {
    code: ${j(m.code)},
    label: ${j(m.label)},
    title: ${j(m.title)},
    pillar: ${j(m.pillar)},
    relation: ${j(m.relation)},
    blurb: ${j(m.blurb)},${m.optional ? "\n    optional: true," : ""}
    questions: [
${m.questions.map((q) => question(q as never)).join("\n")}
    ],
  },`).join("\n");

console.log(`/**
 * CDP Climate Change questionnaire registry — frontend mirror.
 *
 * GENERATED from backend/src/data/cdpQuestionnaire.ts. Do not edit by hand:
 * with fourteen modules and well over a hundred questions, a hand-maintained
 * copy would drift from the backend's definitions, and a question present in
 * only one of them either fails to render or fails to save. Regenerate after
 * changing the backend registry.
 *
 * It carries only what the UI needs — codes, labels, types, options, units and
 * the reconciliation status. The readiness bands and the response index stay
 * server-side, where the judgement about the responder's position is made.
 *
 * Read the backend file before trusting a question code here. In short: CDP
 * reissues its questionnaire annually and consolidated its separate
 * questionnaires into a unified corporate questionnaire in 2024, which
 * renumbered questions away from the classic C0-C15 lettering used here, so
 * every question is PENDING_SOURCE until reconciled against a questionnaire
 * document CDP actually issued.
 */

export type CdpModulePillar = "INTRODUCTION" | "GOVERNANCE" | "STRATEGY" | "EMISSIONS" | "ENGAGEMENT" | "SIGNOFF";
export type CdpQuestionStatus = "CONFIRMED" | "PENDING_SOURCE";
export type CdpQuestionType = "narrative" | "number" | "int" | "pct" | "year" | "bool" | "currency" | "select";

export interface CdpQuestion {
  code: string;
  label: string;
  type: CdpQuestionType;
  field: string;
  status: CdpQuestionStatus;
  options?: { value: string; label: string }[];
  unit?: string;
  hint?: string;
  derived?: boolean;
  /** Resolves for every report, so the readiness indicator ignores it. */
  constant?: boolean;
  /** A narrative whose valid answers are legitimately brief, e.g. a currency code. */
  shortAnswer?: boolean;
}

export interface CdpModuleMeta {
  code: string;
  label: string;
  title: string;
  pillar: CdpModulePillar;
  relation: string;
  blurb: string;
  optional?: boolean;
  questions: CdpQuestion[];
}

export const CDP_MODULES: CdpModuleMeta[] = [
${modules}
];

export const CDP_MODULE_CODES = CDP_MODULES.map((m) => m.code);

const MODULE_BY_CODE = new Map(CDP_MODULES.map((m) => [m.code, m]));

export const getCdpModule = (code: string): CdpModuleMeta | undefined => MODULE_BY_CODE.get(code);

export const CDP_TOTAL_QUESTION_COUNT = CDP_MODULES.reduce((sum, m) => sum + m.questions.length, 0);

export const CDP_CONFIRMED_QUESTION_COUNT = CDP_MODULES.reduce(
  (sum, m) => sum + m.questions.filter((q) => q.status === "CONFIRMED").length,
  0,
);

export const CDP_REGISTRY_RECONCILED = CDP_CONFIRMED_QUESTION_COUNT === CDP_TOTAL_QUESTION_COUNT;

// The three notices that keep this module honest about what CDP is. Shown
// wherever CDP is offered, for the same reason the Omnibus thresholds are
// shown wherever CSRD is.
export const CDP_APPLICABILITY_NOTICE = ${j(CDP_APPLICABILITY_NOTICE)};
export const CDP_SUBMISSION_NOTICE = ${j(CDP_SUBMISSION_NOTICE)};
export const CDP_SCORING_NOTICE = ${j(CDP_SCORING_NOTICE)};

export const CDP_MATURITY_BANDS = ["NOT_STARTED", "DEVELOPING", "ESTABLISHED", "STRONG"] as const;

export type CdpMaturityBand = (typeof CDP_MATURITY_BANDS)[number];

export const CDP_MATURITY_BAND_LABELS: Record<CdpMaturityBand, string> = ${j(CDP_MATURITY_BAND_LABELS)};

export const CDP_MATURITY_BAND_DESCRIPTIONS: Record<CdpMaturityBand, string> = ${j(CDP_MATURITY_BAND_DESCRIPTIONS)};

export const CDP_RISK_KINDS = [
  { value: "RISK", label: "Risk" },
  { value: "OPPORTUNITY", label: "Opportunity" },
] as const;

export const CDP_TIME_HORIZONS = [
  { value: "SHORT_TERM", label: "Short term" },
  { value: "MEDIUM_TERM", label: "Medium term" },
  { value: "LONG_TERM", label: "Long term" },
] as const;

export const CDP_TARGET_KINDS = [
  { value: "ABSOLUTE", label: "Absolute target" },
  { value: "INTENSITY", label: "Intensity target" },
] as const;

export const CDP_BREAKDOWN_DIMENSIONS = [
  { value: "GAS", label: "By greenhouse gas" },
  { value: "COUNTRY", label: "By country or area" },
  { value: "BUSINESS_DIVISION", label: "By business division" },
  { value: "ACTIVITY", label: "By activity" },
] as const;

export const CDP_BREAKDOWN_SCOPES = [
  { value: "SCOPE_1", label: "Scope 1" },
  { value: "SCOPE_2", label: "Scope 2" },
] as const;
`);

/**
 * Regenerates frontend/src/lib/cdp-questionnaire.ts from this backend registry.
 *
 *   npx tsx src/scripts/generateCdpMirror.ts > ../frontend/src/lib/cdp-questionnaire.ts
 *
 * Run it after any change to data/cdpQuestionnaire.ts. The mirror exists
 * because the form has to render the same questions the API will accept, and
 * a hand-maintained copy of a 100+ question registry drifts silently — a
 * question present in only one side either fails to render or fails to save.
 */
