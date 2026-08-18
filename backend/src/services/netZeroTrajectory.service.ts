import type { CompanyTarget } from "@prisma/client";
import { allowedEmissionsFor, type ActualEmissionsPoint } from "./companyTarget.service";

/**
 * Emissions history plotted against the stated target path.
 *
 * ===========================================================================
 * THE PATH EXTENDS FORWARD. THE ACTUALS DO NOT.
 *
 * The target line runs from baseline year to target year because that is what
 * the company committed to — it is a statement, not a prediction. The actual
 * series stops dead at the last year with submitted data.
 *
 * This asymmetry is the whole point. Continuing the actual line forward — by
 * trend-fitting, by assuming last year's rate persists, by any means — would
 * turn a record of what happened into a forecast of what will, and this
 * platform has no basis for that. A reader would then see two lines converging
 * or diverging and read it as an assessment of whether the target will be met.
 * The honest chart shows where the company IS against where it SAID it would
 * be, and stops there.
 * ===========================================================================
 *
 * The path is a straight line for the reason given in companyTarget.service:
 * that is what a target of the form "X% by YEAR against BASELINE" states, and
 * curving it would insert the platform's assumption between the company and
 * its own commitment.
 */

export interface TrajectoryPoint {
  year: number;
  /** Submitted emissions. Null for years with no data, including every future year. */
  actualTco2e: number | null;
  /** The straight-line allowance. Null outside the target's own span. */
  pathTco2e: number | null;
}

export interface NetZeroTrajectory {
  hasData: boolean;
  points: TrajectoryPoint[];
  baselineYear: number | null;
  targetYear: number | null;
  targetLabel: string | null;
  isNetZero: boolean;
  /** Last year with submitted data — where the actual series stops. */
  latestActualYear: number | null;
  /** Reason there is nothing to plot, when there is not. */
  unavailableReason: string | null;
}

const EMPTY: NetZeroTrajectory = {
  hasData: false,
  points: [],
  baselineYear: null,
  targetYear: null,
  targetLabel: null,
  isNetZero: false,
  latestActualYear: null,
  unavailableReason: null,
};

/**
 * Chooses the target to plot: the furthest-out trackable absolute target,
 * preferring a net-zero commitment.
 *
 * Furthest rather than nearest, unlike the progress tracker's primary target —
 * a trajectory chart is about the long arc, and plotting a 2030 interim target
 * when a 2050 net-zero commitment exists would cut the picture short.
 */
export const selectTrajectoryTarget = (targets: CompanyTarget[]): CompanyTarget | null => {
  const plottable = targets.filter(
    (t) =>
      t.status === "SUBMITTED" &&
      t.kind === "ABSOLUTE" &&
      t.reductionPct != null &&
      t.targetYear > t.baselineYear &&
      t.baselineEmissionsTco2e > 0,
  );
  if (plottable.length === 0) return null;

  const netZero = plottable.filter((t) => t.isNetZero).sort((a, b) => b.targetYear - a.targetYear);
  if (netZero.length > 0) return netZero[0];

  return plottable.sort((a, b) => b.targetYear - a.targetYear)[0];
};

export const buildNetZeroTrajectory = (
  targets: CompanyTarget[],
  actuals: ActualEmissionsPoint[],
): NetZeroTrajectory => {
  const target = selectTrajectoryTarget(targets);

  if (!target) {
    return {
      ...EMPTY,
      unavailableReason:
        targets.length > 0
          ? "None of your targets can be plotted — a trajectory needs a submitted absolute target with a baseline, a target year after it, and a stated reduction percentage."
          : "Set a reduction target and your emissions history is plotted against it here.",
    };
  }

  const actualByYear = new Map(actuals.map((a) => [a.year, a.totalTco2e]));
  const latestActualYear = actuals.length > 0 ? Math.max(...actuals.map((a) => a.year)) : null;

  // The chart spans the baseline through the target year, plus any actual
  // data sitting outside that window so nothing submitted is hidden.
  const firstYear = Math.min(target.baselineYear, ...(actuals.length > 0 ? actuals.map((a) => a.year) : [target.baselineYear]));
  const lastYear = Math.max(target.targetYear, latestActualYear ?? target.targetYear);

  const points: TrajectoryPoint[] = [];
  for (let year = firstYear; year <= lastYear; year++) {
    points.push({
      year,
      // Only years with submitted data carry an actual. Future years are
      // null — never an extrapolation.
      actualTco2e: actualByYear.get(year) ?? null,
      pathTco2e: allowedEmissionsFor(target, year),
    });
  }

  return {
    hasData: true,
    points,
    baselineYear: target.baselineYear,
    targetYear: target.targetYear,
    targetLabel: target.isNetZero
      ? `Net zero by ${target.targetYear}`
      : `${target.reductionPct}% reduction by ${target.targetYear}`,
    isNetZero: target.isNetZero,
    latestActualYear,
    unavailableReason: null,
  };
};

/** Rendered with the chart. Asserted on substance by tests. */
export const TRAJECTORY_NOTICE =
  "The target line is what you have committed to, drawn straight from baseline to target year. Your actual " +
  "emissions are plotted only for years you have submitted data for and are not projected forward — this shows " +
  "where you are against where you said you would be, not a forecast of whether the target will be met.";
