import { Card } from "@/components/ui/card";
import type { GhgCalculationResult } from "@/lib/types";

const fmt = (n: number, digits = 2) => n.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits });

/** Shared read-only calculation breakdown — used both as the live preview in the edit form and as the permanent view for a finalized engagement. */
export function GhgBreakdownView({ calculation }: { calculation: GhgCalculationResult }) {
  return (
    <Card className="p-6">
      <h2 className="text-sm font-semibold text-foreground">Calculation breakdown</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        GWP table: {calculation.gwpScheme} — {calculation.gwpSource}
      </p>

      <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Scope 1 — Direct emissions</h3>
      {calculation.scope1Results.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No Scope 1 sources.</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-surface-border text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Source</th>
                <th className="py-2 pr-3 font-medium">Quantity</th>
                <th className="py-2 pr-3 font-medium">Factor applied</th>
                <th className="py-2 pr-3 font-medium">Source citation</th>
                <th className="py-2 pr-3 font-medium text-right">tCO2e</th>
              </tr>
            </thead>
            <tbody>
              {calculation.scope1Results.map((r) => (
                <tr key={r.id} className="border-b border-surface-border last:border-0">
                  <td className="py-2 pr-3 text-foreground">{r.label}</td>
                  <td className="py-2 pr-3 text-muted-foreground">
                    {fmt(r.quantity)} {r.unit}
                  </td>
                  <td className="py-2 pr-3 text-muted-foreground">{r.factorApplied}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{r.source}</td>
                  <td className="py-2 pr-3 text-right font-medium text-foreground">{fmt(r.co2eTonnes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-right text-sm font-semibold text-foreground">Scope 1 total: {fmt(calculation.scope1TotalTco2e)} tCO2e</p>

      <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Scope 2 — Indirect emissions</h3>
      {calculation.scope2Results.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No Scope 2 sources.</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-surface-border text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Source</th>
                <th className="py-2 pr-3 font-medium">Consumption</th>
                <th className="py-2 pr-3 font-medium">Grid factor</th>
                <th className="py-2 pr-3 font-medium">Source citation</th>
                <th className="py-2 pr-3 font-medium text-right">tCO2e</th>
              </tr>
            </thead>
            <tbody>
              {calculation.scope2Results.map((r) => (
                <tr key={r.id} className="border-b border-surface-border last:border-0">
                  <td className="py-2 pr-3 text-foreground">{r.label}</td>
                  <td className="py-2 pr-3 text-muted-foreground">
                    {fmt(r.quantityValue)} {r.quantityUnit}
                  </td>
                  <td className="py-2 pr-3 text-muted-foreground">
                    {fmt(r.gridFactorValue, 4)} tCO2e/{r.quantityUnit}
                  </td>
                  <td className="py-2 pr-3 text-muted-foreground">{r.source}</td>
                  <td className="py-2 pr-3 text-right font-medium text-foreground">{fmt(r.co2eTonnes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-right text-sm font-semibold text-foreground">Scope 2 total: {fmt(calculation.scope2TotalTco2e)} tCO2e</p>

      <div className="mt-6 rounded-xl border border-teal-500/30 bg-teal-500/10 p-4 text-right">
        <p className="text-xs text-muted-foreground">Combined total (Scope 1 + Scope 2)</p>
        <p className="text-2xl font-semibold text-teal-500">{fmt(calculation.totalTco2e)} tCO2e</p>
      </div>
    </Card>
  );
}
