"use client";

import { Target } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DashboardEmptyState } from "../shared/dashboard-empty-state";
import type { CompanyTargetsSummary, TargetProgressStatus } from "@/lib/types";

const fmtCo2e = (n: number | null) =>
  n == null ? "—" : `${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })} tCO₂e`;

const STATUS_LABELS: Record<TargetProgressStatus, string> = {
  AHEAD: "Ahead of path",
  ON_TRACK: "On track",
  BEHIND: "Behind path",
  ACHIEVED: "Target met",
  NOT_TRACKABLE: "Not trackable yet",
};

const STATUS_CLASS: Record<TargetProgressStatus, string> = {
  AHEAD: "border-teal-500/30 bg-teal-500/10 text-teal-500",
  ACHIEVED: "border-teal-500/30 bg-teal-500/10 text-teal-500",
  ON_TRACK: "border-teal-500/20 bg-teal-500/5 text-teal-500",
  BEHIND: "border-amber-500/30 bg-amber-500/10 text-amber-500",
  NOT_TRACKABLE: "border-surface-border bg-surface-raised text-muted-foreground",
};

const SBTI_LABELS: Record<string, string> = {
  NOT_SUBMITTED: "Not submitted to SBTi",
  COMMITTED: "Commitment letter submitted (self-reported)",
  SUBMITTED: "Target submitted to SBTi (self-reported)",
  VALIDATED: "Validated by SBTi (self-reported)",
};

/**
 * Progress against self-stated reduction targets.
 *
 * The disclaimer sits with the status, not in a footnote. A badge reading "On
 * track" next to the letters SBTi reads as an endorsement unless the card says
 * otherwise in the same glance — and this platform neither validates targets
 * nor has any relationship with the Science Based Targets initiative. Every
 * SBTi status shown is what the company told us about its own submission.
 */
export function TargetProgressCard({ targets }: { targets: CompanyTargetsSummary }) {
  return (
    <Card className="rounded-[12px] p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Reduction targets</h2>
        <span className="text-xs text-muted-foreground">Self-reported</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Progress against the targets you have stated, measured on your own submitted Scope 1 and 2 data.
      </p>

      {targets.targets.length > 0 ? (
        <>
          <div className="mt-5 space-y-3">
            {targets.targets.map((target) => {
              const progress = targets.progress.find((p) => p.targetId === target.id);
              const status = progress?.status ?? "NOT_TRACKABLE";
              return (
                <div key={target.id} className="rounded-xl border border-surface-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {target.reductionPct != null ? `${target.reductionPct}% by ${target.targetYear}` : `Target ${target.targetYear}`}
                        {target.isNetZero && <span className="ml-2 text-xs text-teal-500">Net zero</span>}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {target.scopesCovered} · baseline {target.baselineYear} ({fmtCo2e(target.baselineEmissionsTco2e)})
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${STATUS_CLASS[status]}`}>
                      {STATUS_LABELS[status]}
                    </span>
                  </div>

                  {progress && (
                    <p className="mt-2.5 text-xs text-muted-foreground">{progress.reason}</p>
                  )}

                  {progress && progress.status !== "NOT_TRACKABLE" && (
                    <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-surface-border pt-3 sm:grid-cols-4">
                      <div>
                        <dt className="text-xs text-muted-foreground">Latest ({progress.actualYear})</dt>
                        <dd className="mt-0.5 text-sm font-medium">{fmtCo2e(progress.actualTco2e)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Path allows</dt>
                        <dd className="mt-0.5 text-sm font-medium">{fmtCo2e(progress.allowedTco2e)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Achieved</dt>
                        <dd className="mt-0.5 text-sm font-medium">
                          {progress.achievedReductionPct != null ? `${progress.achievedReductionPct}%` : "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Years left</dt>
                        <dd className="mt-0.5 text-sm font-medium">{progress.yearsRemaining ?? "—"}</dd>
                      </div>
                    </dl>
                  )}

                  {target.sbtiStatus !== "NOT_SUBMITTED" && (
                    <p className="mt-2.5 text-xs text-muted-foreground">{SBTI_LABELS[target.sbtiStatus]}</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Sits with the statuses, not below the fold. */}
          <p className="mt-4 border-t border-surface-border pt-4 text-xs text-amber-500">
            {targets.selfReportedNotice}
          </p>
        </>
      ) : (
        <DashboardEmptyState
          icon={Target}
          title="No reduction target set"
          description="Add a target — baseline year, target year and percentage — and progress against it is tracked automatically from your submitted emissions."
          ctaHref="/esg/data"
          ctaLabel="Add a target"
        />
      )}
    </Card>
  );
}
