import { describe, it, expect } from "vitest";
import {
  CDP_MODULES,
  CDP_MODULE_CODES,
  CDP_TOTAL_QUESTION_COUNT,
  CDP_CONFIRMED_QUESTION_COUNT,
  CDP_REGISTRY_RECONCILED,
  CDP_APPLICABILITY_NOTICE,
  CDP_SUBMISSION_NOTICE,
  CDP_SCORING_NOTICE,
  CDP_MATURITY_BANDS,
  CDP_MATURITY_BAND_LABELS,
  getCdpModule,
} from "../cdp-questionnaire";

/**
 * This file is generated from the backend registry by
 * backend/src/scripts/generateCdpMirror.ts. These tests guard the properties
 * the form depends on, so a bad regeneration fails here rather than showing up
 * as a question that silently will not render or will not save.
 */

describe("the mirror is structurally usable by the form", () => {
  it("covers the questionnaire modules the backend does", () => {
    expect(CDP_MODULE_CODES).toEqual([
      "C0",
      "C1",
      "C2",
      "C3",
      "C4",
      "C5",
      "C6",
      "C7",
      "C8",
      "C9",
      "C10",
      "C11",
      "C12",
      "C15",
    ]);
  });

  it("resolves a module by code", () => {
    expect(getCdpModule("C6")?.title).toBe("Emissions data");
    expect(getCdpModule("C13")).toBeUndefined();
  });

  it("uses a globally unique question code", () => {
    const codes = CDP_MODULES.flatMap((m) => m.questions.map((q) => q.code));
    expect(new Set(codes).size).toBe(codes.length);
  });

  /**
   * The form renders a select from `options`. A select with none renders an
   * empty dropdown the user cannot answer.
   */
  it("gives every select question a non-empty option list", () => {
    for (const mod of CDP_MODULES) {
      for (const question of mod.questions) {
        if (question.type === "select") {
          expect(question.options?.length, `${question.code} has no options`).toBeGreaterThan(0);
        }
      }
    }
  });

  /**
   * Derived questions are excluded from the form — they are calculated
   * server-side. If one were missing that flag it would render as an empty
   * input the user could type a conflicting figure into.
   */
  it("marks the reused figures as derived so the form does not ask for them", () => {
    const derived = CDP_MODULES.flatMap((m) => m.questions.filter((q) => q.derived).map((q) => q.code));
    expect(derived).toContain("C6.1");
    expect(derived).toContain("C6.3");
    expect(derived).toContain("C6.5");
    expect(derived).toContain("C8.2a");
    expect(derived).toContain("C11.2a");
  });

  it("marks only the reporting window as constant", () => {
    const constant = CDP_MODULES.flatMap((m) => m.questions.filter((q) => q.constant).map((q) => q.code));
    expect(constant).toEqual(["C0.2"]);
  });

  it("marks only C9 optional", () => {
    expect(CDP_MODULES.filter((m) => m.optional).map((m) => m.code)).toEqual(["C9"]);
  });
});

describe("provenance is carried through to the UI", () => {
  /**
   * The banner telling a responder to match questions by subject matter rather
   * than by number is driven by this flag. If the mirror ever reported the
   * registry as reconciled while the backend did not, that banner would
   * disappear and users would trust numbering that has not been checked.
   */
  it("reports the registry as unreconciled while any question is PENDING_SOURCE", () => {
    expect(CDP_CONFIRMED_QUESTION_COUNT).toBe(0);
    expect(CDP_REGISTRY_RECONCILED).toBe(false);
    expect(CDP_MODULES.every((m) => m.questions.every((q) => q.status === "PENDING_SOURCE"))).toBe(true);
  });

  it("counts every question", () => {
    expect(CDP_TOTAL_QUESTION_COUNT).toBe(CDP_MODULES.reduce((sum, m) => sum + m.questions.length, 0));
    expect(CDP_TOTAL_QUESTION_COUNT).toBeGreaterThan(100);
  });
});

describe("the notices shown wherever CDP is offered", () => {
  /**
   * These three strings are what stop the product implying CDP is a mandate.
   * They are asserted on substance rather than exact wording, so the copy can
   * be edited but not hollowed out.
   */
  it("states plainly that CDP is voluntary and buyer-driven", () => {
    expect(CDP_APPLICABILITY_NOTICE).toMatch(/voluntary/i);
    expect(CDP_APPLICABILITY_NOTICE).toMatch(/not a legal or regulatory obligation/i);
  });

  it("states that the module prepares a response but does not submit it", () => {
    expect(CDP_SUBMISSION_NOTICE).toMatch(/does not submit/i);
    expect(CDP_SUBMISSION_NOTICE).toMatch(/no PDF upload route/i);
  });

  it("disclaims any relationship to CDP's own A-to-D- score", () => {
    expect(CDP_SCORING_NOTICE).toMatch(/not a CDP grade/i);
  });
});

describe("maturity bands", () => {
  it("has a label for every band, and none of them looks like a CDP grade", () => {
    for (const band of CDP_MATURITY_BANDS) {
      const label = CDP_MATURITY_BAND_LABELS[band];
      expect(label).toBeTruthy();
      // A single letter A-F would read as a CDP score at a glance.
      expect(label).not.toMatch(/^[A-F][+-]?$/);
    }
  });

  it("orders the bands weakest to strongest, which the cap logic relies on", () => {
    expect(CDP_MATURITY_BANDS).toEqual(["NOT_STARTED", "DEVELOPING", "ESTABLISHED", "STRONG"]);
  });
});
