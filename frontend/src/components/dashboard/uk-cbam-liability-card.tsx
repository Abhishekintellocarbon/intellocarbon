"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PoundSterling } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DashboardEmptyState } from "./shared/dashboard-empty-state";
import { CHART_COLORS, fmtGbp, fmtTco2e } from "./shared/dashboard-constants";
import type { CompanyUkCbamAnalytics } from "@/lib/types";

/**
 * UK CBAM's own card, alongside the EU liability chart rather than as extra
 * series on it: the two are separate obligations in separate currencies, and
 * one axis carrying both would imply a total that means nothing.
 *
 * Until HMRC publishes a rate the card plots emissions instead of money —
 * those are final and useful — and says plainly that the liability can't be
 * priced yet. It never renders a zero in place of a missing price.
 */
export function UkCbamLiabilityCard({ ukCbam }: { ukCbam: CompanyUkCbamAnalytics }) {
  if (!ukCbam.applicable) return null;

  const { currentRate, liabilityTrend } = ukCbam;
  const ratePending = currentRate === null;

  return (
    <Card className="rounded-[12px] p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">UK CBAM {ratePending ? "emissions" : "liability"} trend</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Scope 1 and precursor emissions across all your facilities, by quarter. Indirect emissions are out of
            scope until 2029.
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-surface-border bg-surface-raised px-3 py-1 text-xs text-muted-foreground">
          {ratePending ? (
            <span className="font-medium text-warning">Rate not yet configured</span>
          ) : (
            <>
              Current UK CBAM rate:{" "}
              <span className="font-medium text-foreground">{fmtGbp(currentRate.ratePerTonneGbp)}/t</span> (
              {currentRate.quarterLabel})
            </>
          )}
        </span>
      </div>

      {liabilityTrend.length > 0 ? (
        <>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={liabilityTrend} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#22303f" />
                <XAxis dataKey="quarterLabel" stroke="#8AA0B4" fontSize={12} />
                <YAxis
                  stroke="#8AA0B4"
                  fontSize={12}
                  width={70}
                  tickFormatter={(v: number) => (ratePending ? fmtTco2e(v, 0) : fmtGbp(v))}
                />
                <Tooltip
                  formatter={(value) => (ratePending ? fmtTco2e(Number(value)) : fmtGbp(Number(value)))}
                  contentStyle={{ background: "#162230", border: "1px solid #22303f", borderRadius: 8, fontSize: 12 }}
                />
                <Bar
                  dataKey={ratePending ? "emissionsTco2e" : "liabilityGbp"}
                  name={ratePending ? "Emissions in scope" : "Net liability"}
                  fill={CHART_COLORS.teal}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {ratePending && (
            <p className="mt-3 text-xs text-muted-foreground">
              Emissions are final. The liability can be shown once the UK CBAM rate is published by HMRC and recorded
              in the Emission Factor Manager.
            </p>
          )}
        </>
      ) : (
        <DashboardEmptyState
          icon={PoundSterling}
          title="No UK CBAM data yet"
          description="Submit activity data for a facility in a UK CBAM sector to see this trend."
          ctaHref="/facilities"
          ctaLabel="View facilities"
        />
      )}
    </Card>
  );
}
