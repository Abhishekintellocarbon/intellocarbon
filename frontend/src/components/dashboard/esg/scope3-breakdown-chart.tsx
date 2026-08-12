"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Network } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DashboardEmptyState } from "../shared/dashboard-empty-state";
import { CHART_COLORS, EMISSIONS_SEGMENT_COLORS, fmtTco2e } from "../shared/dashboard-constants";
import type { EsgScope3Summary } from "@/lib/types";

/**
 * Scope 3 category breakdown across the 5 GHG Protocol categories the
 * calculation engine implements. All five are always plotted, disclosed or
 * not — a category sitting at zero is the honest answer to "have we covered
 * business travel yet?", and hiding it would make the inventory look more
 * complete than it is.
 */

const CATEGORY_COLOR = [...EMISSIONS_SEGMENT_COLORS, CHART_COLORS.teal];

export function Scope3BreakdownChart({ scope3 }: { scope3: EsgScope3Summary }) {
  const data = scope3.categories.map((c) => ({
    ...c,
    // Short axis label — the full category name goes in the tooltip and legend.
    shortLabel: `Cat ${c.category}`,
  }));

  return (
    <Card className="rounded-[12px] p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Scope 3 category breakdown</h2>
        {scope3.hasData && scope3.periodLabel && (
          <p className="text-xs text-muted-foreground">{scope3.periodLabel}</p>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        The 5 GHG Protocol categories currently calculable, summed across all your facilities.
      </p>

      {scope3.hasData ? (
        <>
          <p className="mt-4 text-2xl font-semibold text-teal-500">{fmtTco2e(scope3.totalTco2e)}</p>
          <p className="text-xs text-muted-foreground">
            total value-chain emissions — {scope3.mandatoryCalculableDisclosed} of {scope3.mandatoryCalculableCount}{" "}
            categories mandatory for your sector disclosed
          </p>

          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#22303f" />
                <XAxis dataKey="shortLabel" stroke="#8AA0B4" fontSize={12} />
                <YAxis stroke="#8AA0B4" fontSize={12} width={60} tickFormatter={(v: number) => v.toLocaleString("en-IN")} />
                <Tooltip
                  cursor={{ fill: "rgba(34,48,63,0.4)" }}
                  formatter={(value) => fmtTco2e(Number(value))}
                  labelFormatter={(_label, payload) => payload?.[0]?.payload?.name ?? ""}
                  contentStyle={{ background: "#162230", border: "1px solid #22303f", borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="tco2e" name="Emissions" radius={[4, 4, 0, 0]}>
                  {data.map((entry, index) => (
                    <Cell key={entry.prismaCategory} fill={CATEGORY_COLOR[index % CATEGORY_COLOR.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <ul className="mt-4 space-y-2">
            {data.map((entry, index) => (
              <li key={entry.prismaCategory} className="flex items-start justify-between gap-4 text-sm">
                <span className="flex min-w-0 items-start gap-2">
                  <span
                    className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: CATEGORY_COLOR[index % CATEGORY_COLOR.length] }}
                  />
                  <span className="min-w-0">
                    <span className="text-foreground/90">
                      Category {entry.category} — {entry.name}
                    </span>
                    {entry.relevance === "MANDATORY" && (
                      <span className="ml-2 rounded-full border border-teal-500/30 bg-teal-500/10 px-2 py-0.5 text-[10px] font-semibold text-teal-500">
                        Required
                      </span>
                    )}
                  </span>
                </span>
                <span className="shrink-0 text-right text-muted-foreground">
                  {entry.entryCount > 0 ? (
                    <>
                      {fmtTco2e(entry.tco2e)} <span className="text-xs">({entry.pct}%)</span>
                    </>
                  ) : (
                    <span className="text-xs text-muted">Not disclosed</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <DashboardEmptyState
          icon={Network}
          title="No Scope 3 data yet"
          description="Submit a Scope 3 entry from a facility's BRSR Core or ISSB disclosure flow to see your value-chain breakdown."
          ctaHref="/esg/brsr"
          ctaLabel="Go to BRSR Core"
        />
      )}
    </Card>
  );
}
