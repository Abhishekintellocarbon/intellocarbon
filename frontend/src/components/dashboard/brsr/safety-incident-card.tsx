"use client";

import { ShieldAlert, TrendingDown, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DashboardEmptyState } from "../shared/dashboard-empty-state";
import type { CompanyBrsrSafetyIncidentRate } from "@/lib/types";

// A higher safety incident rate is bad (red), a lower one is good (teal) —
// same "increase = worse" polarity as the CBAM/CCTS year-over-year card.
export function SafetyIncidentCard({ safety }: { safety: CompanyBrsrSafetyIncidentRate }) {
  const hasValues = safety.hasData && safety.currentRate != null && safety.previousRate != null;

  return (
    <Card className="rounded-[12px] p-6">
      <h2 className="text-lg font-semibold">Safety incident rate</h2>
      <p className="mt-1 text-xs text-muted-foreground">Incidents per 1,000 employees, company-wide, latest FY vs the FY before it.</p>

      {hasValues ? (
        (() => {
          const deltaPct = safety.deltaPct ?? null;
          const isWorse = deltaPct != null && deltaPct > 0;
          const isBetter = deltaPct != null && deltaPct < 0;
          const Icon = isWorse ? TrendingUp : TrendingDown;
          return (
            <div className="mt-4 rounded-[12px] border border-surface-border bg-surface-raised/40 p-4">
              <p className="text-xs text-muted-foreground">{safety.periodLabel}</p>
              <p className="mt-1.5 text-2xl font-semibold text-foreground">{safety.currentRate} per 1,000</p>
              <p className="mt-1 text-xs text-muted-foreground">vs {safety.previousRate} per 1,000 the FY before</p>
              {deltaPct != null ? (
                <p
                  className={`mt-2 flex items-center gap-1 text-sm font-semibold ${
                    isWorse ? "text-danger" : isBetter ? "text-teal-500" : "text-muted-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {deltaPct > 0 ? "+" : ""}
                  {deltaPct}% vs previous FY
                </p>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">—</p>
              )}
            </div>
          );
        })()
      ) : (
        <DashboardEmptyState
          icon={ShieldAlert}
          title="Not enough data yet"
          description="This comparison appears once you have submitted safety figures for two reporting periods."
          ctaHref="/esg/brsr"
          ctaLabel="Go to BRSR Core"
        />
      )}
    </Card>
  );
}
