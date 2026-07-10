"use client";

import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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

export function IntensityTrendChart({ dashboard, facilityId }: { dashboard: FacilityDashboard; facilityId: string }) {
  const { intensityTrend, intensityTargetLine } = dashboard;

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold">CCTS intensity trend</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        GHG intensity per tonne of output across reporting periods
        {intensityTargetLine != null && ` — dashed line is the notified target (${fmtIntensity(intensityTargetLine)} tCO2e/t)`}.
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
              {intensityTargetLine != null && (
                <ReferenceLine
                  y={intensityTargetLine}
                  stroke="#8AA0B4"
                  strokeDasharray="6 4"
                  label={{ value: "Notified target", position: "insideTopRight", fill: "#8AA0B4", fontSize: 11 }}
                />
              )}
              <Line
                type="monotone"
                dataKey="actualIntensity"
                name="GHG intensity"
                stroke={CHART_COLORS.blue}
                strokeWidth={2}
                dot={<IntensityDot />}
                activeDot={{ r: 6 }}
              />
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
