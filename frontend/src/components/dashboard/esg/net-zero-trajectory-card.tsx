"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DashboardEmptyState } from "../shared/dashboard-empty-state";
import { CHART_COLORS } from "../shared/dashboard-constants";
import type { NetZeroTrajectory } from "@/lib/types";

const fmtCo2e = (n: number) => `${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })} tCO₂e`;

/**
 * Emissions history against the stated target path.
 *
 * The actual line stops at the last submitted year and is never continued.
 * `connectNulls` is deliberately left off: with it, recharts would draw a
 * straight segment across the null future years and produce exactly the
 * forecast this chart must not imply. The dashed target line is the
 * commitment; the solid one is the record.
 */
export function NetZeroTrajectoryCard({ trajectory }: { trajectory: NetZeroTrajectory }) {
  return (
    <Card className="rounded-[12px] p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Trajectory</h2>
        {trajectory.targetLabel && <p className="text-xs text-muted-foreground">{trajectory.targetLabel}</p>}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Your submitted emissions against the path your target implies.
      </p>

      {trajectory.hasData ? (
        <>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trajectory.points} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#22303f" />
                <XAxis dataKey="year" stroke="#8AA0B4" fontSize={12} />
                <YAxis
                  stroke="#8AA0B4"
                  fontSize={12}
                  width={70}
                  tickFormatter={(v: number) => v.toLocaleString("en-IN")}
                />
                <Tooltip
                  formatter={(value, name) => [fmtCo2e(Number(value)), String(name)]}
                  contentStyle={{ background: "#162230", border: "1px solid #22303f", borderRadius: 8, fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />

                {/* Marks where the record ends. Everything right of it on the
                    actual series is absent by design, not missing data. */}
                {trajectory.latestActualYear != null && (
                  <ReferenceLine
                    x={trajectory.latestActualYear}
                    stroke="#8AA0B4"
                    strokeDasharray="2 4"
                    label={{ value: "latest data", position: "insideTopRight", fill: "#8AA0B4", fontSize: 10 }}
                  />
                )}

                <Line
                  type="monotone"
                  dataKey="pathTco2e"
                  name="Target path"
                  stroke={CHART_COLORS.blue}
                  strokeDasharray="5 4"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="actualTco2e"
                  name="Actual"
                  stroke={CHART_COLORS.teal}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  // No connectNulls: the actual line must break rather than
                  // span the future years, which would read as a projection.
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-surface-border pt-4 sm:grid-cols-4">
            <div>
              <dt className="text-xs text-muted-foreground">Baseline</dt>
              <dd className="mt-0.5 text-sm font-medium">{trajectory.baselineYear ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Target year</dt>
              <dd className="mt-0.5 text-sm font-medium">{trajectory.targetYear ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Latest data</dt>
              <dd className="mt-0.5 text-sm font-medium">{trajectory.latestActualYear ?? "None yet"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Commitment</dt>
              <dd className="mt-0.5 text-sm font-medium">{trajectory.isNetZero ? "Net zero" : "Reduction"}</dd>
            </div>
          </dl>

          <p className="mt-4 border-t border-surface-border pt-4 text-xs text-muted-foreground">
            The dashed line is what you have committed to, drawn straight from baseline to target year. Your actual
            emissions are plotted only for years you have submitted data for and are not projected forward — this
            shows where you are against where you said you would be, not a forecast of whether the target will be
            met.
          </p>
        </>
      ) : (
        <DashboardEmptyState
          icon={TrendingDown}
          title="No trajectory to plot"
          description={trajectory.unavailableReason ?? "Set a reduction target to see your emissions plotted against it."}
          ctaHref="/esg/data"
          ctaLabel="Add a target"
        />
      )}
    </Card>
  );
}
