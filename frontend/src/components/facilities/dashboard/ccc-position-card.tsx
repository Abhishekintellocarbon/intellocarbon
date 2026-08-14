"use client";

import { Scale, TrendingDown, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DashboardEmptyState } from "@/components/dashboard/shared/dashboard-empty-state";
import { fmtCredits, fmtInr, fmtIntensity } from "@/components/dashboard/shared/dashboard-constants";
import { cn } from "@/lib/utils";
import type { FacilityDashboard } from "@/lib/types";

/**
 * CCC surplus/deficit tracker.
 *
 * Presentation only. The credits shown are dashboard.cctsPosition.cccCredits,
 * which the backend reads off the CCTS calculation output — the
 * (target intensity − achieved intensity) × production formula lives in the
 * calculation engine and is not repeated here or anywhere in the frontend.
 *
 * The valuation is separate from the position on purpose: a facility can be
 * 4,000 CCC in deficit today and there is still no rupee figure to put on it,
 * because no CCC has traded. Which of those two pending states applies is the
 * backend's call, and both keep the credits visible.
 */
export function CccPositionCard({ dashboard, facilityId }: { dashboard: FacilityDashboard; facilityId: string }) {
  const { cctsPosition } = dashboard;

  if (!cctsPosition) {
    return (
      <Card className="p-6">
        <h2 className="text-lg font-semibold">CCC position</h2>
        <DashboardEmptyState
          icon={Scale}
          title="No CCTS position yet"
          description="Submit activity data for a reporting period to see whether this facility is in CCC surplus or deficit."
          ctaHref={`/facilities/${facilityId}/data-entry/new`}
          ctaLabel="Add data entry"
        />
      </Card>
    );
  }

  if (cctsPosition.status === "TARGET_PENDING") {
    return (
      <Card className="p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">CCC position</h2>
          <span className="rounded-full border border-surface-border bg-surface-raised px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
            Target not notified
          </span>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{cctsPosition.reason}</p>
        <p className="mt-4 border-t border-surface-border pt-3 text-xs text-muted-foreground">
          Enter this facility&apos;s registered BEE target on its activity data entry to see the position.
        </p>
      </Card>
    );
  }

  const { isSurplus, cccCredits, targetIntensity, actualIntensity } = cctsPosition;
  const Icon = isSurplus ? TrendingUp : TrendingDown;

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">CCC position</h2>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
            isSurplus ? "border-teal-500/30 bg-teal-500/10 text-teal-500" : "border-danger/30 bg-danger/10 text-danger",
          )}
        >
          <Icon className="h-3 w-3" />
          {isSurplus ? "Surplus" : "Deficit"}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Notified target {fmtIntensity(targetIntensity)} vs achieved {fmtIntensity(actualIntensity)} tCO2e/t, across this
        period&apos;s production.
      </p>

      <p className={cn("mt-4 text-3xl font-semibold tabular-nums", isSurplus ? "text-teal-500" : "text-danger")}>
        {fmtCredits(cccCredits)}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {isSurplus
          ? "Issued to this facility for beating its notified intensity target — these can be sold once CCC trading opens."
          : "Shortfall against the notified intensity target — these must be bought and surrendered, or environmental compensation applies."}
      </p>

      <div className="mt-5 border-t border-surface-border pt-4">
        {cctsPosition.status === "VALUED" ? (
          <>
            <p className="text-xs text-muted-foreground">
              {isSurplus ? "Sale value" : "Cost to cover"} at {fmtInr(cctsPosition.pricePerCreditInr)}/CCC (as of{" "}
              {cctsPosition.priceAsOfDate})
            </p>
            <p className={cn("mt-0.5 text-lg font-semibold", isSurplus ? "text-teal-500" : "text-foreground")}>
              {fmtInr(cctsPosition.positionValueInr)}
            </p>
            {cctsPosition.penaltyExposureInr != null && (
              <>
                <p className="mt-3 text-xs text-muted-foreground">
                  Exposure if not surrendered — environmental compensation at {cctsPosition.penaltyMultiplier}× the
                  market price
                </p>
                <p className="mt-0.5 text-lg font-semibold text-danger">{fmtInr(cctsPosition.penaltyExposureInr)}</p>
                <p className="mt-2 text-[11px] text-muted">{cctsPosition.penaltySource}</p>
              </>
            )}
            <p className="mt-2 text-[11px] text-muted">Price source: {cctsPosition.priceSource}</p>
          </>
        ) : (
          <>
            {/* Never a rupee figure here — not a zero, not an estimate. The
                credits above are real; the price to value them at is not. */}
            <p className="text-xs text-muted-foreground">
              {isSurplus ? "Sale value" : "Cost to cover"}
            </p>
            <p className="mt-0.5 text-sm font-medium text-warning">
              {cctsPosition.status === "MARKET_NOT_OPEN"
                ? `Market not yet open — ${cctsPosition.opensLabel}`
                : "Price not yet available"}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">{cctsPosition.reason}</p>
            {!isSurplus && (
              <p className="mt-3 text-xs text-muted-foreground">
                A shortfall that is not surrendered attracts environmental compensation at twice the average CCC market
                price for the compliance year — which can only be quantified once that price exists.
              </p>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
