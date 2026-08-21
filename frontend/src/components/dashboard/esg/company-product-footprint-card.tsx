import { Package } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DashboardEmptyState } from "../shared/dashboard-empty-state";
import type { CompanyProductFootprint } from "@/lib/types";

const fmt = (n: number, digits = 2) => n.toLocaleString("en-IN", { maximumFractionDigits: digits });

/**
 * Per-SKU footprint across every facility, for the unified ESG Overview.
 *
 * The company-level twin of ProductFootprintCard, which is scoped to one
 * facility and fetches its own data. This one is presentational: the overview
 * already loads the whole payload in a single request, so adding a second
 * fetch here would put one card on a different loading clock from the twenty
 * around it.
 *
 * Three things differ from the facility card, and each is a correctness point
 * rather than a style choice:
 *
 *   - There is a Facility column, because allocation is only defined inside a
 *     facility. The same product made at two sites is two rows with two
 *     per-unit figures, not one merged figure.
 *   - The share column is headed "Share of site", since shares are computed
 *     against each facility's own output and do not sum to 100 down a
 *     multi-site table.
 *   - There is no single coverage percentage. Coverage compares listed SKUs
 *     against a facility's reported production, and only where the units
 *     agree; rolled up across sites it would be an average of ratios with
 *     different denominators. The count of sites is reported instead.
 *
 * The caveat sits above the numbers for the same reason it does on the
 * facility card: a per-unit kgCO2e figure looks precise and invites being
 * quoted into a tender, and a reader who has taken the number will not scroll
 * back for a footnote.
 */
export function CompanyProductFootprintCard({ footprint }: { footprint: CompanyProductFootprint }) {
  return (
    <Card className="rounded-[12px] p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Product footprint</h2>
        {footprint.periodLabel && (
          <span className="text-xs text-muted-foreground">Indicative · {footprint.periodLabel}</span>
        )}
      </div>

      {/* Above the numbers, deliberately. Same substance as the facility
          card's notice and PRODUCT_FOOTPRINT_NOTICE on the backend — worded
          for a multi-site view ("each facility's" rather than "this
          facility's"), but conceding nothing. */}
      <p className="mt-2 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-xs text-amber-500">
        Not a life cycle assessment. Each figure divides that facility&apos;s own Scope 1 and 2 emissions across its
        products by share of output, so it excludes everything you buy in, all transport, the use phase and end of
        life — usually the majority of the real footprint. Volume allocation also assumes every product is equally
        emissions-intensive per unit, so an energy-heavy line is understated and a simple one overstated. Not for a
        customer declaration, an EPD or a CBAM submission.
      </p>

      {footprint.hasData ? (
        <>
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">Emissions allocated</dt>
              <dd className="mt-0.5 text-sm font-medium">{fmt(footprint.totalAllocatedTco2e)} tCO₂e</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Products listed</dt>
              <dd className="mt-0.5 text-sm font-medium">{footprint.skuCount}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Facilities allocated</dt>
              <dd className="mt-0.5 text-sm font-medium">{footprint.facilitiesAllocated}</dd>
            </div>
          </dl>

          <p className="mt-3 text-xs text-muted-foreground">
            Each product is allocated against its own facility&apos;s emissions, so per-unit figures are comparable
            within a site but not between sites. A product made at two facilities appears once per facility.
          </p>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-surface-border text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Product</th>
                  <th className="pb-2 font-medium">Facility</th>
                  <th className="pb-2 text-right font-medium">Output</th>
                  <th className="pb-2 text-right font-medium">Share of site</th>
                  <th className="pb-2 text-right font-medium">Allocated</th>
                  <th className="pb-2 text-right font-medium">Per unit</th>
                </tr>
              </thead>
              <tbody>
                {footprint.rows.map((row) => (
                  <tr key={`${row.facilityId}-${row.skuId}`} className="border-b border-surface-border/60 last:border-0">
                    <td className="py-2.5">
                      {row.name}
                      {row.skuCode && <span className="ml-1.5 text-xs text-muted-foreground">{row.skuCode}</span>}
                    </td>
                    <td className="py-2.5 text-muted-foreground">{row.facilityName}</td>
                    <td className="py-2.5 text-right text-muted-foreground">
                      {fmt(row.productionQuantity)} {row.unit}
                    </td>
                    <td className="py-2.5 text-right text-muted-foreground">{row.allocationSharePct}%</td>
                    <td className="py-2.5 text-right text-muted-foreground">{fmt(row.allocatedTco2e)} t</td>
                    <td className="py-2.5 text-right font-medium">
                      {fmt(row.perUnitKgCo2e)} kg/{row.unit.replace(/s$/, "")}
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
              footprint.unavailableReason ??
              "Add the products your facilities make for a reporting period to allocate their emissions across them."
            }
            ctaHref="/facilities"
            ctaLabel="Go to facilities"
          />
        </div>
      )}
    </Card>
  );
}
