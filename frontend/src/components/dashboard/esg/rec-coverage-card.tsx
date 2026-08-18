"use client";

import { BadgeCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DashboardEmptyState } from "../shared/dashboard-empty-state";
import type { RecCoverage } from "@/lib/types";

const fmtMwh = (n: number) => `${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })} MWh`;

/**
 * REC coverage — the share of grid electricity backed by certificates.
 *
 * The denominator is grid electricity, not total. Electricity already
 * reported as renewable carries its attribute without a certificate, so
 * including it would both flatter the percentage and imply the same
 * megawatt-hour was claimed twice. The card says which denominator it used.
 *
 * Coverage above 100% is shown rather than capped: over-procurement is real,
 * but so is double counting, and the purchaser is the one who can tell them
 * apart.
 */
export function RecCoverageCard({ coverage }: { coverage: RecCoverage }) {
  const latest = coverage.latest;

  return (
    <Card className="rounded-[12px] p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Renewable certificates</h2>
        {latest && <p className="text-xs text-muted-foreground">{latest.periodLabel}</p>}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Coverage of grid electricity by certificates whose vintage matches the consumption year.
      </p>

      {coverage.hasData ? (
        <>
          {latest && (
            <div className="mt-5">
              <p className="text-3xl font-semibold text-teal-500">
                {latest.coveragePct != null ? `${latest.coveragePct}%` : "—"}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {latest.coveragePct != null
                  ? `of ${fmtMwh(latest.gridElectricityMwh)} grid electricity in ${latest.periodLabel}`
                  : `No grid electricity drawn in ${latest.periodLabel} — no certificates needed`}
              </p>

              <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-surface-border pt-4 sm:grid-cols-4">
                <div>
                  <dt className="text-xs text-muted-foreground">Certificates matched</dt>
                  <dd className="mt-0.5 text-sm font-medium">{fmtMwh(latest.recsMatchedMwh)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Grid electricity</dt>
                  <dd className="mt-0.5 text-sm font-medium">{fmtMwh(latest.gridElectricityMwh)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Already renewable</dt>
                  <dd className="mt-0.5 text-sm font-medium">{fmtMwh(latest.directRenewableMwh)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Held in total</dt>
                  <dd className="mt-0.5 text-sm font-medium">{fmtMwh(coverage.totalRecsMwh)}</dd>
                </div>
              </dl>
            </div>
          )}

          {latest?.overCovered && (
            <p className="mt-4 text-xs text-amber-500">
              You hold more certificates for {latest.periodLabel} than grid electricity drawn. That may be
              deliberate over-procurement, or certificates bought against consumption not reported here — worth
              checking, since the other reading is double counting.
            </p>
          )}

          {coverage.unmatchedRecs.length > 0 && (
            <div className="mt-4 border-t border-surface-border pt-4">
              <p className="text-xs font-medium text-foreground">
                {fmtMwh(coverage.unmatchedMwh)} not matched to a reported year
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Vintage {coverage.unmatchedRecs.map((r) => r.vintageYear).join(", ")} — no electricity is reported
                for {coverage.unmatchedRecs.length === 1 ? "that year" : "those years"}, so these cannot back a
                claim here. They are excluded from the coverage figure above.
              </p>
            </div>
          )}

          {coverage.periods.length > 1 && (
            <div className="mt-4 border-t border-surface-border pt-4">
              <h3 className="text-xs font-medium text-muted-foreground">By period</h3>
              <ul className="mt-3 space-y-2">
                {coverage.periods
                  .slice()
                  .reverse()
                  .map((p) => (
                    <li key={p.year} className="flex items-center justify-between gap-3 text-sm">
                      <span>{p.periodLabel}</span>
                      <span className="shrink-0 text-muted-foreground">
                        {p.coveragePct != null ? `${p.coveragePct}%` : "no grid draw"} ·{" "}
                        {fmtMwh(p.recsMatchedMwh)}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          )}

          <p className="mt-4 border-t border-surface-border pt-4 text-xs text-muted-foreground">
            Certificates are recorded as you enter them. Intellocarbon does not verify, rate or issue them and does
            not check them against a registry.
          </p>
        </>
      ) : (
        <DashboardEmptyState
          icon={BadgeCheck}
          title="No certificates recorded"
          description="Log renewable energy certificates and their coverage of your grid electricity is tracked here, matched by vintage year."
          ctaHref="/esg/overview"
          ctaLabel="Add a certificate"
        />
      )}
    </Card>
  );
}
