"use client";

import { Check, Landmark, Minus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DashboardEmptyState } from "../shared/dashboard-empty-state";
import type { GovernanceSummary } from "@/lib/types";

/**
 * Governance, gathered from disclosures already filed. Nothing new is asked
 * for here.
 *
 * The presentation problem this card has to solve: a list of ticks and
 * crosses reads as an audit result. It is not one. A tick means a field was
 * filled in a disclosure; nobody at Intellocarbon has read the underlying
 * policy. A cross means nothing was filed here — which is not the same as the
 * policy not existing, and a company may well have a code of conduct and
 * simply not have filed the disclosure that asks about it.
 *
 * So undisclosed rows use a neutral dash rather than a red cross, each names
 * the framework that would collect it so the row points somewhere actionable,
 * and the caveat sits with the list rather than beneath it.
 */
export function GovernanceCard({ governance }: { governance: GovernanceSummary }) {
  const board = governance.boardStructure;

  return (
    <Card className="rounded-[12px] p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Governance</h2>
        {governance.sources.length > 0 && (
          <p className="text-xs text-muted-foreground">From {governance.sources.join(", ")}</p>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Board structure and governance policies, gathered from the disclosures you have already filed.
      </p>

      {governance.hasAnyData ? (
        <>
          {board.hasData && (
            <div className="mt-5">
              <h3 className="text-xs font-medium text-muted-foreground">Board structure</h3>
              <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <dt className="text-xs text-muted-foreground">Members</dt>
                  <dd className="mt-0.5 text-sm font-medium">
                    {board.totalMembers ?? "—"}
                    {board.executiveMembers != null && board.nonExecutiveMembers != null && (
                      <span className="ml-1 text-xs font-normal text-muted-foreground">
                        ({board.executiveMembers} exec / {board.nonExecutiveMembers} non-exec)
                      </span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Independent</dt>
                  <dd className="mt-0.5 text-sm font-medium">
                    {board.independentPct != null ? `${board.independentPct}%` : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Gender diversity</dt>
                  <dd className="mt-0.5 text-sm font-medium">
                    {board.genderDiversityPct != null ? `${board.genderDiversityPct}%` : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Chair</dt>
                  <dd className="mt-0.5 text-sm font-medium">
                    {board.chairIsSeniorExecutive == null
                      ? "—"
                      : board.chairIsSeniorExecutive
                        ? "Also an executive"
                        : "Non-executive"}
                  </dd>
                </div>
              </dl>
              {board.committees && (
                <p className="mt-3 text-xs text-muted-foreground">Committees: {board.committees}</p>
              )}
            </div>
          )}

          <div className={board.hasData ? "mt-6 border-t border-surface-border pt-5" : "mt-5"}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-xs font-medium text-muted-foreground">Policies disclosed</h3>
              <span className="text-xs text-muted-foreground">
                {governance.disclosedCount} of {governance.totalCount}
              </span>
            </div>

            <ul className="mt-3 space-y-2">
              {governance.policies.map((policy) => {
                const disclosed = policy.state === "DISCLOSED";
                return (
                  <li key={policy.key} className="flex items-start justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-start gap-2">
                      {disclosed ? (
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-500" />
                      ) : (
                        // A neutral dash, not a red cross: nothing here is a finding.
                        <Minus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" />
                      )}
                      <span className={disclosed ? "" : "text-muted-foreground"}>{policy.label}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {disclosed ? policy.source : `via ${policy.collectedBy}`}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <p className="mt-4 border-t border-surface-border pt-4 text-xs text-muted-foreground">
            This shows what you have disclosed, not how good it is. A tick means the field was filled in one of your
            filed disclosures — we do not read, review or judge the underlying policy. A dash means it has not been
            disclosed in the frameworks filed here, which is not the same as the policy not existing.
          </p>
        </>
      ) : (
        <DashboardEmptyState
          icon={Landmark}
          title="No governance disclosures yet"
          description="File a GRI, CSRD or CDP disclosure and your board structure and governance policies are summarised here automatically."
          ctaHref="/esg/gri"
          ctaLabel="Start a GRI report"
        />
      )}
    </Card>
  );
}
