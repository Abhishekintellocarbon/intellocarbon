"use client";

import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { LineChart } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DashboardEmptyState } from "@/components/dashboard/shared/dashboard-empty-state";
import { CHART_COLORS } from "@/components/dashboard/shared/dashboard-constants";
import type { FacilityDashboard } from "@/lib/types";

const fmtPrice = (n: number) => `€${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * CBAM certificate reference price by quarter.
 *
 * Reads the price history the Emission Factor Manager already produces — each
 * quarterly update supersedes the previous row rather than overwriting it, so
 * the chain of rows is the history. No new data source, and no price is
 * estimated or interpolated: a quarter only appears once the Commission's
 * figure has been entered.
 */
export function CertificatePriceTrendChart({ dashboard }: { dashboard: FacilityDashboard }) {
  const { certificatePriceTrend } = dashboard;
  const current = certificatePriceTrend.find((p) => p.isCurrent);

  // A single published price is a value, not a trend — drawing one bar would
  // imply a direction that isn't in the data.
  const hasTrend = certificatePriceTrend.length >= 2;

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Certificate price trend</h2>
        {current && (
          <span className="text-xs text-muted-foreground">
            Current: <span className="font-medium text-foreground">{fmtPrice(current.pricePerTonneEur)}</span> ·{" "}
            {current.quarterLabel}
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Published CBAM certificate reference price per tCO2e, by quarter. The current price is what your liability
        above is calculated at.
      </p>

      {hasTrend ? (
        <>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={certificatePriceTrend} margin={{ top: 16, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#22303f" vertical={false} />
                <XAxis dataKey="quarterLabel" stroke="#8AA0B4" fontSize={12} />
                <YAxis
                  stroke="#8AA0B4"
                  fontSize={12}
                  width={60}
                  domain={["dataMin - 2", "dataMax + 2"]}
                  tickFormatter={(v: number) => `€${Math.round(v)}`}
                />
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.04)" }}
                  formatter={(value) => fmtPrice(Number(value))}
                  labelFormatter={(label) => `Quarter ${label}`}
                  contentStyle={{ background: "#162230", border: "1px solid #22303f", borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="pricePerTonneEur" name="Price" radius={[4, 4, 0, 0]}>
                  {certificatePriceTrend.map((point) => (
                    // The in-force price is set apart from the historical
                    // series it sits in — it's the one driving the liability.
                    <Cell
                      key={point.quarterLabel}
                      fill={point.isCurrent ? CHART_COLORS.teal : CHART_COLORS.blue}
                    />
                  ))}
                  <LabelList
                    dataKey="pricePerTonneEur"
                    position="top"
                    formatter={(v) => fmtPrice(Number(v))}
                    fontSize={11}
                    fill="#B5C0CC"
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {current && <p className="mt-3 text-[11px] text-muted">Source: {current.source}</p>}
        </>
      ) : (
        <DashboardEmptyState
          icon={LineChart}
          title="No price history yet"
          description="The trend appears once a second quarterly certificate price has been published and recorded."
          ctaHref="/facilities"
          ctaLabel="Back to facilities"
        />
      )}
    </Card>
  );
}
