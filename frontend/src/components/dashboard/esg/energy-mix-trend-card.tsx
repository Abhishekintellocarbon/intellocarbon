"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DashboardEmptyState } from "../shared/dashboard-empty-state";
import { CHART_COLORS } from "../shared/dashboard-constants";
import type { EnergyMixTrend } from "@/lib/types";

const fmtGj = (n: number) => `${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })} GJ`;

const SOURCE_LABELS: Record<string, string> = {
  BRSR_CORE: "BRSR Core (Attribute 4)",
  ACTIVITY_DATA: "Activity data — purchased electricity and steam",
};

/**
 * Renewable vs non-renewable energy over time.
 *
 * The existing donut answers "what is the split now"; this answers "which way
 * is it going", which is the part worth acting on — 12% renewable reads very
 * differently after 4% than after 20%.
 *
 * Stacked areas rather than two lines: the two series sum to total energy, so
 * the band height carries real information (energy grew or shrank) that
 * separate lines would throw away. The renewable share is called out
 * separately as a number, since it is the ratio rather than either absolute
 * that people track.
 */
export function EnergyMixTrendCard({ energyMix }: { energyMix: EnergyMixTrend }) {
  const change = energyMix.changePoints;

  return (
    <Card className="rounded-[12px] p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Energy mix over time</h2>
        {energyMix.hasData && energyMix.latestRenewablePct != null && (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-teal-500">{energyMix.latestRenewablePct}%</span> renewable
            {change != null && (
              <span className={change >= 0 ? " text-teal-500" : " text-amber-500"}>
                {" "}
                {change >= 0 ? "+" : ""}
                {change} pts vs previous
              </span>
            )}
          </p>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Renewable and non-renewable consumption by reporting period, reused from energy figures you already report.
      </p>

      {energyMix.hasData ? (
        <>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={energyMix.points} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#22303f" />
                <XAxis dataKey="periodLabel" stroke="#8AA0B4" fontSize={12} />
                <YAxis
                  stroke="#8AA0B4"
                  fontSize={12}
                  width={70}
                  tickFormatter={(v: number) => v.toLocaleString("en-IN")}
                />
                <Tooltip
                  formatter={(value, name) => [fmtGj(Number(value)), String(name)]}
                  contentStyle={{ background: "#162230", border: "1px solid #22303f", borderRadius: 8, fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area
                  type="monotone"
                  dataKey="renewableGj"
                  name="Renewable"
                  stackId="energy"
                  stroke={CHART_COLORS.teal}
                  fill={CHART_COLORS.teal}
                  fillOpacity={0.55}
                />
                <Area
                  type="monotone"
                  dataKey="nonRenewableGj"
                  name="Non-renewable"
                  stackId="energy"
                  stroke={CHART_COLORS.blue}
                  fill={CHART_COLORS.blue}
                  fillOpacity={0.35}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-5 border-t border-surface-border pt-4">
            <p className="text-xs text-muted-foreground">
              Source: <span className="font-medium text-foreground">{SOURCE_LABELS[energyMix.source ?? ""]}</span>
              {" · "}
              {energyMix.points.length} {energyMix.points.length === 1 ? "period" : "periods"}
            </p>
            {/* A share of purchased electricity is not a share of total energy,
                and the difference flatters. The card says so rather than
                letting the two be read as the same measure. */}
            {energyMix.electricityOnly && (
              <p className="mt-2 text-xs text-amber-500">
                Covers purchased electricity and imported steam only. On-site fuel combustion — diesel, furnace oil,
                natural gas — is not included, and for most industrial facilities that is the larger share of total
                energy, so this renewable share reads higher than a total-energy one would. Report BRSR Core
                Attribute 4 for the full picture.
              </p>
            )}
          </div>
        </>
      ) : (
        <DashboardEmptyState
          icon={Zap}
          title="No energy split yet"
          description="Report renewable and non-renewable energy in BRSR Core Attribute 4, or submit activity data with electricity figures, and the trend appears here."
          ctaHref="/esg/brsr"
          ctaLabel="Open BRSR Core"
        />
      )}
    </Card>
  );
}
