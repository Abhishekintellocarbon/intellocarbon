"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DashboardEmptyState } from "../shared/dashboard-empty-state";
import { CHART_COLORS } from "../shared/dashboard-constants";
import type { CompanyBrsrGenderDiversity } from "@/lib/types";

const fmtEmployees = (n: number) => `${n.toLocaleString("en-IN")} employees`;

export function GenderDiversityChart({ gender }: { gender: CompanyBrsrGenderDiversity }) {
  const hasValues = gender.hasData && gender.femaleCount != null && gender.maleCount != null;
  const segments = hasValues
    ? [
        { label: "Women", value: gender.femaleCount as number, color: CHART_COLORS.teal },
        { label: "Men", value: gender.maleCount as number, color: CHART_COLORS.blue },
      ]
    : [];
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  return (
    <Card className="rounded-[12px] p-6">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">Gender diversity</h2>
        {hasValues && <p className="text-xs text-muted-foreground">{gender.periodLabel}</p>}
      </div>

      {hasValues ? (
        <div className="mt-4 flex flex-col items-center gap-6 sm:flex-row">
          <div className="relative h-56 w-56 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={segments} dataKey="value" nameKey="label" innerRadius="65%" outerRadius="95%" paddingAngle={2} strokeWidth={0}>
                  {segments.map((s) => (
                    <Cell key={s.label} fill={s.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [fmtEmployees(Number(value)), String(name)]}
                  contentStyle={{ background: "#162230", border: "1px solid #22303f", borderRadius: 8, fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-2xl font-bold text-foreground">{gender.womenPct}%</p>
              <p className="text-xs text-muted-foreground">women</p>
            </div>
          </div>

          <ul className="flex-1 space-y-3">
            {segments.map((s) => (
              <li key={s.label} className="flex items-center justify-between gap-4 text-sm">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="text-foreground/90">{s.label}</span>
                </span>
                <span className="shrink-0 text-right text-muted-foreground">
                  {fmtEmployees(s.value)} <span className="text-xs">({total > 0 ? Math.round((s.value / total) * 100) : 0}%)</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <DashboardEmptyState
          icon={Users}
          title="No workforce data yet"
          description="Submit a BRSR Core disclosure with your employee headcount to see this breakdown."
          ctaHref="/esg/brsr"
          ctaLabel="Go to BRSR Core"
        />
      )}
    </Card>
  );
}
