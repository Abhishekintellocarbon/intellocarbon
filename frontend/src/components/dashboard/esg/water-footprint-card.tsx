"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Droplets } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { DashboardEmptyState } from "../shared/dashboard-empty-state";
import { CHART_COLORS } from "../shared/dashboard-constants";
import type { WaterFootprintRollup } from "@/lib/types";

const fmtM3 = (n: number) => `${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })} m³`;

/**
 * ISO 14046 water balance across every facility, from the water inventory
 * captured alongside GHG activity data.
 *
 * The balance is shown as three bars rather than a stacked one because
 * withdrawn is the *sum* of the other two, not a fourth peer category —
 * stacking would double-count it and imply a total of twice the real
 * withdrawal.
 */
export function WaterFootprintCard({ water }: { water: WaterFootprintRollup }) {
  const balance = [
    { label: "Withdrawn", value: water.totalWithdrawnM3, color: CHART_COLORS.blue },
    { label: "Discharged", value: water.totalDischargedM3, color: CHART_COLORS.amber },
    { label: "Consumed", value: water.totalConsumedM3, color: CHART_COLORS.teal },
  ];

  return (
    <Card className="rounded-[12px] p-6">
      <h2 className="text-lg font-semibold">Water balance</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Withdrawn, discharged, and consumed across all facilities. Consumed is withdrawn minus discharged, per
        ISO 14046.
      </p>

      {water.hasData ? (
        <>
          {water.hasDischargeExceedingWithdrawal && (
            <div className="mt-4">
              <Alert variant="info">
                At least one water source reports more discharge than withdrawal. Consumption is shown as zero for
                that source — check the meter readings on that entry.
              </Alert>
            </div>
          )}

          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={balance} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#22303f" />
                <XAxis dataKey="label" stroke="#8AA0B4" fontSize={12} />
                <YAxis
                  stroke="#8AA0B4"
                  fontSize={12}
                  width={70}
                  tickFormatter={(v: number) => v.toLocaleString("en-IN")}
                />
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.04)" }}
                  formatter={(value) => fmtM3(Number(value))}
                  contentStyle={{
                    background: "#162230",
                    border: "1px solid #22303f",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="value" name="Volume" radius={[4, 4, 0, 0]}>
                  {balance.map((entry) => (
                    <Cell key={entry.label} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-surface-border pt-4 sm:grid-cols-4">
            <div>
              <dt className="text-xs text-muted-foreground">Freshwater withdrawn</dt>
              <dd className="mt-0.5 text-sm font-medium">{fmtM3(water.freshwaterWithdrawnM3)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Recycled share</dt>
              <dd className="mt-0.5 text-sm font-medium">{water.recycledSharePct}%</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Water intensity</dt>
              <dd className="mt-0.5 text-sm font-medium">
                {water.waterIntensityM3PerTonne != null ? `${water.waterIntensityM3PerTonne} m³/t` : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Facilities reporting</dt>
              <dd className="mt-0.5 text-sm font-medium">{water.facilitiesReporting}</dd>
            </div>
          </dl>

          {water.sources.length > 0 && (
            <div className="mt-5 border-t border-surface-border pt-4">
              <h3 className="text-xs font-medium text-muted-foreground">Withdrawal by source</h3>
              <ul className="mt-3 space-y-2">
                {water.sources.map((source) => (
                  <li key={source.sourceType} className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate">{source.label}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {fmtM3(source.withdrawnM3)} · {source.pctOfWithdrawal}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        <DashboardEmptyState
          icon={Droplets}
          title="No water data yet"
          description="Add a water inventory to any submitted activity data entry to see your ISO 14046 water balance."
          ctaHref="/facilities"
          ctaLabel="Go to facilities"
        />
      )}
    </Card>
  );
}
