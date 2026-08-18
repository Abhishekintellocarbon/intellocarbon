import type { GriWasteDisclosure, BrsrCoreReport } from "@prisma/client";

/**
 * Circularity rate — the share of waste kept out of disposal.
 *
 * Reuses waste data the platform already collects rather than asking for it
 * again. Two sources exist and they do NOT mean the same thing, which is the
 * whole difficulty here:
 *
 *   GRI 306 (preferred) splits waste into "diverted from disposal" (reuse,
 *   recycling, other recovery) and "directed to disposal" (incineration with
 *   and without energy recovery, landfill, other), each further split by
 *   hazardous and non-hazardous. That is exactly the numerator and denominator
 *   a circularity rate needs.
 *
 *   BRSR Core (fallback) has only wasteGeneratedTonnes and
 *   wasteRecoveredTonnes. "Recovered" is close to "diverted" but not identical
 *   — under GRI, incineration WITH energy recovery is directed to disposal,
 *   while a BRSR preparer may reasonably count it as recovered.
 *
 * So the rate carries its source, and the UI states it. Silently blending the
 * two would produce a number that changes meaning depending on which
 * disclosure a facility happened to file, with nothing on screen to say so.
 */

export type CircularitySource = "GRI_306" | "BRSR_CORE";

export interface CircularityRollup {
  hasData: boolean;
  source: CircularitySource | null;
  periodLabel: string | null;
  generatedTonnes: number;
  divertedTonnes: number;
  disposalTonnes: number;
  hazardousTonnes: number | null;
  /** Diverted as a share of generated, 0-100. Null when nothing was generated. */
  circularityRatePct: number | null;
  /** Facilities contributing to the figures above. */
  facilityCount: number;
  /**
   * True when the rate came from BRSR's coarser "recovered" figure rather than
   * GRI 306's explicit diversion split. The card says so — see the note above.
   */
  approximated: boolean;
}

const round = (value: number, decimals = 3) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const sum = (...values: (number | null | undefined)[]): number =>
  values.reduce<number>((total, v) => total + (v ?? 0), 0);

/** GRI 306-4: waste diverted from disposal, both waste streams. */
export const griDivertedTonnes = (w: GriWasteDisclosure): number =>
  sum(
    w.hazardousDivertedReuseT,
    w.hazardousDivertedRecyclingT,
    w.hazardousDivertedOtherRecoveryT,
    w.nonHazardousDivertedReuseT,
    w.nonHazardousDivertedRecyclingT,
    w.nonHazardousDivertedOtherRecoveryT,
  );

/** GRI 306-5: waste directed to disposal, both waste streams. */
export const griDisposalTonnes = (w: GriWasteDisclosure): number =>
  sum(
    w.hazardousDisposalIncinerationWithRecoveryT,
    w.hazardousDisposalIncinerationNoRecoveryT,
    w.hazardousDisposalLandfillT,
    w.hazardousDisposalOtherT,
    w.nonHazardousDisposalIncinerationWithRecoveryT,
    w.nonHazardousDisposalIncinerationNoRecoveryT,
    w.nonHazardousDisposalLandfillT,
    w.nonHazardousDisposalOtherT,
  );

/** The hazardous stream across both fates, for the split shown on the card. */
export const griHazardousTonnes = (w: GriWasteDisclosure): number =>
  sum(
    w.hazardousDivertedReuseT,
    w.hazardousDivertedRecyclingT,
    w.hazardousDivertedOtherRecoveryT,
    w.hazardousDisposalIncinerationWithRecoveryT,
    w.hazardousDisposalIncinerationNoRecoveryT,
    w.hazardousDisposalLandfillT,
    w.hazardousDisposalOtherT,
  );

const EMPTY: CircularityRollup = {
  hasData: false,
  source: null,
  periodLabel: null,
  generatedTonnes: 0,
  divertedTonnes: 0,
  disposalTonnes: 0,
  hazardousTonnes: null,
  circularityRatePct: null,
  facilityCount: 0,
  approximated: false,
};

type GriWasteRow = GriWasteDisclosure & { reportingPeriod: string };
type BrsrWasteRow = Pick<BrsrCoreReport, "reportingPeriod" | "wasteGeneratedTonnes" | "wasteRecoveredTonnes">;

/**
 * Builds the rollup for the most recent period that has any waste data.
 *
 * Scoped to a single period rather than summed across all of them: a
 * circularity rate blended over several years describes no year in
 * particular, and the card sits next to other "current position" figures that
 * are all period-scoped.
 */
export const buildCircularityRollup = (griRows: GriWasteRow[], brsrRows: BrsrWasteRow[]): CircularityRollup => {
  // GRI first, and only for the latest period it covers. Mixing a GRI period
  // with a BRSR period would put two different definitions in one number.
  const griPeriods = [...new Set(griRows.map((r) => r.reportingPeriod))].sort();
  const latestGriPeriod = griPeriods.at(-1) ?? null;

  if (latestGriPeriod) {
    const rows = griRows.filter((r) => r.reportingPeriod === latestGriPeriod);
    const diverted = rows.reduce((total, r) => total + griDivertedTonnes(r), 0);
    const disposal = rows.reduce((total, r) => total + griDisposalTonnes(r), 0);
    const hazardous = rows.reduce((total, r) => total + griHazardousTonnes(r), 0);
    const generated = diverted + disposal;

    if (generated > 0) {
      return {
        hasData: true,
        source: "GRI_306",
        periodLabel: latestGriPeriod,
        generatedTonnes: round(generated),
        divertedTonnes: round(diverted),
        disposalTonnes: round(disposal),
        hazardousTonnes: round(hazardous),
        circularityRatePct: round((diverted / generated) * 100, 1),
        facilityCount: rows.length,
        approximated: false,
      };
    }
  }

  const brsrWithWaste = brsrRows.filter((r) => (r.wasteGeneratedTonnes ?? 0) > 0);
  const brsrPeriods = [...new Set(brsrWithWaste.map((r) => r.reportingPeriod))].sort();
  const latestBrsrPeriod = brsrPeriods.at(-1) ?? null;

  if (latestBrsrPeriod) {
    const rows = brsrWithWaste.filter((r) => r.reportingPeriod === latestBrsrPeriod);
    const generated = rows.reduce((total, r) => total + (r.wasteGeneratedTonnes ?? 0), 0);
    const recovered = rows.reduce((total, r) => total + (r.wasteRecoveredTonnes ?? 0), 0);

    if (generated > 0) {
      // Clamped: a preparer can enter recovered > generated, and a rate above
      // 100% would read as a data-quality problem in the card rather than in
      // the entry form where it belongs.
      const diverted = Math.min(recovered, generated);
      return {
        hasData: true,
        source: "BRSR_CORE",
        periodLabel: latestBrsrPeriod,
        generatedTonnes: round(generated),
        divertedTonnes: round(diverted),
        disposalTonnes: round(generated - diverted),
        // BRSR Core does not split hazardous from non-hazardous, so this stays
        // null rather than being reported as zero.
        hazardousTonnes: null,
        circularityRatePct: round((diverted / generated) * 100, 1),
        facilityCount: rows.length,
        approximated: true,
      };
    }
  }

  return EMPTY;
};

export const CIRCULARITY_SOURCE_LABELS: Record<CircularitySource, string> = {
  GRI_306: "GRI 306 waste disclosure",
  BRSR_CORE: "BRSR Core (Attribute 3)",
};

/** Shown under the rate so the number is never read without its definition. */
export const CIRCULARITY_SOURCE_NOTES: Record<CircularitySource, string> = {
  GRI_306:
    "Diverted from disposal (reuse, recycling and other recovery) as a share of total waste generated, per GRI 306-4 and 306-5.",
  BRSR_CORE:
    "Based on BRSR Core's recovered figure, which is close to but not the same as GRI's diverted from disposal — BRSR preparers may count incineration with energy recovery as recovered, where GRI treats it as disposal. File a GRI 306 disclosure for an exact rate.",
};
