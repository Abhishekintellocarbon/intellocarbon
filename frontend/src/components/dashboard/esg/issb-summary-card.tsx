import { BadgeCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DashboardEmptyState } from "../shared/dashboard-empty-state";
import { fmtTco2e } from "../shared/dashboard-constants";
import type { EsgIssbSummary } from "@/lib/types";

/**
 * ISSB IFRS S1/S2 summary — the Metrics & Targets figures the module already
 * computes (issbCalculation.service.ts), rolled up across every facility that
 * filed for the latest period.
 *
 * Scope 1 and 2 are reused from the existing CBAM/CCTS calculation results on
 * the AR5 basis IFRS S2 follows; Scope 3 is the disclosed figure and is shown
 * as "not disclosed" rather than as zero when absent, since a missing
 * disclosure and a genuine zero mean different things to an assurer.
 */

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-surface-border bg-surface-raised p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-lg font-semibold text-foreground">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted">{hint}</p>}
    </div>
  );
}

export function IssbSummaryCard({ issb }: { issb: EsgIssbSummary }) {
  return (
    <Card className="rounded-[12px] p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">ISSB IFRS S1/S2</h2>
        {issb.hasReports && issb.periodLabel && <p className="text-xs text-muted-foreground">{issb.periodLabel}</p>}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Metrics &amp; targets across {issb.facilitiesReporting}{" "}
        {issb.facilitiesReporting === 1 ? "facility" : "facilities"} reporting.
      </p>

      {issb.hasReports ? (
        <>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Metric label="Scope 1" value={fmtTco2e(issb.scope1Tco2e)} hint="Reused from your activity data" />
            <Metric label="Scope 2" value={fmtTco2e(issb.scope2Tco2e)} hint="Electricity and steam" />
            <Metric
              label="Scope 3"
              value={issb.scope3Tco2e != null ? fmtTco2e(issb.scope3Tco2e) : "Not disclosed"}
              hint="As disclosed on the S2 report"
            />
            <Metric label="Total" value={fmtTco2e(issb.totalTco2e)} hint="Scope 1 + 2 (+ 3 where disclosed)" />
          </div>

          {(issb.nearestTargetYear != null || issb.baselineYear != null) && (
            <div className="mt-4 rounded-lg border border-surface-border bg-surface-raised/60 p-4">
              <p className="text-xs font-medium text-foreground">Transition target</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {issb.nearestTargetYear != null ? `Nearest target year ${issb.nearestTargetYear}` : "No target year disclosed"}
                {issb.baselineYear != null && issb.baselineEmissionsTco2e != null
                  ? ` · baseline ${issb.baselineYear} at ${fmtTco2e(issb.baselineEmissionsTco2e)}`
                  : ""}
              </p>
              {issb.changeFromBaselinePct != null && (
                <p
                  className={`mt-2 text-sm font-semibold ${
                    issb.changeFromBaselinePct < 0 ? "text-teal-500" : "text-[#F5A623]"
                  }`}
                >
                  {issb.changeFromBaselinePct < 0 ? "Down" : "Up"} {Math.abs(issb.changeFromBaselinePct)}% vs baseline
                </p>
              )}
            </div>
          )}
        </>
      ) : (
        <DashboardEmptyState
          icon={BadgeCheck}
          title="No ISSB disclosure yet"
          description="Submit an ISSB IFRS S1/S2 disclosure for a facility to see governance, strategy, risk and metrics rolled up here."
          ctaHref="/esg/issb"
          ctaLabel="Go to ISSB"
        />
      )}
    </Card>
  );
}
