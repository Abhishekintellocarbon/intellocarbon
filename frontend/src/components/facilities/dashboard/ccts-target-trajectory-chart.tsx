"use client";

import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Route } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DashboardEmptyState } from "@/components/dashboard/shared/dashboard-empty-state";
import { CHART_COLORS, fmtIntensity } from "@/components/dashboard/shared/dashboard-constants";
import type { FacilityDashboard } from "@/lib/types";

/**
 * This facility's own multi-year CCTS target trajectory.
 *
 * Explicitly NOT a sector curve. CCTS intensity targets are notified per
 * obligated entity — two cement plants in the same sub-sector can hold
 * different trajectories — and this platform holds no verified sector-average
 * target data. So every point here is a target the company itself entered for
 * one of its own compliance years, and a year with nothing entered is drawn as
 * a gap, never as a sector proxy or a straight-line interpolation between the
 * years around it.
 *
 * The achieved bars are the same per-period CCTS intensities the engine
 * already computed, aggregated to the compliance year by the backend. Nothing
 * on this chart is modelled or projected forward.
 */
export function CctsTargetTrajectoryChart({ dashboard, facilityId }: { dashboard: FacilityDashboard; facilityId: string }) {
  const { cctsTargetTrajectory } = dashboard;

  const yearsWithTarget = cctsTargetTrajectory.filter((point) => point.targetIntensity != null).length;

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Target trajectory</h2>
        <span className="text-xs text-muted-foreground">
          {yearsWithTarget > 0
            ? `${yearsWithTarget} compliance ${yearsWithTarget === 1 ? "year" : "years"} with a notified target`
            : "No notified targets on file"}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        This facility&apos;s own registered BEE targets by compliance year, against what it achieved. Targets are
        notified per obligated entity under CCTS, so this is your entity&apos;s trajectory — not a sector average.
      </p>

      {cctsTargetTrajectory.length > 0 ? (
        <>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={cctsTargetTrajectory} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#22303f" vertical={false} />
                <XAxis dataKey="complianceYear" stroke="#8AA0B4" fontSize={12} />
                <YAxis stroke="#8AA0B4" fontSize={12} width={50} tickFormatter={(v: number) => fmtIntensity(v)} />
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.04)" }}
                  formatter={(value) => `${fmtIntensity(Number(value))} tCO2e/t`}
                  contentStyle={{ background: "#162230", border: "1px solid #22303f", borderRadius: 8, fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="achievedIntensity" name="GEI achieved" fill={CHART_COLORS.blue} radius={[4, 4, 0, 0]} maxBarSize={56} />
                <Line
                  type="monotone"
                  dataKey="targetIntensity"
                  name="Notified target"
                  stroke={CHART_COLORS.teal}
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  dot={{ r: 4, fill: CHART_COLORS.teal }}
                  // A compliance year with no target entered leaves a gap.
                  connectNulls={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          {yearsWithTarget < cctsTargetTrajectory.length && (
            <p className="mt-3 text-[11px] text-muted">
              Compliance years without a notified target are shown with achieved intensity only — no target is inferred
              for them.
            </p>
          )}
        </>
      ) : (
        <DashboardEmptyState
          icon={Route}
          title="No trajectory yet"
          description="Submit activity data with this facility's notified BEE target to build its year-over-year trajectory."
          ctaHref={`/facilities/${facilityId}/data-entry/new`}
          ctaLabel="Add data entry"
        />
      )}
    </Card>
  );
}
