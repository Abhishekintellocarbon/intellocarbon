/**
 * Reduction targets, self-reported SBTi status and the net-zero trajectory,
 * rendered identically wherever a report needs them.
 *
 * ===========================================================================
 * THIS IS NOT AN SBTi TOOL, AND THIS BLOCK MUST NOT READ LIKE ONE.
 *
 * `sbtiStatus` is the company's own account of where it stands with the
 * Science Based Targets initiative. Nothing on this platform checks it, and
 * no report may present it as validation. Every column and label here is
 * therefore marked self-reported, and TARGET_SELF_REPORTED_NOTICE is printed
 * with the table rather than being optional — see companyTarget.service for
 * the same rule at the source.
 * ===========================================================================
 *
 * Shared between the ISSB report (Metrics & Targets, IFRS S2 §33-36) and the
 * CDP pack (module C4, Targets and performance). Both frameworks ask for the
 * same four things — what the target is, what it covers, where the company
 * stands against it, and what it has told SBTi — so one block serves both and
 * they cannot drift apart.
 */
import type { CompanyTarget } from "@prisma/client";
import type { PageBuilder } from "../cbamReport/layout";
import { MARGIN_X, CONTENT_WIDTH, TEAL, fmt } from "../cbamReport/theme";
import { lineTrendChart, CHART_SLATE } from "../cbamReport/charts";
import {
  SBTI_STATUS_LABELS,
  TARGET_STATUS_LABELS,
  TARGET_SELF_REPORTED_NOTICE,
  type TargetProgress,
} from "../companyTarget.service";
import { TRAJECTORY_NOTICE, type NetZeroTrajectory } from "../netZeroTrajectory.service";

export interface TargetsBlockInput {
  targets: CompanyTarget[];
  targetProgress: TargetProgress[];
  trajectory: NetZeroTrajectory;
}

/**
 * The targets table. Renders nothing at all when no target has been submitted
 * — an empty table under a "Targets" heading reads as "we looked and there are
 * none", which is right, but a heading with nothing under it in a report a
 * customer paid for reads as a broken section. The caller decides what to say
 * in that case, in its own framework's words.
 */
export const hasTargetsToReport = (input: TargetsBlockInput): boolean =>
  input.targets.some((t) => t.status === "SUBMITTED");

export function drawTargetsTable(pb: PageBuilder, input: TargetsBlockInput) {
  const submitted = input.targets.filter((t) => t.status === "SUBMITTED");
  if (submitted.length === 0) return;

  const progressById = new Map(input.targetProgress.map((p) => [p.targetId, p]));

  pb.table({
    columns: [
      { header: "Scopes covered", width: 150 },
      { header: "Baseline", width: 85, align: "right" },
      { header: "Target", width: 95, align: "right" },
      { header: "Progress", width: 95 },
      { header: "SBTi (self-reported)", width: 70 },
    ],
    rows: submitted.map((t) => {
      const p = progressById.get(t.id);
      return [
        t.isNetZero ? `${t.scopesCovered} (net zero)` : t.scopesCovered,
        `${t.baselineYear} — ${fmt(t.baselineEmissionsTco2e, 0)}`,
        t.reductionPct != null ? `${fmt(t.reductionPct, 0)}% by ${t.targetYear}` : String(t.targetYear),
        p ? TARGET_STATUS_LABELS[p.status] : "Not tracked",
        // Deliberately the bare status word, not a tick or a badge. A badge in
        // an "SBTi" column is the exact visual that would read as validation.
        SBTI_STATUS_LABELS[t.sbtiStatus]?.replace(" (self-reported)", "") ?? t.sbtiStatus,
      ];
    }),
  });

  pb.note(TARGET_SELF_REPORTED_NOTICE);

  // Where a target is being tracked, the numbers behind the one-word progress
  // status. A status word with no figures under it is not auditable.
  const tracked = submitted
    .map((t) => ({ target: t, progress: progressById.get(t.id) }))
    .filter((row) => row.progress != null && row.progress.actualTco2e != null);

  if (tracked.length > 0) {
    pb.heading("Progress against the stated path");
    pb.table({
      columns: [
        { header: "Target", width: 160 },
        { header: "Latest year", width: 65, align: "right" },
        { header: "Actual", width: 80, align: "right" },
        { header: "Path allows", width: 85, align: "right" },
        { header: "Variance", width: 105, align: "right" },
      ],
      rows: tracked.map(({ target, progress }) => [
        target.isNetZero ? `Net zero by ${target.targetYear}` : `${fmt(target.reductionPct ?? 0, 0)}% by ${target.targetYear}`,
        String(progress!.actualYear ?? "—"),
        progress!.actualTco2e != null ? `${fmt(progress!.actualTco2e, 0)} tCO2e` : "—",
        progress!.allowedTco2e != null ? `${fmt(progress!.allowedTco2e, 0)} tCO2e` : "—",
        progress!.varianceTco2e != null
          ? `${progress!.varianceTco2e <= 0 ? "" : "+"}${fmt(progress!.varianceTco2e, 0)} tCO2e`
          : "—",
      ]),
    });
    pb.note("Variance is actual minus the straight-line allowance for the same year. A negative figure is ahead of the path.");
  }
}

/**
 * The trajectory chart: measured emissions solid, the committed path dashed.
 *
 * The two series are drawn differently on purpose — one is what the company
 * measured, the other is what it said it would do, and a chart that renders
 * them identically invites a reader to treat a commitment as a result. The
 * actual series stops at the last year with submitted data and is never
 * extended, matching netZeroTrajectory.service.
 */
export function drawTrajectoryChart(pb: PageBuilder, trajectory: NetZeroTrajectory) {
  if (!trajectory.hasData || trajectory.points.length === 0) {
    if (trajectory.unavailableReason) pb.paragraph(trajectory.unavailableReason, { size: 9.5 });
    return;
  }

  const actual = trajectory.points
    .filter((p) => p.actualTco2e != null)
    .map((p) => ({ x: p.year, y: p.actualTco2e! }));
  const path = trajectory.points.filter((p) => p.pathTco2e != null).map((p) => ({ x: p.year, y: p.pathTco2e! }));

  // One measured point is a dot, not a trend. The path alone is still worth
  // drawing — it is the commitment — but the chart says which is which.
  if (path.length === 0) return;

  pb.ensureSpace(230);
  pb.y = lineTrendChart(pb.doc, {
    x: MARGIN_X,
    y: pb.y,
    width: CONTENT_WIDTH,
    height: 170,
    xLabel: "Year",
    yLabel: "tCO2e",
    unit: "tCO2e",
    series: [
      ...(actual.length > 0 ? [{ label: "Measured emissions", color: TEAL, points: actual }] : []),
      { label: trajectory.targetLabel ?? "Target path", color: CHART_SLATE, dashed: true, points: path },
    ],
  });

  pb.note(TRAJECTORY_NOTICE);

  if (actual.length === 0) {
    pb.note(
      "No submitted emissions history falls inside this target's span yet, so only the committed path is drawn.",
    );
  }
}
