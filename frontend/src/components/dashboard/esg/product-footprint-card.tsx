"use client";

import { useEffect, useState } from "react";
import { Package } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DashboardEmptyState } from "../shared/dashboard-empty-state";
import { ApiError, productSkuApi } from "@/lib/api";
import type { ProductFootprintAllocation } from "@/lib/types";

const fmt = (n: number, digits = 2) => n.toLocaleString("en-IN", { maximumFractionDigits: digits });

/**
 * Indicative per-SKU footprint for one facility and period.
 *
 * The caveat is rendered above the table, not below it. A per-unit kgCO2e
 * figure looks precise and invites being quoted into a tender or a product
 * page, and a reader who has already taken the number will not scroll back for
 * a footnote. Two things have to land before the figures do: this is not a
 * life cycle assessment, and volume allocation assumes every product is
 * equally emissions-intensive per unit — which is usually false, and errs
 * against exactly the specialised lines customers ask about.
 */
export function ProductFootprintCard({ facilityId, period }: { facilityId: string; period: string }) {
  const [allocation, setAllocation] = useState<ProductFootprintAllocation | null>(null);
  const [notSubscribed, setNotSubscribed] = useState(false);

  useEffect(() => {
    productSkuApi
      .getAllocation(facilityId, period)
      .then(({ allocation }) => setAllocation(allocation))
      .catch((err) => {
        if (err instanceof ApiError && err.code === "ESG_BUNDLE_NOT_SUBSCRIBED") {
          setNotSubscribed(true);
          return;
        }
        setAllocation(null);
      });
  }, [facilityId, period]);

  if (notSubscribed) return null;

  return (
    <Card className="rounded-[12px] p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Product footprint</h2>
        <span className="text-xs text-muted-foreground">Indicative · {period}</span>
      </div>

      {/* Above the numbers, deliberately. */}
      <p className="mt-2 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-xs text-amber-500">
        Not a life cycle assessment. This divides this facility&apos;s own Scope 1 and 2 emissions across its
        products by share of output, so it excludes everything you buy in, all transport, the use phase and end of
        life — usually the majority of the real footprint. Volume allocation also assumes every product is equally
        emissions-intensive per unit, so an energy-heavy line is understated and a simple one overstated. Not for a
        customer declaration, an EPD or a CBAM submission.
      </p>

      {allocation?.hasData ? (
        <>
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">Emissions allocated</dt>
              <dd className="mt-0.5 text-sm font-medium">{fmt(allocation.facilityEmissionsTco2e)} tCO₂e</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Products listed</dt>
              <dd className="mt-0.5 text-sm font-medium">{allocation.skus.length}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Of facility output</dt>
              <dd className="mt-0.5 text-sm font-medium">
                {allocation.productionCoveragePct != null ? `${allocation.productionCoveragePct}%` : "Not comparable"}
              </dd>
            </div>
          </dl>

          {allocation.productionCoveragePct != null && allocation.productionCoveragePct < 100 && (
            <p className="mt-3 text-xs text-muted-foreground">
              These products account for {allocation.productionCoveragePct}% of this facility&apos;s reported output.
              The allocation splits the full emissions across them, so per-unit figures describe the listed products
              rather than the whole site.
            </p>
          )}

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-surface-border text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Product</th>
                  <th className="pb-2 text-right font-medium">Output</th>
                  <th className="pb-2 text-right font-medium">Share</th>
                  <th className="pb-2 text-right font-medium">Allocated</th>
                  <th className="pb-2 text-right font-medium">Per unit</th>
                </tr>
              </thead>
              <tbody>
                {allocation.skus.map((s) => (
                  <tr key={s.skuId} className="border-b border-surface-border/60 last:border-0">
                    <td className="py-2.5">
                      {s.name}
                      {s.skuCode && <span className="ml-1.5 text-xs text-muted-foreground">{s.skuCode}</span>}
                    </td>
                    <td className="py-2.5 text-right text-muted-foreground">
                      {fmt(s.productionQuantity)} {s.unit}
                    </td>
                    <td className="py-2.5 text-right text-muted-foreground">{s.allocationSharePct}%</td>
                    <td className="py-2.5 text-right text-muted-foreground">{fmt(s.allocatedTco2e)} t</td>
                    <td className="py-2.5 text-right font-medium">
                      {fmt(s.perUnitKgCo2e)} kg/{s.unit.replace(/s$/, "")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="mt-4">
          <DashboardEmptyState
            icon={Package}
            title="No product allocation yet"
            description={
              allocation?.unavailableReason ??
              "Add the products this facility makes for this period to allocate its emissions across them."
            }
            ctaHref={`/facilities/${facilityId}`}
            ctaLabel="Back to facility"
          />
        </div>
      )}
    </Card>
  );
}
