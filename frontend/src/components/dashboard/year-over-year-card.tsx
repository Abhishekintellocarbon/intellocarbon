"use client";

import { CalendarRange, TrendingDown, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DashboardEmptyState } from "./shared/dashboard-empty-state";
import { fmtEur, fmtTco2e } from "./shared/dashboard-constants";
import type { CompanyYearOverYear } from "@/lib/types";

// For emissions/liability, an increase is bad (red) and a decrease is good
// (teal) — the opposite of a typical "up = green" revenue stat.
function DeltaStat({ label, deltaPct, thisYear, lastYear, formatter }: { label: string; deltaPct: number | null | undefined; thisYear: number; lastYear: number; formatter: (n: number) => string }) {
  const isWorse = deltaPct != null && deltaPct > 0;
  const isBetter = deltaPct != null && deltaPct < 0;
  const Icon = isWorse ? TrendingUp : TrendingDown;

  return (
    <div className="flex-1 rounded-[12px] border border-surface-border bg-surface-raised/40 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold text-foreground">{formatter(thisYear)}</p>
      <p className="mt-1 text-xs text-muted-foreground">vs {formatter(lastYear)} same period last year</p>
      {deltaPct != null ? (
        <p className={`mt-2 flex items-center gap-1 text-sm font-semibold ${isWorse ? "text-danger" : isBetter ? "text-teal-500" : "text-muted-foreground"}`}>
          <Icon className="h-3.5 w-3.5" />
          {deltaPct > 0 ? "+" : ""}
          {deltaPct}% vs last year
        </p>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">—</p>
      )}
    </div>
  );
}

export function YearOverYearCard({ yearOverYear }: { yearOverYear: CompanyYearOverYear }) {
  return (
    <Card className="rounded-[12px] p-6">
      <h2 className="text-lg font-semibold">Year-over-year</h2>
      <p className="mt-1 text-xs text-muted-foreground">Cumulative emissions and liability, year-to-date vs the same period last year.</p>

      {yearOverYear.hasData && yearOverYear.thisYear && yearOverYear.lastYear ? (
        <div className="mt-4 flex flex-col gap-4 sm:flex-row">
          <DeltaStat
            label="Emissions (tCO2e)"
            deltaPct={yearOverYear.emissionsDeltaPct}
            thisYear={yearOverYear.thisYear.emissionsTco2e}
            lastYear={yearOverYear.lastYear.emissionsTco2e}
            formatter={(n) => fmtTco2e(n, 0)}
          />
          <DeltaStat
            label="CBAM liability"
            deltaPct={yearOverYear.liabilityDeltaPct}
            thisYear={yearOverYear.thisYear.liabilityEur}
            lastYear={yearOverYear.lastYear.liabilityEur}
            formatter={fmtEur}
          />
        </div>
      ) : (
        <DashboardEmptyState
          icon={CalendarRange}
          title="Not enough data yet"
          description="Year-over-year comparisons appear once you have submitted data spanning two calendar years."
          ctaHref="/facilities"
          ctaLabel="View facilities"
        />
      )}
    </Card>
  );
}
