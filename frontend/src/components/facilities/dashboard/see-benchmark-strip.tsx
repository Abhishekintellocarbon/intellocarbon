"use client";

import { Gauge } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DashboardEmptyState } from "@/components/dashboard/shared/dashboard-empty-state";
import type { FacilityDashboard } from "@/lib/types";

const fmtSee = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 3 });
// Percentages get one decimal — three is spurious precision on a ratio of two
// already-rounded intensities.
const fmtPct = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 1 });

/**
 * Facility SEE against the EU default for its sector and production route.
 *
 * Purely a new presentation of numbers the CBAM report already computes —
 * dashboard.cbam carries actualSee, defaultSee and the comparison direction
 * straight from computeCbamFinancialImpact. Nothing is calculated here beyond
 * the bar widths.
 */
export function SeeBenchmarkStrip({ dashboard }: { dashboard: FacilityDashboard }) {
  const { cbam } = dashboard;

  if (!cbam.hasData || cbam.actualSee == null || cbam.defaultSee == null) {
    return (
      <Card className="p-6">
        <h2 className="text-lg font-semibold">SEE vs EU default</h2>
        <DashboardEmptyState
          icon={Gauge}
          title="No SEE calculated yet"
          description="Submit activity data for this facility to compare your specific embedded emissions against the EU default."
          ctaHref={`/facilities/${dashboard.facility.id}/data-entry/new`}
          ctaLabel="Add activity data"
        />
      </Card>
    );
  }

  const actual = cbam.actualSee;
  const euDefault = cbam.defaultSee;
  const unit = cbam.seeUnit ?? "tCO2e/t";
  const better = cbam.isBetterThanDefault ?? actual <= euDefault;
  const variance = euDefault - actual;

  // Both bars share one scale so their lengths are directly comparable; the
  // headroom keeps the longer bar off the right edge.
  const scale = Math.max(actual, euDefault, 0.0001) * 1.15;
  const pct = (v: number) => `${Math.max(2, Math.min(100, (v / scale) * 100))}%`;

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">SEE vs EU default</h2>
        <span
          className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
            better ? "border-teal-500/30 bg-teal-500/10 text-teal-500" : "border-danger/30 bg-danger/10 text-danger"
          }`}
        >
          {better ? "Below EU default" : "Above EU default"}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Your specific embedded emissions against the EU default value for this sector and route
        {cbam.periodLabel ? ` — ${cbam.periodLabel}` : ""}.
      </p>

      <div className="mt-5 space-y-4">
        <div>
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-muted-foreground">Your SEE</span>
            <span className="font-medium tabular-nums">
              {fmtSee(actual)} <span className="text-xs text-muted">{unit}</span>
            </span>
          </div>
          <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-surface-raised">
            <div
              className={`h-full rounded-full ${better ? "bg-teal-500" : "bg-danger"}`}
              style={{ width: pct(actual) }}
            />
          </div>
        </div>

        <div>
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-muted-foreground">EU default</span>
            <span className="font-medium tabular-nums">
              {fmtSee(euDefault)} <span className="text-xs text-muted">{unit}</span>
            </span>
          </div>
          <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-surface-raised">
            <div className="h-full rounded-full bg-blue-400" style={{ width: pct(euDefault) }} />
          </div>
        </div>
      </div>

      <div className="mt-5 border-t border-surface-border pt-4 text-sm">
        <span className="text-muted-foreground">
          {better ? "Below the default by " : "Above the default by "}
        </span>
        <span className={`font-medium tabular-nums ${better ? "text-teal-500" : "text-danger"}`}>
          {fmtSee(Math.abs(variance))} {unit}
        </span>
        <span className="text-muted-foreground">
          {" "}
          ({fmtPct(Math.abs((variance / euDefault) * 100))}%)
        </span>
      </div>
    </Card>
  );
}
