import { describe, it, expect } from "vitest";
import { generateReportSchema } from "../report.validators";
import { REPORT_TYPES } from "../../services/reportGeneration.service";

/**
 * The generate-report validator and the list of report types a facility is
 * offered have to agree.
 *
 * They drifted once already: REPORT_TYPES gained UK_CBAM and the UI rendered a
 * "UK CBAM Return" card, but the validator still listed only CBAM/CCTS/BRSR, so
 * clicking that card returned 400 "Select a valid report type" — a card that
 * could never work. Nothing failed at compile time, because the two are a Zod
 * enum and a TypeScript array that never reference each other.
 */
describe("generateReportSchema", () => {
  it("accepts every report type a facility can be offered a card for", () => {
    for (const type of REPORT_TYPES) {
      const result = generateReportSchema.safeParse({ reportType: type });
      expect(result.success, `${type} is offered as a card but rejected by the validator`).toBe(true);
    }
  });

  it("rejects a type that is not offered", () => {
    // GRI and CSRD are built correctly by the dispatch but are downloaded from
    // their own ESG endpoints, so this endpoint must not accept them.
    expect(generateReportSchema.safeParse({ reportType: "GRI" }).success).toBe(false);
    expect(generateReportSchema.safeParse({ reportType: "CSRD" }).success).toBe(false);
    expect(generateReportSchema.safeParse({ reportType: "NOT_A_REPORT" }).success).toBe(false);
  });
});
