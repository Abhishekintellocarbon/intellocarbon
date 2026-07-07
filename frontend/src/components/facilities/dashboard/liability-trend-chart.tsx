"use client";

import { Bar, BarChart, CartesianGrid, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DashboardEmptyState } from "./dashboard-empty-state";
import { CHART_COLORS, fmtEur } from "./dashboard-constants";
import type { FacilityDashboard } from "@/lib/types";

export function LiabilityTrendChart({ dashboard, facilityId }: { dashboard: FacilityDashboard; facilityId: string }) {
  const { liabilityTrend } = dashboard;
  // One bar-row of height per quarter, plus room for axis/legend chrome.
  const chartHeight = Math.max(160, liabilityTrend.length * 70 + 60);

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold">CBAM liability trend</h2>
      <p className="mt-1 text-xs text-muted-foreground">Actual liability vs. what you&apos;d owe at the EU default value, by quarter.</p>

      {liabilityTrend.length > 0 ? (
        <div className="mt-4" style={{ height: chartHeight }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={liabilityTrend} layout="vertical" margin={{ top: 0, right: 24, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#22303f" horizontal={false} />
              <XAxis type="number" tickFormatter={(v: number) => fmtEur(v)} stroke="#8AA0B4" fontSize={12} />
              <YAxis type="category" dataKey="quarterLabel" stroke="#8AA0B4" fontSize={12} width={70} />
              <Tooltip
                formatter={(value) => fmtEur(Number(value))}
                contentStyle={{ background: "#162230", border: "1px solid #22303f", borderRadius: 8, fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="actualLiabilityEur" name="Actual" fill={CHART_COLORS.teal} radius={[0, 4, 4, 0]}>
                <LabelList dataKey="actualLiabilityEur" position="right" formatter={(v) => fmtEur(Number(v))} fontSize={11} fill="#B5C0CC" />
              </Bar>
              <Bar dataKey="defaultLiabilityEur" name="EU default" fill={CHART_COLORS.blue} radius={[0, 4, 4, 0]}>
                <LabelList dataKey="defaultLiabilityEur" position="right" formatter={(v) => fmtEur(Number(v))} fontSize={11} fill="#B5C0CC" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <DashboardEmptyState
          icon={TrendingUp}
          title="No liability trend yet"
          description="Submit CBAM activity data for at least one quarter to see the trend here."
          ctaHref={`/facilities/${facilityId}/data-entry/new`}
          ctaLabel="Add data entry"
        />
      )}
    </Card>
  );
}
