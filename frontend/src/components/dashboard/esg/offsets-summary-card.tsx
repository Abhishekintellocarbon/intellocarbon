"use client";

import { Leaf } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DashboardEmptyState } from "../shared/dashboard-empty-state";
import { OFFSET_CATEGORY_LABELS } from "@/lib/constants";
import type { OffsetCategory, OffsetsOverviewSummary } from "@/lib/types";

const fmtTonnes = (n: number) => `${n.toLocaleString("en-IN", { maximumFractionDigits: 1 })} tCO2e`;

const CATEGORY_ORDER: OffsetCategory[] = [
  "REMOVAL_NATURE",
  "REMOVAL_ENGINEERED",
  "AVOIDANCE_NATURE",
  "AVOIDANCE_ENGINEERED",
];

/**
 * Voluntary offsets logged company-wide, shown next to gross emissions.
 *
 * The gross figure is the ISSB total already computed for this page — this
 * card does not calculate emissions, and says where the number came from so
 * the comparison can't be mistaken for a certified net-zero position. When no
 * ISSB disclosure exists there is nothing to compare against, and the card
 * shows the offset tonnage alone rather than implying a residual of zero.
 */
export function OffsetsSummaryCard({ offsets }: { offsets: OffsetsOverviewSummary }) {
  const hasOffsets = offsets.purchaseCount > 0;

  return (
    <Card className="rounded-[12px] p-6">
      <h2 className="text-lg font-semibold">Voluntary offsets</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Carbon credits you have logged as retired, by category. Tracking only — Intellocarbon does not verify,
        rate, or issue these credits.
      </p>

      {hasOffsets ? (
        <>
          <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-2xl font-semibold text-teal-500">{fmtTonnes(offsets.totalTonnage)}</span>
            <span className="text-xs text-muted-foreground">
              across {offsets.purchaseCount} purchase{offsets.purchaseCount === 1 ? "" : "s"} ·{" "}
              {offsets.facilitiesReporting} facilit{offsets.facilitiesReporting === 1 ? "y" : "ies"}
            </span>
          </div>

          <ul className="mt-4 space-y-2 border-t border-surface-border pt-4">
            {CATEGORY_ORDER.map((category) => {
              const tonnage = offsets.byCategory[category] ?? 0;
              const pct = offsets.totalTonnage > 0 ? (tonnage / offsets.totalTonnage) * 100 : 0;
              return (
                <li key={category} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate text-muted-foreground">{OFFSET_CATEGORY_LABELS[category]}</span>
                  <span className="shrink-0 tabular-nums">
                    {fmtTonnes(tonnage)}
                    <span className="ml-2 text-xs text-muted">{pct.toFixed(1)}%</span>
                  </span>
                </li>
              );
            })}
          </ul>

          <div className="mt-4 border-t border-surface-border pt-4">
            {offsets.grossEmissionsTco2e != null ? (
              <>
                <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <div>
                    <dt className="text-xs text-muted-foreground">Gross emissions</dt>
                    <dd className="mt-0.5 text-sm font-medium">{fmtTonnes(offsets.grossEmissionsTco2e)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Less offsets logged</dt>
                    <dd className="mt-0.5 text-sm font-medium">{fmtTonnes(offsets.netAfterOffsetsTco2e ?? 0)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Offset coverage</dt>
                    <dd className="mt-0.5 text-sm font-medium">
                      {offsets.offsetCoveragePct != null ? `${offsets.offsetCoveragePct}%` : "—"}
                    </dd>
                  </div>
                </dl>
                <p className="mt-3 text-[11px] text-muted">
                  Gross emissions: {offsets.grossEmissionsSource}. Subtraction shown for reference only — it is not
                  a verified net or residual emissions figure.
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                No ISSB IFRS S1/S2 disclosure submitted yet, so there is no gross emissions total to compare these
                offsets against.
              </p>
            )}
          </div>
        </>
      ) : (
        <DashboardEmptyState
          icon={Leaf}
          title="No offsets logged yet"
          description="Log retired carbon credits against a facility to track them alongside your emissions."
          ctaHref="/facilities"
          ctaLabel="Go to facilities"
        />
      )}
    </Card>
  );
}
