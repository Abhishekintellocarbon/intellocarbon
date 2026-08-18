import type { CompanyTarget } from "@prisma/client";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";
import { fyLabelFor, parseBrsrFyStartYear } from "../data/complianceDeadlines";

/**
 * Progress against a self-stated emissions reduction target.
 *
 * ===========================================================================
 * THIS IS NOT AN SBTi TOOL. Read before writing any copy against it.
 *
 * The Science Based Targets initiative validates targets against its own
 * criteria, through its own submission process. This platform does none of
 * that: it records what a company says its target is and compares actual
 * emissions against it. `sbtiStatus` is the company's own account of where it
 * stands with SBTi and is never evidence of validation.
 *
 * So nothing here may describe a target as "science-based", "approved",
 * "validated" or "aligned" on the platform's own authority. The same
 * discipline as CDP's readiness bands not being CDP scores, and for the same
 * reason: a compliance-adjacent claim the customer did not earn and nobody
 * checked is the one output this codebase must not produce.
 * ===========================================================================
 *
 * The comparison itself is a straight line from baseline to target. Real
 * decarbonisation is rarely linear, but a linear path is what a target of the
 * form "X% by YEAR against BASELINE" actually states, and inventing a curve
 * would put the platform's assumption between the company and its own number.
 */

export type TargetProgressStatus = "AHEAD" | "ON_TRACK" | "BEHIND" | "ACHIEVED" | "NOT_TRACKABLE";

export interface TargetProgress {
  targetId: string;
  status: TargetProgressStatus;
  /** Why the status is what it is, in the company's terms. */
  reason: string;
  /** Emissions the linear path allows in the latest year with actual data. */
  allowedTco2e: number | null;
  actualTco2e: number | null;
  actualYear: number | null;
  /** Reduction achieved so far against the baseline, as a percentage. */
  achievedReductionPct: number | null;
  /** Reduction the path required by the same year. */
  requiredReductionPct: number | null;
  /** Actual minus allowed. Negative is ahead of the path. */
  varianceTco2e: number | null;
  yearsRemaining: number | null;
}

const round = (value: number, decimals = 2) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

/**
 * The tolerance band around the path that still counts as on track.
 *
 * A target is a statement of intent measured once a year against numbers that
 * move for reasons other than decarbonisation — output, acquisitions, a
 * methodology change. Calling a company "behind" for being 1% off a straight
 * line would make the indicator noise. Five per cent is wide enough to absorb
 * that and narrow enough that a real drift shows.
 */
const TOLERANCE_PCT = 5;

export interface ActualEmissionsPoint {
  year: number;
  totalTco2e: number;
}

/**
 * Emissions the linear path allows in `year`.
 *
 * Before the baseline year the path is undefined rather than extrapolated
 * backwards — a target says nothing about the years before it starts.
 */
export const allowedEmissionsFor = (target: Pick<CompanyTarget, "baselineYear" | "baselineEmissionsTco2e" | "targetYear" | "reductionPct">, year: number): number | null => {
  if (target.reductionPct == null) return null;
  if (year < target.baselineYear) return null;
  if (target.targetYear <= target.baselineYear) return null;

  const targetEmissions = target.baselineEmissionsTco2e * (1 - target.reductionPct / 100);
  if (year >= target.targetYear) return round(targetEmissions);

  const elapsed = (year - target.baselineYear) / (target.targetYear - target.baselineYear);
  return round(target.baselineEmissionsTco2e - (target.baselineEmissionsTco2e - targetEmissions) * elapsed);
};

/**
 * Compares actual emissions against the path.
 *
 * Returns NOT_TRACKABLE rather than guessing whenever the comparison cannot
 * honestly be made — no reduction percentage, no actual data at or after the
 * baseline, or a baseline of zero. A status invented from missing data is
 * worse than no status, because it looks like an assessment.
 */
export const evaluateTargetProgress = (target: CompanyTarget, actuals: ActualEmissionsPoint[]): TargetProgress => {
  const base: TargetProgress = {
    targetId: target.id,
    status: "NOT_TRACKABLE",
    reason: "",
    allowedTco2e: null,
    actualTco2e: null,
    actualYear: null,
    achievedReductionPct: null,
    requiredReductionPct: null,
    varianceTco2e: null,
    yearsRemaining: null,
  };

  if (target.kind === "INTENSITY") {
    return {
      ...base,
      reason:
        "Intensity targets are recorded but not tracked here — tracking one needs the production denominator for every year, which this comparison does not read.",
    };
  }
  if (target.reductionPct == null) {
    return { ...base, reason: "No reduction percentage stated, so there is no path to compare against." };
  }
  if (target.targetYear <= target.baselineYear) {
    return { ...base, reason: "The target year is not after the baseline year." };
  }
  if (target.baselineEmissionsTco2e <= 0) {
    return { ...base, reason: "Baseline emissions are zero, so a percentage reduction has no meaning." };
  }

  // Latest actual at or after the baseline. Earlier years say nothing about a
  // target that starts later.
  const usable = actuals.filter((a) => a.year >= target.baselineYear && a.totalTco2e > 0).sort((a, b) => a.year - b.year);
  const latest = usable.at(-1);
  if (!latest) {
    return {
      ...base,
      reason: `No submitted emissions data from ${target.baselineYear} onward yet, so progress cannot be measured.`,
    };
  }

  const allowed = allowedEmissionsFor(target, latest.year);
  if (allowed == null) {
    return { ...base, reason: "The target path could not be resolved for the latest year with data." };
  }

  const achievedReductionPct = round(
    ((target.baselineEmissionsTco2e - latest.totalTco2e) / target.baselineEmissionsTco2e) * 100,
    1,
  );
  const requiredReductionPct = round(
    ((target.baselineEmissionsTco2e - allowed) / target.baselineEmissionsTco2e) * 100,
    1,
  );
  const variance = round(latest.totalTco2e - allowed);
  const yearsRemaining = Math.max(0, target.targetYear - latest.year);

  const targetEmissions = target.baselineEmissionsTco2e * (1 - target.reductionPct / 100);
  const tolerance = (allowed * TOLERANCE_PCT) / 100;

  let status: TargetProgressStatus;
  let reason: string;
  if (latest.totalTco2e <= targetEmissions) {
    status = "ACHIEVED";
    reason = `${latest.year} emissions are already at or below the ${target.targetYear} target level.`;
  } else if (variance < -tolerance) {
    status = "AHEAD";
    reason = `${latest.year} emissions are ${round(Math.abs(variance))} tCO2e below the straight-line path.`;
  } else if (variance > tolerance) {
    status = "BEHIND";
    reason = `${latest.year} emissions are ${round(variance)} tCO2e above the straight-line path.`;
  } else {
    status = "ON_TRACK";
    reason = `${latest.year} emissions are within ${TOLERANCE_PCT}% of the straight-line path.`;
  }

  return {
    targetId: target.id,
    status,
    reason,
    allowedTco2e: allowed,
    actualTco2e: round(latest.totalTco2e),
    actualYear: latest.year,
    achievedReductionPct,
    requiredReductionPct,
    varianceTco2e: variance,
    yearsRemaining,
  };
};

export const TARGET_STATUS_LABELS: Record<TargetProgressStatus, string> = {
  AHEAD: "Ahead of path",
  ON_TRACK: "On track",
  BEHIND: "Behind path",
  ACHIEVED: "Target met",
  NOT_TRACKABLE: "Not trackable yet",
};

/**
 * The disclaimer that must accompany any target status shown to a user.
 *
 * Asserted by tests on substance, so it can be reworded but not hollowed out.
 */
export const TARGET_SELF_REPORTED_NOTICE =
  "This is a self-reported target, tracked against your own submitted emissions data. Intellocarbon does not validate " +
  "targets and has no relationship with the Science Based Targets initiative — nothing here indicates SBTi approval, " +
  "validation or alignment. Any SBTi status shown is what you have told us about your own submission.";

export const SBTI_STATUS_LABELS: Record<string, string> = {
  NOT_SUBMITTED: "Not submitted to SBTi",
  COMMITTED: "Commitment letter submitted (self-reported)",
  SUBMITTED: "Target submitted to SBTi (self-reported)",
  VALIDATED: "Validated by SBTi (self-reported)",
};

/**
 * Precedence when a framework already carries its own copy of a target.
 *
 * The framework's own value wins where a preparer explicitly set it, and the
 * company target only fills the gap. That is the opposite of what "single
 * source of truth" first suggests, and it is deliberate: an ISSB report or a
 * CDP response that has been submitted is a disclosure someone signed, and
 * silently rewriting its stated target year from another table would change a
 * filed document after the fact. Going forward the entry flows point here, so
 * the duplication stops accumulating.
 */
export const resolveEffectiveTarget = <T>(frameworkValue: T | null | undefined, companyValue: T | null): T | null =>
  frameworkValue ?? companyValue ?? null;

// ---------------------------------------------------------------------------
// Data access
//
// Kept below the pure functions above so the trajectory arithmetic stays
// unit-testable without a database.
// ---------------------------------------------------------------------------

/**
 * Actual emissions per financial year, summed across the company's facilities.
 *
 * Scope 1 + 2 on the AR5 basis, matching what the targets are stated against
 * and what every other ESG surface here reports. Scope 3 is deliberately
 * excluded unless a target says it covers it — a target on Scope 1+2 measured
 * against a total including Scope 3 would look permanently behind.
 */
export const rollupAnnualEmissions = async (facilityIds: string[]): Promise<ActualEmissionsPoint[]> => {
  if (facilityIds.length === 0) return [];

  const rows = await prisma.activityData.findMany({
    where: { facilityId: { in: facilityIds }, status: "SUBMITTED" },
    select: { periodStart: true, calculationResult: true },
  });

  const byYear = new Map<number, number>();
  for (const row of rows) {
    if (!row.periodStart || !row.calculationResult) continue;
    const year = parseBrsrFyStartYear(fyLabelFor(row.periodStart));
    const scope12 =
      row.calculationResult.totalDirectCo2eAr5 +
      row.calculationResult.indirectElectricityCo2e +
      row.calculationResult.indirectSteamCo2e;
    byYear.set(year, (byYear.get(year) ?? 0) + scope12);
  }

  return Array.from(byYear.entries())
    .map(([year, totalTco2e]) => ({ year, totalTco2e: round(totalTco2e) }))
    .sort((a, b) => a.year - b.year);
};

export const listCompanyTargets = async (companyId: string, facilityIds: string[]) => {
  const [targets, actuals] = await Promise.all([
    prisma.companyTarget.findMany({ where: { companyId }, orderBy: [{ targetYear: "asc" }, { createdAt: "asc" }] }),
    rollupAnnualEmissions(facilityIds),
  ]);

  return {
    targets,
    actuals,
    progress: targets.map((t) => evaluateTargetProgress(t, actuals)),
    selfReportedNotice: TARGET_SELF_REPORTED_NOTICE,
  };
};

export type CompanyTargetInput = {
  kind?: "ABSOLUTE" | "INTENSITY";
  scopesCovered: string;
  baselineYear: number;
  baselineEmissionsTco2e: number;
  targetYear: number;
  reductionPct?: number | null;
  intensityMetric?: string | null;
  baselineIntensity?: number | null;
  targetIntensity?: number | null;
  isNetZero?: boolean;
  sbtiStatus?: "NOT_SUBMITTED" | "COMMITTED" | "SUBMITTED" | "VALIDATED";
  description?: string | null;
};

export const createCompanyTarget = async (companyId: string, input: CompanyTargetInput, submit: boolean) =>
  prisma.companyTarget.create({
    data: {
      companyId,
      kind: input.kind ?? "ABSOLUTE",
      scopesCovered: input.scopesCovered,
      baselineYear: input.baselineYear,
      baselineEmissionsTco2e: input.baselineEmissionsTco2e,
      targetYear: input.targetYear,
      reductionPct: input.reductionPct ?? null,
      intensityMetric: input.intensityMetric ?? null,
      baselineIntensity: input.baselineIntensity ?? null,
      targetIntensity: input.targetIntensity ?? null,
      isNetZero: input.isNetZero ?? false,
      sbtiStatus: input.sbtiStatus ?? "NOT_SUBMITTED",
      description: input.description ?? null,
      status: submit ? "SUBMITTED" : "DRAFT",
    },
  });

const requireOwnTarget = async (companyId: string, targetId: string) => {
  const existing = await prisma.companyTarget.findUnique({ where: { id: targetId } });
  if (!existing || existing.companyId !== companyId) throw AppError.notFound("Target not found");
  return existing;
};

export const updateCompanyTarget = async (
  companyId: string,
  targetId: string,
  input: CompanyTargetInput,
  submit: boolean,
) => {
  await requireOwnTarget(companyId, targetId);
  return prisma.companyTarget.update({
    where: { id: targetId },
    data: {
      kind: input.kind ?? "ABSOLUTE",
      scopesCovered: input.scopesCovered,
      baselineYear: input.baselineYear,
      baselineEmissionsTco2e: input.baselineEmissionsTco2e,
      targetYear: input.targetYear,
      reductionPct: input.reductionPct ?? null,
      intensityMetric: input.intensityMetric ?? null,
      baselineIntensity: input.baselineIntensity ?? null,
      targetIntensity: input.targetIntensity ?? null,
      isNetZero: input.isNetZero ?? false,
      sbtiStatus: input.sbtiStatus ?? "NOT_SUBMITTED",
      description: input.description ?? null,
      status: submit ? "SUBMITTED" : "DRAFT",
    },
  });
};

export const deleteCompanyTarget = async (companyId: string, targetId: string) => {
  await requireOwnTarget(companyId, targetId);
  await prisma.companyTarget.delete({ where: { id: targetId } });
};

/**
 * The company's canonical target for a framework to fall back on — the
 * nearest-term submitted absolute target. Frameworks use this only where they
 * have no explicit value of their own; see resolveEffectiveTarget.
 */
export const primaryCompanyTarget = async (companyId: string) =>
  prisma.companyTarget.findFirst({
    where: { companyId, status: "SUBMITTED", kind: "ABSOLUTE" },
    orderBy: [{ targetYear: "asc" }, { createdAt: "asc" }],
  });
