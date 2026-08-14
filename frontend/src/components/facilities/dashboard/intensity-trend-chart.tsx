"use client";

import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DotProps } from "recharts";
import { Activity } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DashboardEmptyState } from "@/components/dashboard/shared/dashboard-empty-state";
import { CHART_COLORS, fmtIntensity } from "@/components/dashboard/shared/dashboard-constants";
import type { FacilityDashboard, FacilityIntensityTrendPoint } from "@/lib/types";

function IntensityDot(props: DotProps & { payload?: FacilityIntensityTrendPoint }) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null) return null;
  const color = payload?.aboveTarget === true ? CHART_COLORS.red : payload?.aboveTarget === false ? CHART_COLORS.teal : "#8AA0B4";
  return <circle cx={cx} cy={cy} r={4} fill={color} stroke="#0F1923" strokeWidth={1.5} />;
}

/**
 * GEI (GHG emissions intensity) against the facility's notified CCTS target.
 *
 * The target drawn here is the company's own self-entered, BEE-notified
 * target for this facility — CCTS targets are notified per obligated entity,
 * so there is no sector-wide curve to fall back on and none is substituted.
 * Periods with no target on file simply have no target point; the series
 * breaks rather than being bridged, because a straight line across a gap
 * would assert a target that was never notified.
 *
 * Both series come straight from dashboard.intensityTrend, which the backend
 * builds from the existing per-period CCTS calculation output. Nothing is
 * computed here.
 */
export function IntensityTrendChart({ dashboard, facilityId }: { dashboard: FacilityDashboard; facilityId: string }) {
  const { intensityTrend, intensityTargetLine } = dashboard;

  const hasAnyTarget = intensityTrend.some((point) => point.targetIntensity != null);
  // With targets on more than one period the trajectory itself is the story,
  // so the per-period series carries it. With exactly one, a line of one
  // point wouldn't render — the flat reference line is the readable form.
  const targetPointCount = intensityTrend.filter((point) => point.targetIntensity != null).length;
  const showTargetLine = targetPointCount > 1;
  const showTargetReference = hasAnyTarget && !showTargetLine && intensityTargetLine != null;

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold">GEI trend vs notified target</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        GHG emissions intensity per tonne of output across reporting periods, against this facility&apos;s own
        BEE-notified target
        {hasAnyTarget
          ? intensityTargetLine != null
            ? ` (most recent: ${fmtIntensity(intensityTargetLine)} tCO2e/t)`
            : ""
          : " — no notified target has been entered for this facility yet"}
        .
      </p>

      {intensityTrend.length > 0 ? (
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={intensityTrend} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#22303f" />
              <XAxis dataKey="periodLabel" stroke="#8AA0B4" fontSize={12} />
              <YAxis stroke="#8AA0B4" fontSize={12} width={50} tickFormatter={(v: number) => fmtIntensity(v)} />
              <Tooltip
                formatter={(value) => `${fmtIntensity(Number(value))} tCO2e/t`}
                contentStyle={{ background: "#162230", border: "1px solid #22303f", borderRadius: 8, fontSize: 12 }}
              />
              {hasAnyTarget && <Legend wrapperStyle={{ fontSize: 12 }} />}
              {showTargetReference && (
                <ReferenceLine
                  y={intensityTargetLine!}
                  stroke="#8AA0B4"
                  strokeDasharray="6 4"
                  label={{ value: "Notified target", position: "insideTopRight", fill: "#8AA0B4", fontSize: 11 }}
                />
              )}
              <Line
                type="monotone"
                dataKey="actualIntensity"
                name="GEI achieved"
                stroke={CHART_COLORS.blue}
                strokeWidth={2}
                dot={<IntensityDot />}
                activeDot={{ r: 6 }}
              />
              {showTargetLine && (
                <Line
                  type="monotone"
                  dataKey="targetIntensity"
                  name="Notified target"
                  stroke="#8AA0B4"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  dot={{ r: 3, fill: "#8AA0B4" }}
                  // A period without a notified target leaves a gap rather
                  // than joining the two years either side of it.
                  connectNulls={false}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <DashboardEmptyState
          icon={Activity}
          title="No intensity trend yet"
          description="Submit CCTS activity data for at least one reporting period to see the trend here."
          ctaHref={`/facilities/${facilityId}/data-entry/new`}
          ctaLabel="Add data entry"
        />
      )}
    </Card>
  );
}
