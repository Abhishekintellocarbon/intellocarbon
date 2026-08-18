"use client";

import { Network } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DashboardEmptyState } from "../shared/dashboard-empty-state";
import type { SupplierScorecard } from "@/lib/types";

const RISK_LABELS: Record<string, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  NOT_ASSESSED: "Not assessed",
};

const RISK_CLASS: Record<string, string> = {
  LOW: "text-teal-500",
  MEDIUM: "text-amber-500",
  HIGH: "text-danger",
  NOT_ASSESSED: "text-muted-foreground",
};

/**
 * Supplier ESG coverage.
 *
 * The percentage is deliberately never shown alone. "80% have a disclosure on
 * file" reads as a statement about the supply chain, when it is a statement
 * about however many suppliers the company chose to list — so the count sits
 * with it, and the share of spend those suppliers represent sits with it too
 * where that has been recorded.
 *
 * Nothing here rates another company. The risk flags are the customer's own
 * assessment of their own suppliers, and holding a disclosure says nothing
 * about what is in it.
 */
export function SupplierScorecardCard({ suppliers }: { suppliers: SupplierScorecard }) {
  const { riskBreakdown } = suppliers;

  return (
    <Card className="rounded-[12px] p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Supplier ESG</h2>
        <span className="text-xs text-muted-foreground">Self-assessed</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        ESG disclosures held for the key suppliers you have listed, with your own risk assessment of each.
      </p>

      {suppliers.hasData ? (
        <>
          {suppliers.supplierCount > 0 && (
            <div className="mt-5">
              <p className="text-3xl font-semibold text-teal-500">{suppliers.disclosureCoveragePct}%</p>
              {/* The denominator travels with the number, always. */}
              <p className="mt-0.5 text-xs text-muted-foreground">
                of the {suppliers.supplierCount} supplier{suppliers.supplierCount === 1 ? "" : "s"} you have listed
                {suppliers.spendCoveredPct != null
                  ? ` · they represent ${suppliers.spendCoveredPct}% of recorded spend`
                  : " · spend share not recorded, so this is not a supply-chain-wide figure"}
              </p>

              <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-surface-border pt-4 sm:grid-cols-4">
                {(["LOW", "MEDIUM", "HIGH", "NOT_ASSESSED"] as const).map((risk) => (
                  <div key={risk}>
                    <dt className="text-xs text-muted-foreground">{RISK_LABELS[risk]} risk</dt>
                    <dd className={`mt-0.5 text-sm font-medium ${RISK_CLASS[risk]}`}>{riskBreakdown[risk]}</dd>
                  </div>
                ))}
              </dl>

              {suppliers.highRiskWithoutDisclosure > 0 && (
                <p className="mt-3 text-xs text-amber-500">
                  {suppliers.highRiskWithoutDisclosure} supplier
                  {suppliers.highRiskWithoutDisclosure === 1 ? " you have" : "s you have"} flagged high risk
                  {suppliers.highRiskWithoutDisclosure === 1 ? " has" : " have"} no ESG disclosure on file.
                </p>
              )}
            </div>
          )}

          {suppliers.gri.hasData && (
            <div className={suppliers.supplierCount > 0 ? "mt-5 border-t border-surface-border pt-4" : "mt-5"}>
              <h3 className="text-xs font-medium text-muted-foreground">
                From your GRI 308 / 414 disclosure ({suppliers.gri.periodLabel})
              </h3>
              {/* Kept visually separate: GRI's percentage is of NEW suppliers
                  screened in the period, which answers a different question
                  from the coverage figure above. */}
              <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <dt className="text-xs text-muted-foreground">New screened (env)</dt>
                  <dd className="mt-0.5 text-sm font-medium">
                    {suppliers.gri.environmentalScreenedPct != null ? `${suppliers.gri.environmentalScreenedPct}%` : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">New screened (social)</dt>
                  <dd className="mt-0.5 text-sm font-medium">
                    {suppliers.gri.socialScreenedPct != null ? `${suppliers.gri.socialScreenedPct}%` : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Assessed</dt>
                  <dd className="mt-0.5 text-sm font-medium">{suppliers.gri.assessedCount ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Negative impacts</dt>
                  <dd className="mt-0.5 text-sm font-medium">{suppliers.gri.withNegativeImpactsCount ?? "—"}</dd>
                </div>
              </dl>
              <p className="mt-2 text-xs text-muted-foreground">
                These cover new suppliers screened in the reporting period — a different question from the coverage
                of your listed suppliers above, so the two are not comparable.
              </p>
            </div>
          )}

          <p className="mt-4 border-t border-surface-border pt-4 text-xs text-muted-foreground">
            Coverage is of the suppliers you have listed, not your whole supply base. Risk flags are your own
            assessment — Intellocarbon does not contact, screen, rate or verify suppliers, and a disclosure on file
            is not a judgement on what it contains.
          </p>
        </>
      ) : (
        <DashboardEmptyState
          icon={Network}
          title="No suppliers listed"
          description="Add your key suppliers and whether you hold an ESG disclosure for each, and coverage is tracked here."
          ctaHref="/esg/overview"
          ctaLabel="Add a supplier"
        />
      )}
    </Card>
  );
}
