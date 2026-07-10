"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DashboardEmptyState } from "../shared/dashboard-empty-state";
import { CHART_COLORS } from "../shared/dashboard-constants";
import type { CompanyBrsrWasteTrendPoint } from "@/lib/types";

const fmtTonnes = (n: number) => `${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })} t`;

export function WasteTrendChart({ data }: { data: CompanyBrsrWasteTrendPoint[] }) {
  return (
    <Card className="rounded-[12px] p-6">
      <h2 className="text-lg font-semibold">Waste generated trend</h2>
      <p className="mt-1 text-xs text-muted-foreground">Waste generated and recovered across all facilities, by financial year.</p>

      {data.length >= 2 ? (
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#22303f" />
              <XAxis dataKey="periodLabel" stroke="#8AA0B4" fontSize={12} />
              <YAxis stroke="#8AA0B4" fontSize={12} width={60} tickFormatter={(v: number) => v.toLocaleString("en-IN")} />
              <Tooltip
                formatter={(value) => fmtTonnes(Number(value))}
                contentStyle={{ background: "#162230", border: "1px solid #22303f", borderRadius: 8, fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="generatedTonnes" name="Generated" fill={CHART_COLORS.amber} radius={[4, 4, 0, 0]} />
              <Bar dataKey="recoveredTonnes" name="Recovered" fill={CHART_COLORS.teal} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : data.length === 1 ? (
        <DashboardEmptyState
          icon={Trash2}
          title="Not enough data yet"
          description="Trends appear after your second reporting period."
          ctaHref="/esg/brsr"
          ctaLabel="Go to BRSR Core"
        />
      ) : (
        <DashboardEmptyState
          icon={Trash2}
          title="No waste data yet"
          description="Submit a BRSR Core disclosure with waste figures to see this trend."
          ctaHref="/esg/brsr"
          ctaLabel="Go to BRSR Core"
        />
      )}
    </Card>
  );
}
