"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { ClipboardList } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DashboardEmptyState } from "@/components/dashboard/shared/dashboard-empty-state";
import { EMISSIONS_SEGMENT_COLORS, fmtTco2e } from "@/components/dashboard/shared/dashboard-constants";
import type { FacilityDashboard } from "@/lib/types";

export function EmissionsBreakdownChart({ dashboard, facilityId }: { dashboard: FacilityDashboard; facilityId: string }) {
  const { emissionsBreakdown } = dashboard;

  return (
    <Card className="p-6">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">Emissions breakdown</h2>
        {emissionsBreakdown.hasData && <p className="text-xs text-muted-foreground">{emissionsBreakdown.periodLabel}</p>}
      </div>

      {emissionsBreakdown.hasData ? (
        <div className="mt-4 flex flex-col items-center gap-6 lg:flex-row">
          {/* lg, not sm. These cards sit in a two-column grid, so at sm the
              card is about half of 592px and its content box ~238px — narrower
              than the donut beside it, which is a fixed w-56/w-64 and shrink-0.
              The list could not shrink either (a flex child defaults to
              min-width:auto, now min-w-0), so the row overflowed its card and
              the page scrolled sideways from 640px up. Side by side starts
              once the card is actually wide enough for both. */}
          <div className="relative h-64 w-64 max-w-full shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={emissionsBreakdown.segments}
                  dataKey="valueTco2e"
                  nameKey="label"
                  innerRadius="65%"
                  outerRadius="95%"
                  paddingAngle={2}
                  strokeWidth={0}
                >
                  {emissionsBreakdown.segments!.map((segment, i) => (
                    <Cell key={segment.label} fill={EMISSIONS_SEGMENT_COLORS[i % EMISSIONS_SEGMENT_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [fmtTco2e(Number(value)), String(name)]}
                  contentStyle={{ background: "#162230", border: "1px solid #22303f", borderRadius: 8, fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-2xl font-bold text-foreground">{emissionsBreakdown.totalTco2e!.toLocaleString("en-IN")}</p>
              <p className="text-xs text-muted-foreground">tCO2e total</p>
            </div>
          </div>

          <ul className="min-w-0 flex-1 space-y-3">
            {emissionsBreakdown.segments!.map((segment, i) => (
              <li key={segment.label} className="flex items-center justify-between gap-4 text-sm">
                <span className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: EMISSIONS_SEGMENT_COLORS[i % EMISSIONS_SEGMENT_COLORS.length] }}
                  />
                  <span className="text-foreground/90">{segment.label}</span>
                </span>
                <span className="shrink-0 text-right text-muted-foreground">
                  {fmtTco2e(segment.valueTco2e)} <span className="text-xs">({segment.pct}%)</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <DashboardEmptyState
          icon={ClipboardList}
          title="No emissions data yet"
          description="Submit and calculate a reporting period's activity data to see the emissions breakdown."
          ctaHref={`/facilities/${facilityId}/data-entry/new`}
          ctaLabel="Add data entry"
        />
      )}
    </Card>
  );
}
