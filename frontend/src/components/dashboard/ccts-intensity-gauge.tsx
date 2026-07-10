"use client";

import { Bar, BarChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Gauge } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DashboardEmptyState } from "./shared/dashboard-empty-state";
import { CHART_COLORS, fmtIntensity } from "./shared/dashboard-constants";
import type { CompanyCctsIntensity } from "@/lib/types";

const TONE_LABEL: Record<string, string> = {
  SURPLUS: "Surplus — beating target",
  ON_TRACK: "On track — within 5% of target",
  DEFICIT: "Deficit — over target",
  NO_TARGET: "Target pending BEE notification",
};

export function CctsIntensityGauge({ intensity }: { intensity: CompanyCctsIntensity }) {
  if (!intensity.hasData || intensity.actualIntensity == null) {
    return (
      <Card className="rounded-[12px] p-6">
        <h2 className="text-lg font-semibold">CCTS intensity vs target</h2>
        <p className="mt-1 text-xs text-muted-foreground">Company-wide GHG intensity, production-weighted across facilities.</p>
        <DashboardEmptyState
          icon={Gauge}
          title="No CCTS data yet"
          description="Submit CCTS activity data for a facility to see your intensity position."
          ctaHref="/facilities"
          ctaLabel="View facilities"
        />
      </Card>
    );
  }

  const { actualIntensity, targetIntensity, tone } = intensity;
  const barColor = tone === "DEFICIT" ? CHART_COLORS.red : CHART_COLORS.teal;
  const maxScale = Math.max(actualIntensity, targetIntensity ?? 0, 0.0001) * 1.3;

  return (
    <Card className="rounded-[12px] p-6">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">CCTS intensity vs target</h2>
        <p className="text-xs text-muted-foreground">{intensity.periodLabel}</p>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Company-wide GHG intensity, production-weighted across facilities.</p>

      <div className="mt-6 h-16">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={[{ name: "Intensity", actualIntensity }]}
            margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
          >
            <XAxis type="number" domain={[0, maxScale]} stroke="#8AA0B4" fontSize={11} tickFormatter={(v: number) => fmtIntensity(v)} />
            <YAxis type="category" dataKey="name" hide />
            {targetIntensity != null && (
              <>
                <ReferenceArea x1={0} x2={targetIntensity} fill="rgba(0, 212, 170, 0.1)" />
                <ReferenceArea x1={targetIntensity} x2={maxScale} fill="rgba(255, 107, 107, 0.08)" />
                <ReferenceLine x={targetIntensity} stroke={CHART_COLORS.amber} strokeWidth={2} />
              </>
            )}
            <Tooltip
              formatter={(value) => `${fmtIntensity(Number(value))} tCO2e/t`}
              contentStyle={{ background: "#162230", border: "1px solid #22303f", borderRadius: 8, fontSize: 12 }}
            />
            <Bar dataKey="actualIntensity" name="Actual intensity" fill={barColor} radius={[0, 4, 4, 0]} barSize={32} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: barColor }} />
          Actual: {fmtIntensity(actualIntensity)} tCO2e/t
        </span>
        {targetIntensity != null && (
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: CHART_COLORS.amber }} />
            Target: {fmtIntensity(targetIntensity)} tCO2e/t
          </span>
        )}
        <span className={tone === "DEFICIT" ? "font-medium text-danger" : "font-medium text-teal-500"}>{TONE_LABEL[tone ?? "NO_TARGET"]}</span>
      </div>
    </Card>
  );
}
