import {
  CDP_MODULES,
  CDP_REGISTRY_RECONCILED,
  CDP_CONFIRMED_QUESTION_COUNT,
  CDP_TOTAL_QUESTION_COUNT,
  CDP_QUESTIONNAIRE_VERSION,
  CDP_APPLICABILITY_NOTICE,
  CDP_SUBMISSION_NOTICE,
  CDP_SCORING_NOTICE,
  CDP_PREPARATION_STATEMENT,
  type CdpQuestionStatus,
} from "../data/cdpQuestionnaire";
import { moduleRowsFrom, type CdpMetrics, type CdpReportWithRelations } from "./cdpCalculation.service";
import { isQuestionAnswered, type CdpMaturityAssessment } from "./cdpMaturity.service";

/**
 * The CDP response index.
 *
 * This is the CDP counterpart to the GRI content index and the ESRS
 * disclosure index, but it answers a different question. GRI's index exists
 * because GRI requires one; CDP requires nothing of the sort, since a CDP
 * response is entered question by question into CDP's own platform.
 *
 * What this index is actually for is the transfer. Somebody has to sit in
 * front of CDP's online response form with this document open and copy
 * answers across, question by question. So the index is ordered exactly as
 * the questionnaire is, states for every question whether an answer exists,
 * cites the page the answer is on, and flags whether the figure was
 * calculated by the platform or asserted by the responder.
 *
 * It carries one column the GRI index has no equivalent of: whether the
 * question's code has been reconciled against a CDP questionnaire document.
 * Until it has, the person doing the transfer must match questions by
 * subject matter rather than by number, and the index says so rather than
 * letting them assume C6.1 here is C6.1 there.
 */

export interface CdpResponseIndexEntry {
  /** e.g. "C6: Emissions data". Blank on continuation rows within a module. */
  module: string;
  /** CDP question reference, e.g. "C6.1". */
  code: string;
  label: string;
  /** 1-based page in the generated PDF, stamped during rendering. */
  pageNumber: number | null;
  answered: boolean;
  /** True when the figure came from the platform's engines rather than manual entry. */
  derived: boolean;
  /** Whether this question's code has been reconciled with a CDP questionnaire. */
  status: CdpQuestionStatus;
  moduleCode: string;
  optional: boolean;
}

export interface CdpResponseIndex {
  entries: CdpResponseIndexEntry[];
  preparationStatement: string;
  applicabilityNotice: string;
  submissionNotice: string;
  scoringNotice: string;
  /** Question codes reconciled against a published CDP questionnaire. */
  registryReconciled: boolean;
  questionnaireVersion: string | null;
  confirmedQuestions: number;
  totalQuestions: number;
  answeredCount: number;
  unansweredCount: number;
  derivedCount: number;
  /** Modules with nothing entered at all, so the transfer can skip them knowingly. */
  emptyModules: { module: string; title: string; optional: boolean }[];
}

export const buildResponseIndex = (
  report: CdpReportWithRelations,
  metrics: CdpMetrics,
  maturity: CdpMaturityAssessment,
): CdpResponseIndex => {
  const entries: CdpResponseIndexEntry[] = [];
  const rows = moduleRowsFrom(report);

  for (const module of CDP_MODULES) {
    const row = rows[module.code];
    module.questions.forEach((question, questionIndex) => {
      entries.push({
        module: questionIndex === 0 ? `${module.label}: ${module.title}` : "",
        code: question.code,
        label: question.label,
        pageNumber: null,
        answered: isQuestionAnswered(question, row, metrics),
        derived: question.derived ?? false,
        status: question.status,
        moduleCode: module.code,
        optional: module.optional ?? false,
      });
    });
  }

  const emptyModules = maturity.modules
    .filter((m) => m.answered === 0)
    .map((m) => ({ module: `${m.label}: ${m.title}`, title: m.title, optional: m.optional }));

  return {
    entries,
    preparationStatement: CDP_PREPARATION_STATEMENT,
    applicabilityNotice: CDP_APPLICABILITY_NOTICE,
    submissionNotice: CDP_SUBMISSION_NOTICE,
    scoringNotice: CDP_SCORING_NOTICE,
    registryReconciled: CDP_REGISTRY_RECONCILED,
    questionnaireVersion: CDP_QUESTIONNAIRE_VERSION,
    confirmedQuestions: CDP_CONFIRMED_QUESTION_COUNT,
    totalQuestions: CDP_TOTAL_QUESTION_COUNT,
    answeredCount: entries.filter((e) => e.answered).length,
    unansweredCount: entries.filter((e) => !e.answered).length,
    derivedCount: entries.filter((e) => e.derived && e.answered).length,
    emptyModules,
  };
};

/**
 * Stamps page numbers once the PDF builder knows where each module landed.
 * Keys are module codes — page granularity is per module, which is what a
 * transfer document means by a page reference.
 */
export const assignPageNumbers = (index: CdpResponseIndex, pages: Record<string, number>): void => {
  for (const entry of index.entries) {
    if (pages[entry.moduleCode] != null) entry.pageNumber = pages[entry.moduleCode];
  }
};
