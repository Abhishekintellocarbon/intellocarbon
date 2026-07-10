"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Euro } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DashboardEmptyState } from "./shared/dashboard-empty-state";
import { CHART_COLORS, fmtEur } from "./shared/dashboard-constants";
import type { CompanyLiabilityTrendPoint } from "@/lib/types";

export function LiabilityTrendChart({
  data,
  currentCertificatePrice,
}: {
  data: CompanyLiabilityTrendPoint[];
  currentCertificatePrice: { pricePerTonneEur: number; quarterLabel: string };
}) {
  return (
    <Card className="rounded-[12px] p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">CBAM liability trend</h2>
          <p className="mt-1 text-xs text-muted-foreground">Net liability across all facilities, by quarter.</p>
        </div>
        <span className="shrink-0 rounded-full border border-surface-border bg-surface-raised px-3 py-1 text-xs text-muted-foreground">
          Current certificate price: <span className="font-medium text-foreground">{fmtEur(currentCertificatePrice.pricePerTonneEur)}/t</span>{" "}
          ({currentCertificatePrice.quarterLabel})
        </span>
      </div>

      {data.length >= 2 ? (
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#22303f" />
              <XAxis dataKey="quarterLabel" stroke="#8AA0B4" fontSize={12} />
              <YAxis stroke="#8AA0B4" fontSize={12} width={70} tickFormatter={(v: number) => fmtEur(v)} />
              <Tooltip
                formatter={(value) => fmtEur(Number(value))}
                contentStyle={{ background: "#162230", border: "1px solid #22303f", borderRadius: 8, fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="actualLiabilityEur" name="Actual" fill={CHART_COLORS.teal} radius={[4, 4, 0, 0]} />
              <Bar dataKey="defaultLiabilityEur" name="EU default" fill={CHART_COLORS.blue} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : data.length === 1 ? (
        <DashboardEmptyState
          icon={Euro}
          title="Not enough data yet"
          description="Trends appear after your second reporting period."
          ctaHref="/facilities"
          ctaLabel="View facilities"
        />
      ) : (
        <DashboardEmptyState
          icon={Euro}
          title="No liability data yet"
          description="Submit CBAM activity data for a facility to see your liability trend."
          ctaHref="/facilities"
          ctaLabel="View facilities"
        />
      )}
    </Card>
  );
}
