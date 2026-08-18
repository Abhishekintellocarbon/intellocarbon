import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import {
  CDP_MODULES,
  CDP_MODULE_CODES,
  CDP_TOTAL_QUESTION_COUNT,
  CDP_CONFIRMED_QUESTION_COUNT,
  CDP_REGISTRY_RECONCILED,
  CDP_QUESTIONNAIRE_VERSION,
  CDP_APPLICABILITY_NOTICE,
  CDP_SUBMISSION_NOTICE,
  CDP_SCORING_NOTICE,
  getCdpModule,
  isCdpModuleCode,
} from "../cdpQuestionnaire";

/**
 * The registry is the backbone of the whole CDP module — the maturity
 * indicator, the response index, the PDF and the form all walk it. Its
 * failure mode is silent, exactly as GRI's is: a field name that does not
 * exist on the backing Prisma model makes the question read as unanswered
 * forever, so a module the user actually filled in is reported as a gap and
 * its maturity band is quietly understated. Nothing throws.
 */

// Prisma's DMMF is available without a database connection, so this stays a
// pure unit test.
const MODELS = new Map(Prisma.dmmf.datamodel.models.map((m) => [m.name, m]));

const scalarFieldNames = (modelName: string): Set<string> => {
  const model = MODELS.get(modelName);
  if (!model) throw new Error(`Prisma model ${modelName} not found`);
  return new Set(model.fields.filter((f) => f.kind === "scalar" || f.kind === "enum").map((f) => f.name));
};

/** Resolves a CdpReport relation name (e.g. "governance") to the model it points at. */
const modelForRelation = (relation: string): string => {
  const cdpReport = MODELS.get("CdpReport");
  if (!cdpReport) throw new Error("CdpReport model not found");
  const field = cdpReport.fields.find((f) => f.name === relation);
  if (!field) throw new Error(`CdpReport has no relation named "${relation}"`);
  return field.type;
};

describe("CDP registry — structure", () => {
  it("covers the questionnaire modules this platform claims to prepare", () => {
    expect(CDP_MODULE_CODES).toEqual(["C0", "C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9", "C10", "C11", "C12", "C15"]);
  });

  it("resolves modules by code and rejects unknown ones", () => {
    expect(getCdpModule("C6")?.title).toBe("Emissions data");
    expect(getCdpModule("C99")).toBeUndefined();
    expect(isCdpModuleCode("C11")).toBe(true);
    expect(isCdpModuleCode("C13")).toBe(false);
  });

  it("gives every module a distinct relation on CdpReport", () => {
    const relations = CDP_MODULES.map((m) => m.relation);
    expect(new Set(relations).size).toBe(relations.length);
    for (const relation of relations) {
      expect(() => modelForRelation(relation)).not.toThrow();
    }
  });

  it("uses a globally unique question code", () => {
    const codes = CDP_MODULES.flatMap((m) => m.questions.map((question) => question.code));
    expect(new Set(codes).size).toBe(codes.length);
  });

  // C9 is the only module CDP issues conditionally. If another module ever
  // gets marked optional the maturity indicator stops counting it as a gap,
  // which is a substantive change and should be a deliberate one.
  it("marks only C9 optional", () => {
    expect(CDP_MODULES.filter((m) => m.optional).map((m) => m.code)).toEqual(["C9"]);
  });
});

describe("CDP registry — every stored question has a column behind it", () => {
  it.each(CDP_MODULES.map((m) => [m.code, m] as const))(
    "%s stores every non-derived question on its Prisma model",
    (_code, module) => {
      const columns = scalarFieldNames(modelForRelation(module.relation));
      const missing = module.questions
        .filter((question) => !question.derived)
        .filter((question) => !columns.has(question.field))
        .map((question) => `${question.code} -> ${question.field}`);
      expect(missing).toEqual([]);
    },
  );

  // The inverse direction: a column nothing in the registry writes to is
  // dead weight that will never be filled or rendered.
  it.each(CDP_MODULES.map((m) => [m.code, m] as const))("%s has no orphaned column", (_code, module) => {
    const housekeeping = new Set(["id", "cdpReportId", "createdAt", "updatedAt"]);
    const registryFields = new Set(module.questions.filter((question) => !question.derived).map((q) => q.field));
    const orphaned = [...scalarFieldNames(modelForRelation(module.relation))].filter(
      (column) => !housekeeping.has(column) && !registryFields.has(column),
    );
    expect(orphaned).toEqual([]);
  });

  it("gives every select question a non-empty option list", () => {
    for (const module of CDP_MODULES) {
      for (const question of module.questions) {
        if (question.type === "select") {
          expect(question.options?.length, `${question.code} has no options`).toBeGreaterThan(0);
        }
      }
    }
  });

  it("never puts options on a question that is not a select", () => {
    const misplaced = CDP_MODULES.flatMap((m) => m.questions)
      .filter((question) => question.type !== "select" && question.options)
      .map((question) => question.code);
    expect(misplaced).toEqual([]);
  });
});

describe("CDP registry — provenance is honest", () => {
  /**
   * The load-bearing test for this file. CDP reissues its questionnaire
   * annually and consolidated the separate questionnaires into a unified
   * corporate questionnaire in 2024, which renumbered questions away from the
   * classic C0-C15 lettering this registry follows. Until someone has
   * reconciled these codes against a questionnaire document CDP actually
   * issued, the module must not present itself as matching CDP's numbering.
   *
   * If this test is ever changed to assert reconciliation, that must be
   * because the codes were checked against a real questionnaire — not to make
   * a failing test pass.
   */
  it("reports the registry as unreconciled while any question is PENDING_SOURCE", () => {
    expect(CDP_CONFIRMED_QUESTION_COUNT).toBe(0);
    expect(CDP_REGISTRY_RECONCILED).toBe(false);
    expect(CDP_QUESTIONNAIRE_VERSION).toBeNull();
  });

  it("counts every question in the total", () => {
    expect(CDP_TOTAL_QUESTION_COUNT).toBe(CDP_MODULES.reduce((sum, m) => sum + m.questions.length, 0));
    expect(CDP_TOTAL_QUESTION_COUNT).toBeGreaterThan(100);
  });

  it("keeps the reconciled flag consistent with the confirmed count", () => {
    expect(CDP_REGISTRY_RECONCILED).toBe(CDP_CONFIRMED_QUESTION_COUNT === CDP_TOTAL_QUESTION_COUNT);
  });
});

describe("CDP registry — the notices say what they must", () => {
  /**
   * These three strings are the guard against the platform implying an
   * obligation that does not exist. The CSRD equivalent had to state the
   * Omnibus thresholds; CDP's failure mode is worse, because CDP is not a
   * regulator at all. Asserting on the substance rather than the wording, so
   * the copy can be edited but not hollowed out.
   */
  it("states plainly that CDP is voluntary and buyer-driven, not a mandate", () => {
    expect(CDP_APPLICABILITY_NOTICE).toMatch(/voluntary/i);
    expect(CDP_APPLICABILITY_NOTICE).toMatch(/not a legal or regulatory obligation/i);
    expect(CDP_APPLICABILITY_NOTICE).toMatch(/customer or investor/i);
  });

  it("states that this module prepares a response but does not submit it", () => {
    expect(CDP_SUBMISSION_NOTICE).toMatch(/does not submit/i);
    expect(CDP_SUBMISSION_NOTICE).toMatch(/CDP's own online response platform/i);
    expect(CDP_SUBMISSION_NOTICE).toMatch(/no PDF upload route/i);
  });

  it("disclaims any relationship to CDP's own A-to-D- score", () => {
    expect(CDP_SCORING_NOTICE).toMatch(/does not predict, estimate or replicate/i);
    expect(CDP_SCORING_NOTICE).toMatch(/not a CDP grade/i);
  });
});
