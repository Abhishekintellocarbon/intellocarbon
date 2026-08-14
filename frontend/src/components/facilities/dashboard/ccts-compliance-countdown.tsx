"use client";

import { CalendarClock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { FacilityDashboard } from "@/lib/types";

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" });

// Same thresholds as the deadline grid's countdown cards, so a CCTS date
// doesn't turn amber at a different point from a CBAM one.
const toneFor = (daysRemaining: number): "green" | "amber" | "red" => {
  if (daysRemaining <= 7) return "red";
  if (daysRemaining <= 30) return "amber";
  return "green";
};

const TONE_TEXT: Record<"green" | "amber" | "red", string> = {
  green: "text-teal-500",
  amber: "text-warning",
  red: "text-danger",
};

/**
 * CCTS annual compliance cycle countdown.
 *
 * The deadline grid at the top of the dashboard already carries a bare "CCTS
 * annual compliance" card, in the same shape as the CBAM quarterly countdown.
 * This is that countdown with the cycle context around it — which compliance
 * year the 31 July date actually settles (the FY that closed the preceding
 * 31 March), and whether that year's GHG intensity report can be generated
 * yet. Both come from the existing regulatory calendar in
 * data/complianceDeadlines.ts; no date is computed in the frontend.
 */
export function CctsComplianceCountdown({ dashboard }: { dashboard: FacilityDashboard }) {
  const { cctsCompliance } = dashboard;
  const tone = toneFor(cctsCompliance.daysRemaining);

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">CCTS compliance cycle</h2>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-surface-border bg-surface-raised px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
          <CalendarClock className="h-3 w-3" />
          {cctsCompliance.complianceYear}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Compliance for {cctsCompliance.complianceYear} is settled on 31 July — intensity performance verified and any
        CCC shortfall surrendered by that date.
      </p>

      <p className={cn("mt-4 text-4xl font-bold tabular-nums", TONE_TEXT[tone])}>
        {Math.max(0, cctsCompliance.daysRemaining)}
        <span className="ml-1.5 text-sm font-medium text-muted-foreground">days left</span>
      </p>
      <p className="mt-2 text-xs text-muted-foreground">{fmtDate(cctsCompliance.deadline)}</p>

      <div className="mt-5 border-t border-surface-border pt-4">
        <p className="text-xs text-muted-foreground">GHG intensity report — {cctsCompliance.reportPeriod}</p>
        {cctsCompliance.reportWindowIsOpen ? (
          <p className="mt-0.5 text-sm font-medium text-teal-500">
            Open for generation until {fmtDate(cctsCompliance.reportWindowCloses)}
          </p>
        ) : (
          <p className="mt-0.5 text-sm font-medium text-muted-foreground">
            Opens {fmtDate(cctsCompliance.reportWindowOpens)}
          </p>
        )}
      </div>
    </Card>
  );
}
