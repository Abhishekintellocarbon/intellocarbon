import { describe, it, expect } from "vitest";
import {
  buildCircularityRollup,
  griDivertedTonnes,
  griDisposalTonnes,
  griHazardousTonnes,
  CIRCULARITY_SOURCE_NOTES,
} from "../wasteCircularity.service";
import type { GriWasteDisclosure } from "@prisma/client";

/**
 * The circularity rate reuses two waste sources that do not mean the same
 * thing. GRI 306 splits diverted from disposal explicitly; BRSR Core has only
 * a coarser "recovered" figure. The rate is therefore only meaningful
 * alongside its source, and these tests protect that: which source won, that
 * the two are never blended, and that an approximated rate says so.
 */

const griRow = (over: Partial<GriWasteDisclosure> & { reportingPeriod: string }) =>
  ({
    hazardousDivertedReuseT: null,
    hazardousDivertedRecyclingT: null,
    hazardousDivertedOtherRecoveryT: null,
    hazardousDisposalIncinerationWithRecoveryT: null,
    hazardousDisposalIncinerationNoRecoveryT: null,
    hazardousDisposalLandfillT: null,
    hazardousDisposalOtherT: null,
    nonHazardousDivertedReuseT: null,
    nonHazardousDivertedRecyclingT: null,
    nonHazardousDivertedOtherRecoveryT: null,
    nonHazardousDisposalIncinerationWithRecoveryT: null,
    nonHazardousDisposalIncinerationNoRecoveryT: null,
    nonHazardousDisposalLandfillT: null,
    nonHazardousDisposalOtherT: null,
    ...over,
  }) as GriWasteDisclosure & { reportingPeriod: string };

describe("GRI 306 component sums", () => {
  const row = griRow({
    reportingPeriod: "FY2025-26",
    hazardousDivertedRecyclingT: 10,
    nonHazardousDivertedReuseT: 30,
    hazardousDisposalLandfillT: 5,
    nonHazardousDisposalIncinerationNoRecoveryT: 15,
  });

  it("sums diverted across both waste streams", () => {
    expect(griDivertedTonnes(row)).toBe(40);
  });

  it("sums directed-to-disposal across both waste streams", () => {
    expect(griDisposalTonnes(row)).toBe(20);
  });

  it("counts the hazardous stream across both fates", () => {
    expect(griHazardousTonnes(row)).toBe(15);
  });

  /**
   * GRI treats incineration WITH energy recovery as directed to disposal, not
   * as diverted. Getting this backwards would overstate every circularity
   * rate, so it is pinned explicitly.
   */
  it("counts incineration with energy recovery as disposal, not diversion", () => {
    const r = griRow({ reportingPeriod: "FY2025-26", hazardousDisposalIncinerationWithRecoveryT: 100 });
    expect(griDisposalTonnes(r)).toBe(100);
    expect(griDivertedTonnes(r)).toBe(0);
  });
});

describe("source precedence", () => {
  it("prefers GRI 306 when both sources exist", () => {
    const result = buildCircularityRollup(
      [griRow({ reportingPeriod: "FY2025-26", nonHazardousDivertedRecyclingT: 75, nonHazardousDisposalLandfillT: 25 })],
      [{ reportingPeriod: "FY2025-26", wasteGeneratedTonnes: 999, wasteRecoveredTonnes: 999 }],
    );
    expect(result.source).toBe("GRI_306");
    expect(result.circularityRatePct).toBe(75);
    expect(result.approximated).toBe(false);
    // The BRSR figures must not have leaked into the totals.
    expect(result.generatedTonnes).toBe(100);
  });

  it("falls back to BRSR Core and marks the rate approximated", () => {
    const result = buildCircularityRollup(
      [],
      [{ reportingPeriod: "FY2025-26", wasteGeneratedTonnes: 200, wasteRecoveredTonnes: 50 }],
    );
    expect(result.source).toBe("BRSR_CORE");
    expect(result.circularityRatePct).toBe(25);
    expect(result.approximated).toBe(true);
    // BRSR has no hazardous split — null, never a misleading zero.
    expect(result.hazardousTonnes).toBeNull();
  });

  /**
   * The load-bearing property. Blending a GRI period with a BRSR period would
   * put two different definitions of "diverted" into one number, with nothing
   * on screen to say which applied.
   */
  it("never blends the two sources, even across different periods", () => {
    const result = buildCircularityRollup(
      [griRow({ reportingPeriod: "FY2024-25", nonHazardousDivertedRecyclingT: 10, nonHazardousDisposalLandfillT: 10 })],
      [{ reportingPeriod: "FY2025-26", wasteGeneratedTonnes: 500, wasteRecoveredTonnes: 400 }],
    );
    expect(result.source).toBe("GRI_306");
    expect(result.periodLabel).toBe("FY2024-25");
    expect(result.generatedTonnes).toBe(20);
  });

  it("uses the latest GRI period when several exist", () => {
    const result = buildCircularityRollup(
      [
        griRow({ reportingPeriod: "FY2023-24", nonHazardousDivertedRecyclingT: 10, nonHazardousDisposalLandfillT: 90 }),
        griRow({ reportingPeriod: "FY2025-26", nonHazardousDivertedRecyclingT: 90, nonHazardousDisposalLandfillT: 10 }),
      ],
      [],
    );
    expect(result.periodLabel).toBe("FY2025-26");
    expect(result.circularityRatePct).toBe(90);
  });

  it("sums every facility within the chosen period", () => {
    const result = buildCircularityRollup(
      [
        griRow({ reportingPeriod: "FY2025-26", nonHazardousDivertedRecyclingT: 40, nonHazardousDisposalLandfillT: 10 }),
        griRow({ reportingPeriod: "FY2025-26", nonHazardousDivertedRecyclingT: 10, nonHazardousDisposalLandfillT: 40 }),
      ],
      [],
    );
    expect(result.facilityCount).toBe(2);
    expect(result.generatedTonnes).toBe(100);
    expect(result.circularityRatePct).toBe(50);
  });
});

describe("no data and edge cases", () => {
  /**
   * The card must show "no waste data" rather than 0%, which would read as
   * "you divert nothing" — a claim about the company rather than about the
   * absence of a disclosure.
   */
  it("reports no data rather than a zero rate when nothing is filed", () => {
    const result = buildCircularityRollup([], []);
    expect(result.hasData).toBe(false);
    expect(result.circularityRatePct).toBeNull();
    expect(result.source).toBeNull();
  });

  it("treats a GRI row with all-null tonnages as no data", () => {
    const result = buildCircularityRollup([griRow({ reportingPeriod: "FY2025-26" })], []);
    expect(result.hasData).toBe(false);
  });

  it("ignores BRSR rows that report no waste generated", () => {
    const result = buildCircularityRollup([], [{ reportingPeriod: "FY2025-26", wasteGeneratedTonnes: 0, wasteRecoveredTonnes: 0 }]);
    expect(result.hasData).toBe(false);
  });

  /**
   * A preparer can key recovered above generated. Clamping keeps the card
   * honest at 100% instead of printing an impossible rate.
   */
  it("clamps a BRSR rate that would exceed 100%", () => {
    const result = buildCircularityRollup([], [{ reportingPeriod: "FY2025-26", wasteGeneratedTonnes: 100, wasteRecoveredTonnes: 150 }]);
    expect(result.circularityRatePct).toBe(100);
    expect(result.divertedTonnes).toBe(100);
    expect(result.disposalTonnes).toBe(0);
  });

  it("handles full diversion and zero diversion without dividing by zero", () => {
    const all = buildCircularityRollup([griRow({ reportingPeriod: "FY2025-26", nonHazardousDivertedReuseT: 50 })], []);
    expect(all.circularityRatePct).toBe(100);
    const none = buildCircularityRollup([griRow({ reportingPeriod: "FY2025-26", nonHazardousDisposalLandfillT: 50 })], []);
    expect(none.circularityRatePct).toBe(0);
    expect(none.hasData).toBe(true);
  });
});

describe("the source note travels with the number", () => {
  it("explains the GRI definition", () => {
    expect(CIRCULARITY_SOURCE_NOTES.GRI_306).toMatch(/306-4 and 306-5/);
  });

  /**
   * The BRSR note must name the specific way the two definitions diverge,
   * not just say "approximate" — otherwise a reader has no way to judge
   * whether the difference matters to them.
   */
  it("names how the BRSR figure differs rather than just calling it approximate", () => {
    expect(CIRCULARITY_SOURCE_NOTES.BRSR_CORE).toMatch(/incineration with energy recovery/i);
    expect(CIRCULARITY_SOURCE_NOTES.BRSR_CORE).toMatch(/GRI 306/);
  });
});
