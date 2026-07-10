"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { ClipboardList } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DashboardEmptyState } from "./shared/dashboard-empty-state";
import { EMISSIONS_SEGMENT_COLORS, fmtTco2e } from "./shared/dashboard-constants";
import type { CompanyEmissionsComposition } from "@/lib/types";

export function EmissionsCompositionChart({ composition }: { composition: CompanyEmissionsComposition }) {
  return (
    <Card className="rounded-[12px] p-6">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">Emissions source composition</h2>
        {composition.hasData && <p className="text-xs text-muted-foreground">{composition.periodLabel}</p>}
      </div>

      {composition.hasData ? (
        <div className="mt-4 flex flex-col items-center gap-6 sm:flex-row">
          <div className="relative h-64 w-64 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={composition.segments}
                  dataKey="valueTco2e"
                  nameKey="label"
                  innerRadius="65%"
                  outerRadius="95%"
                  paddingAngle={2}
                  strokeWidth={0}
                >
                  {composition.segments!.map((segment, i) => (
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
              <p className="text-2xl font-bold text-foreground">{composition.totalTco2e!.toLocaleString("en-IN")}</p>
              <p className="text-xs text-muted-foreground">tCO2e total</p>
            </div>
          </div>

          <ul className="flex-1 space-y-3">
            {composition.segments!.map((segment, i) => (
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
          description="Submit and calculate a reporting period's activity data to see the emissions composition."
          ctaHref="/facilities"
          ctaLabel="View facilities"
        />
      )}
    </Card>
  );
}
