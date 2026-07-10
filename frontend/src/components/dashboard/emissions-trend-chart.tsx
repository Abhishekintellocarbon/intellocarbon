"use client";

import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DashboardEmptyState } from "./shared/dashboard-empty-state";
import { CHART_COLORS, fmtTco2e } from "./shared/dashboard-constants";
import type { CompanyEmissionsTrendPoint } from "@/lib/types";

export function EmissionsTrendChart({ data }: { data: CompanyEmissionsTrendPoint[] }) {
  return (
    <Card className="rounded-[12px] p-6">
      <h2 className="text-lg font-semibold">Emissions trend</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Total tCO2e across all facilities, by reporting period — Scope 1, Scope 2, and precursor emissions.
      </p>

      {data.length >= 2 ? (
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="scope1Fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_COLORS.teal} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={CHART_COLORS.teal} stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="scope2Fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_COLORS.blue} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={CHART_COLORS.blue} stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="precursorFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_COLORS.amber} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={CHART_COLORS.amber} stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#22303f" />
              <XAxis dataKey="periodLabel" stroke="#8AA0B4" fontSize={12} />
              <YAxis stroke="#8AA0B4" fontSize={12} width={60} tickFormatter={(v: number) => v.toLocaleString("en-IN")} />
              <Tooltip
                formatter={(value) => fmtTco2e(Number(value))}
                contentStyle={{ background: "#162230", border: "1px solid #22303f", borderRadius: 8, fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area
                type="monotone"
                dataKey="scope1Tco2e"
                name="Scope 1"
                stackId="emissions"
                stroke={CHART_COLORS.teal}
                fill="url(#scope1Fill)"
              />
              <Area
                type="monotone"
                dataKey="scope2Tco2e"
                name="Scope 2"
                stackId="emissions"
                stroke={CHART_COLORS.blue}
                fill="url(#scope2Fill)"
              />
              <Area
                type="monotone"
                dataKey="precursorTco2e"
                name="Precursor"
                stackId="emissions"
                stroke={CHART_COLORS.amber}
                fill="url(#precursorFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : data.length === 1 ? (
        <DashboardEmptyState
          icon={TrendingUp}
          title="Not enough data yet"
          description="Trends appear after your second reporting period."
          ctaHref="/facilities"
          ctaLabel="View facilities"
        />
      ) : (
        <DashboardEmptyState
          icon={TrendingUp}
          title="No emissions data yet"
          description="Submit and calculate activity data for a facility to see your emissions trend."
          ctaHref="/facilities"
          ctaLabel="View facilities"
        />
      )}
    </Card>
  );
}
