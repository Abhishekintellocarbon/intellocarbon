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

/**
 * One reporting period on the circularity trend.
 *
 * `facilityCount` travels with every point rather than only with the headline.
 * A rate can move because diversion genuinely improved, or because a facility
 * started (or stopped) reporting waste that period — those look identical on a
 * line chart, and only the count distinguishes them. The card compares each
 * point against the latest and says so when coverage changed.
 */
export interface CircularityPoint {
  periodLabel: string;
  generatedTonnes: number;
  divertedTonnes: number;
  disposalTonnes: number;
  circularityRatePct: number;
  facilityCount: number;
}

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
  /**
   * Every period available from the SAME source as the headline rate, oldest
   * first, with the headline period last.
   *
   * Single-source by construction. A trend that took GRI for the years it
   * exists and fell back to BRSR for the earlier ones would draw a step at the
   * switchover that is a change of definition, not a change in performance —
   * which is the exact failure the source split at the top of this file exists
   * to prevent. A company that filed GRI only for the latest year therefore
   * gets a one-point trend, and the card renders no chart rather than a
   * misleading two-point line.
   */
  trend: CircularityPoint[];
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
  trend: [],
};

type GriWasteRow = GriWasteDisclosure & { reportingPeriod: string };
type BrsrWasteRow = Pick<BrsrCoreReport, "reportingPeriod" | "wasteGeneratedTonnes" | "wasteRecoveredTonnes">;

/**
 * Every GRI period as its own point. Periods where nothing was generated are
 * dropped rather than plotted as a 0% rate — no waste generated is not a
 * circularity failure, and a zero on the line would read as one.
 */
const griSeries = (rows: GriWasteRow[]): CircularityPoint[] =>
  [...new Set(rows.map((r) => r.reportingPeriod))]
    .sort()
    .map((periodLabel) => {
      const periodRows = rows.filter((r) => r.reportingPeriod === periodLabel);
      const diverted = periodRows.reduce((total, r) => total + griDivertedTonnes(r), 0);
      const disposal = periodRows.reduce((total, r) => total + griDisposalTonnes(r), 0);
      const generated = diverted + disposal;
      return {
        periodLabel,
        generatedTonnes: round(generated),
        divertedTonnes: round(diverted),
        disposalTonnes: round(disposal),
        circularityRatePct: generated > 0 ? round((diverted / generated) * 100, 1) : 0,
        facilityCount: periodRows.length,
      };
    })
    // Rounded to 3dp, so this drops sub-gram periods too — which are entry
    // noise rather than a reporting period worth plotting.
    .filter((point) => point.generatedTonnes > 0);

/** The BRSR equivalent, with the same clamp the headline rate applies. */
const brsrSeries = (rows: BrsrWasteRow[]): CircularityPoint[] =>
  [...new Set(rows.map((r) => r.reportingPeriod))]
    .sort()
    .map((periodLabel) => {
      const periodRows = rows.filter((r) => r.reportingPeriod === periodLabel);
      const generated = periodRows.reduce((total, r) => total + (r.wasteGeneratedTonnes ?? 0), 0);
      const recovered = periodRows.reduce((total, r) => total + (r.wasteRecoveredTonnes ?? 0), 0);
      const diverted = Math.min(recovered, generated);
      return {
        periodLabel,
        generatedTonnes: round(generated),
        divertedTonnes: round(diverted),
        disposalTonnes: round(generated - diverted),
        circularityRatePct: generated > 0 ? round((diverted / generated) * 100, 1) : 0,
        facilityCount: periodRows.length,
      };
    })
    .filter((point) => point.generatedTonnes > 0);

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
        // GRI only — never topped up with BRSR periods. See the field comment.
        trend: griSeries(griRows),
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
        trend: brsrSeries(brsrWithWaste),
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
