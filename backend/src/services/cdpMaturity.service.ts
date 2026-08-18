import {
  CDP_MODULES,
  CDP_MATURITY_BANDS,
  CDP_TOTAL_QUESTION_COUNT,
  CDP_CONFIRMED_QUESTION_COUNT,
  CDP_REGISTRY_RECONCILED,
  type CdpMaturityBand,
  type CdpModule,
} from "../data/cdpQuestionnaire";
import { derivedQuestionHasValue, moduleRowsFrom, type CdpMetrics, type CdpReportWithRelations } from "./cdpCalculation.service";

/**
 * CDP readiness — the honest alternative to predicting a CDP score.
 *
 * CDP grades responses A to D- using its own methodology, applied by CDP to
 * the response actually submitted on its platform. That methodology is CDP's,
 * it moves between disclosure cycles, and it weighs things this platform
 * cannot see. Producing a letter grade from data held here would be a
 * fabricated number wearing a real scale's clothes — the same failure the
 * CSRD module refuses when it declines to claim ESRS conformity against an
 * unreconciled registry.
 *
 * What this produces instead is a completeness and maturity band per module,
 * on a scale that is deliberately NOT CDP's. Two inputs decide it:
 *
 *   1. How much of the module has been answered — stored answers plus derived
 *      figures that actually resolved.
 *   2. Whether the module has the supporting evidence CDP asks for. This is
 *      the part a pure percentage misses. A C4 answered in full but reporting
 *      no target at all is complete and weak, not complete and strong; a C10
 *      answered in full but reporting no third-party assurance is the same.
 *      Those are expressed as caps, so evidence gaps hold a module down no
 *      matter how many boxes are filled.
 *
 * The caps are the substance of this file. Without them the indicator would
 * reward typing rather than preparing, and would tell a responder they are
 * ready for a questionnaire that is about to score them poorly.
 */

/** Ratio thresholds for the answered-ness component, before any cap is applied. */
const ESTABLISHED_THRESHOLD = 0.5;
const STRONG_THRESHOLD = 0.85;

const bandIndex = (band: CdpMaturityBand): number => CDP_MATURITY_BANDS.indexOf(band);

/** Applies a ceiling, never a floor — a cap can only hold a band down. */
const capBand = (band: CdpMaturityBand, ceiling: CdpMaturityBand): CdpMaturityBand =>
  bandIndex(band) > bandIndex(ceiling) ? ceiling : band;

const bandFromRatio = (answered: number, total: number): CdpMaturityBand => {
  if (total === 0 || answered === 0) return "NOT_STARTED";
  const ratio = answered / total;
  if (ratio >= STRONG_THRESHOLD) return "STRONG";
  if (ratio >= ESTABLISHED_THRESHOLD) return "ESTABLISHED";
  return "DEVELOPING";
};

const hasValue = (v: unknown): boolean => v !== null && v !== undefined && v !== "";

/**
 * A narrative answer that is present but trivially short is treated as
 * unanswered. CDP's questions ask for explanation, and a one-word placeholder
 * would otherwise lift a module's band without adding anything a reviewer
 * could use. The threshold is deliberately low — it catches "n/a" and "TBC",
 * not a genuinely terse answer.
 *
 * Questions flagged `shortAnswer` are exempt, because for those a brief answer
 * is the correct one: "INR" fully answers which currency you report in, and
 * "CFO" fully answers the submitter's job title.
 */
const MIN_NARRATIVE_LENGTH = 12;

export const isQuestionAnswered = (
  question: CdpModule["questions"][number],
  row: Record<string, unknown> | null,
  metrics: CdpMetrics,
): boolean => {
  if (question.derived) return derivedQuestionHasValue(question.field, metrics);
  const value = row?.[question.field];
  if (!hasValue(value)) return false;
  if (question.type === "narrative" && !question.shortAnswer && typeof value === "string") {
    return value.trim().length >= MIN_NARRATIVE_LENGTH;
  }
  return true;
};

export interface CdpModuleMaturity {
  moduleCode: string;
  label: string;
  title: string;
  band: CdpMaturityBand;
  /** Band before evidence caps — surfaced so a responder can see a cap bit. */
  bandBeforeCaps: CdpMaturityBand;
  answered: number;
  total: number;
  optional: boolean;
  /** Codes of the questions still unanswered, for the "what's left" list. */
  unansweredCodes: string[];
  /** Why the band was held down, in the responder's terms. Empty when nothing capped it. */
  evidenceGaps: string[];
}

export interface CdpMaturityAssessment {
  modules: CdpModuleMaturity[];
  /** Across required modules only — an untouched optional module is not a gap. */
  answered: number;
  total: number;
  completenessPct: number;
  overallBand: CdpMaturityBand;
  /** What to do next, ordered by the module they belong to. */
  readinessActions: string[];
  registryReconciled: boolean;
  confirmedQuestions: number;
  totalQuestions: number;
}

/**
 * Evidence caps, per module.
 *
 * Each returns the ceiling this module's band may not exceed, plus the reason
 * to show the responder. Returning null means nothing holds this module down.
 */
const evidenceCapFor = (
  module: CdpModule,
  report: CdpReportWithRelations,
  row: Record<string, unknown> | null,
  metrics: CdpMetrics,
): { ceiling: CdpMaturityBand; reason: string }[] => {
  const caps: { ceiling: CdpMaturityBand; reason: string }[] = [];

  switch (module.code) {
    case "C2": {
      // CDP asks for risks and opportunities as repeating rows. A module
      // asserting that substantive risks exist but listing none is the exact
      // shape CDP marks down.
      if (report.risks.length === 0) {
        caps.push({
          ceiling: "DEVELOPING",
          reason: "No climate risks or opportunities have been listed — CDP asks for each one as a separate entry.",
        });
      } else if (!report.risks.some((r) => r.kind === "OPPORTUNITY")) {
        caps.push({
          ceiling: "ESTABLISHED",
          reason: "Only risks are listed. CDP asks for climate-related opportunities as well as risks.",
        });
      } else if (!report.risks.some((r) => r.kind === "RISK")) {
        caps.push({
          ceiling: "ESTABLISHED",
          reason: "Only opportunities are listed. CDP asks for climate-related risks as well as opportunities.",
        });
      }
      break;
    }

    case "C3": {
      if (row?.usesScenarioAnalysis !== "YES") {
        caps.push({
          ceiling: "ESTABLISHED",
          reason: "No climate scenario analysis is reported. CDP asks which scenarios were used and what they showed.",
        });
      }
      break;
    }

    case "C4": {
      // A truthful "no target" is a complete answer and a weak position. The
      // indicator says so rather than rewarding the completeness.
      if (row?.targetType === "NONE" || report.targets.length === 0) {
        caps.push({
          ceiling: "DEVELOPING",
          reason:
            "No emissions reduction target is reported. A target with a base year, a target year and a stated reduction is the single largest thing a buyer looks for here.",
        });
      } else if (!report.targets.some((t) => t.isScienceBased) && row?.sbtiValidated !== true) {
        caps.push({
          ceiling: "ESTABLISHED",
          reason: "No target is science-based or SBTi-validated. CDP treats validated targets as materially stronger.",
        });
      }
      break;
    }

    case "C6": {
      // The one module where the platform, not the responder, may be the
      // reason data is missing — so the reason names the fix.
      if (metrics.rollup.scope1Tco2e <= 0 && metrics.rollup.scope2LocationTco2e <= 0) {
        caps.push({
          ceiling: "DEVELOPING",
          reason:
            "No calculated Scope 1 or Scope 2 emissions for this period. Submit activity data for the reporting year so these figures resolve.",
        });
      } else if (metrics.rollup.scope3Tco2e == null) {
        caps.push({
          ceiling: "ESTABLISHED",
          reason: "No Scope 3 emissions have been submitted. CDP asks for Scope 3 category by category.",
        });
      }
      break;
    }

    case "C7": {
      if (report.breakdownRows.length === 0) {
        caps.push({
          ceiling: "ESTABLISHED",
          reason: "No emissions breakdown rows have been entered — CDP asks for Scope 1 split by gas and by country.",
        });
      }
      break;
    }

    case "C10": {
      // The independent-verification principle this platform already applies
      // to BRSR, CBAM and CCTS: an unverified figure is a weaker disclosure,
      // and saying so here is the same discipline.
      const unverified = (v: unknown) => v == null || v === "" || v === "NONE";
      if (unverified(row?.scope1Assurance) && unverified(row?.scope2Assurance)) {
        caps.push({
          ceiling: "DEVELOPING",
          reason:
            "No third-party verification of Scope 1 or Scope 2 emissions. CDP weights independently verified emissions data heavily, and several buyers require it outright.",
        });
      } else if (unverified(row?.scope1Assurance) || unverified(row?.scope2Assurance)) {
        caps.push({
          ceiling: "ESTABLISHED",
          reason: "Only one of Scope 1 and Scope 2 is independently verified.",
        });
      }
      break;
    }

    case "C11": {
      if (row?.usesInternalCarbonPrice !== "YES") {
        caps.push({
          ceiling: "ESTABLISHED",
          reason: "No internal carbon price is applied. CDP asks for one and treats it as evidence of transition planning.",
        });
      }
      break;
    }

    case "C12": {
      if (row?.engagesValueChain !== true) {
        caps.push({
          ceiling: "DEVELOPING",
          reason:
            "No value chain climate engagement is reported. This module is usually the reason a buyer requested your response in the first place.",
        });
      }
      break;
    }

    default:
      break;
  }

  return caps;
};

export const assessCdpMaturity = (report: CdpReportWithRelations, metrics: CdpMetrics): CdpMaturityAssessment => {
  const rows = moduleRowsFrom(report);

  const modules: CdpModuleMaturity[] = CDP_MODULES.map((module) => {
    const row = rows[module.code];
    // Constant questions resolve for every report and so distinguish nothing.
    // Scoring them would lift an untouched module off Not Started, which is
    // the one thing a readiness indicator must get right.
    const scorable = module.questions.filter((question) => !question.constant);
    const answeredQuestions = scorable.filter((question) => isQuestionAnswered(question, row, metrics));
    const bandBeforeCaps = bandFromRatio(answeredQuestions.length, scorable.length);

    // A module nobody has touched is Not Started, and its evidence gaps are
    // not worth listing yet — the responder has not claimed anything to
    // qualify. Listing them would bury the one useful instruction ("start
    // this module") under caveats about it.
    const caps = answeredQuestions.length === 0 ? [] : evidenceCapFor(module, report, row, metrics);
    const band = caps.reduce((current, cap) => capBand(current, cap.ceiling), bandBeforeCaps);

    return {
      moduleCode: module.code,
      label: module.label,
      title: module.title,
      band,
      bandBeforeCaps,
      answered: answeredQuestions.length,
      total: scorable.length,
      optional: module.optional ?? false,
      unansweredCodes: scorable
        .filter((question) => !isQuestionAnswered(question, row, metrics))
        .map((question) => question.code),
      evidenceGaps: caps.map((c) => c.reason),
    };
  });

  // Optional modules count toward completeness only once started. C9 is
  // sector-specific and CDP does not issue it to everyone, so an untouched C9
  // is not a gap and must not drag the percentage down.
  const counted = modules.filter((m) => !m.optional || m.answered > 0);
  const answered = counted.reduce((sum, m) => sum + m.answered, 0);
  const total = counted.reduce((sum, m) => sum + m.total, 0);

  const overallBeforeCaps = bandFromRatio(answered, total);
  const overallBand = modules
    .filter((m) => !m.optional && m.answered > 0)
    .reduce((current, m) => capBand(current, m.band), overallBeforeCaps);

  const readinessActions = modules
    .filter((m) => !m.optional)
    .flatMap((m) =>
      m.answered === 0
        ? [`${m.label} ${m.title}: not started.`]
        : m.evidenceGaps.map((gap) => `${m.label} ${m.title}: ${gap}`),
    );

  return {
    modules,
    answered,
    total,
    completenessPct: total > 0 ? Math.round((answered / total) * 1000) / 10 : 0,
    overallBand,
    readinessActions,
    registryReconciled: CDP_REGISTRY_RECONCILED,
    confirmedQuestions: CDP_CONFIRMED_QUESTION_COUNT,
    totalQuestions: CDP_TOTAL_QUESTION_COUNT,
  };
};
