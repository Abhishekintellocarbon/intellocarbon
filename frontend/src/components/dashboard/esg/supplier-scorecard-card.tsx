"use client";

import { useMemo, useState } from "react";
import { Network } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DashboardEmptyState } from "../shared/dashboard-empty-state";
import { cn } from "@/lib/utils";
import type { SupplierScorecard, SupplierScorecardRow } from "@/lib/types";

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

type DotTone = "done" | "partial" | "none" | "alert";

const DOT_CLASS: Record<DotTone, string> = {
  done: "bg-teal-500",
  partial: "bg-[#F5A623]",
  alert: "bg-danger",
  // Not a lighter teal — an untracked state has to read as absent rather than
  // as a weaker version of done.
  none: "bg-surface-border",
};

/** A labelled state dot. `title` carries the reading for anyone hovering. */
function StatusDot({ tone, title }: { tone: DotTone; title: string }) {
  return (
    <span className="flex items-center gap-1.5" title={title}>
      <span className={cn("h-2 w-2 shrink-0 rounded-full", DOT_CLASS[tone])} />
    </span>
  );
}

/**
 * The three states this platform holds per supplier.
 *
 * Deliberately not a per-ESG-category grid. Supplier carries no category
 * columns, and GRI 308/414 are company-level aggregates about new suppliers
 * screened in a period — there is no per-supplier category detail anywhere to
 * colour in, so a category grid would be drawing states nobody entered.
 */
const rowStates = (row: SupplierScorecardRow) => [
  {
    key: "disclosure",
    label: "ESG disclosure",
    tone: (row.hasEsgDisclosure ? "done" : "none") as DotTone,
    title: row.hasEsgDisclosure
      ? `Disclosure on file${row.disclosureType ? ` — ${row.disclosureType}` : ""}`
      : "No ESG disclosure on file",
  },
  {
    key: "risk",
    label: "Risk assessment",
    tone: (row.riskFlag === "NOT_ASSESSED"
      ? "none"
      : row.riskFlag === "HIGH"
        ? "alert"
        : row.riskFlag === "MEDIUM"
          ? "partial"
          : "done") as DotTone,
    title:
      row.riskFlag === "NOT_ASSESSED"
        ? "Not assessed"
        : `Your own assessment: ${RISK_LABELS[row.riskFlag]} risk`,
  },
  {
    key: "review",
    label: "Reviewed",
    tone: (row.lastReviewedAt ? "done" : "none") as DotTone,
    title: row.lastReviewedAt
      ? `Last reviewed ${new Date(row.lastReviewedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`
      : "No review recorded",
  },
];

type Filter = "all" | "missing" | "held";
type Sort = "outstanding" | "spend" | "name";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "missing", label: "No disclosure" },
  { key: "held", label: "Disclosure held" },
];

const SORTS: { key: Sort; label: string }[] = [
  { key: "outstanding", label: "Outstanding first" },
  { key: "spend", label: "Spend share" },
  { key: "name", label: "Name" },
];

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
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("outstanding");

  const visibleRows = useMemo(() => {
    const filtered = suppliers.rows.filter((row) =>
      filter === "all" ? true : filter === "held" ? row.hasEsgDisclosure : !row.hasEsgDisclosure,
    );
    // "outstanding" is the backend's own ordering, so it is left untouched
    // rather than re-derived here and allowed to drift from it.
    if (sort === "outstanding") return filtered;
    const copy = [...filtered];
    if (sort === "name") return copy.sort((a, b) => a.name.localeCompare(b.name));
    // Suppliers with no recorded share sort last rather than as zero — "not
    // recorded" is not "small".
    return copy.sort((a, b) => (b.spendSharePct ?? -1) - (a.spendSharePct ?? -1));
  }, [suppliers.rows, filter, sort]);

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
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="text-3xl font-semibold text-teal-500">{suppliers.disclosureCoveragePct}%</p>
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{suppliers.withDisclosureCount}</span> of{" "}
                  {suppliers.supplierCount} supplier{suppliers.supplierCount === 1 ? "" : "s"} reporting
                </p>
              </div>

              {/* Same bar, tones and thresholds as the disclosure completeness
                  strip — teal at full, amber part-way, muted at nothing. */}
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-raised">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    suppliers.disclosureCoveragePct === 100
                      ? "bg-teal-500"
                      : (suppliers.disclosureCoveragePct ?? 0) > 0
                        ? "bg-[#F5A623]"
                        : "bg-surface-border",
                  )}
                  style={{ width: `${suppliers.disclosureCoveragePct ?? 0}%` }}
                />
              </div>

              {/* The denominator travels with the number, always. */}
              <p className="mt-2 text-xs text-muted-foreground">
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

              {/* The rows themselves. Every listed supplier and only listed
                  suppliers — nothing is padded to fill the table, so three
                  suppliers render as three rows. */}
              {suppliers.rows.length > 0 && (
                <div className="mt-5 border-t border-surface-border pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {FILTERS.map((option) => {
                        const count =
                          option.key === "all"
                            ? suppliers.rows.length
                            : suppliers.rows.filter((row) =>
                                option.key === "held" ? row.hasEsgDisclosure : !row.hasEsgDisclosure,
                              ).length;
                        return (
                          <button
                            key={option.key}
                            type="button"
                            onClick={() => setFilter(option.key)}
                            className={cn(
                              "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                              filter === option.key
                                ? "border-teal-500/40 bg-teal-500/10 text-teal-500"
                                : "border-surface-border bg-surface-raised text-muted-foreground hover:text-foreground",
                            )}
                          >
                            {option.label} ({count})
                          </button>
                        );
                      })}
                    </div>

                    <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      Sort
                      <select
                        value={sort}
                        onChange={(event) => setSort(event.target.value as Sort)}
                        className="rounded-lg border border-surface-border bg-surface-raised px-2 py-1 text-[11px] text-foreground"
                      >
                        {SORTS.map((option) => (
                          <option key={option.key} value={option.key}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {/* Legend above the rows, so a dot is never read before its
                      meaning. The three columns are the three states held per
                      supplier — not ESG categories, which are not tracked. */}
                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
                    {/* Teal carries two readings because the columns do:
                        recorded in Disclosure and Reviewed, low risk in Risk.
                        The legend says both rather than picking one. */}
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-teal-500" /> Recorded · low risk
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-[#F5A623]" /> Medium risk
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-danger" /> High risk
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-surface-border" /> Not recorded · not assessed
                    </span>
                  </div>

                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[420px] text-sm">
                      <thead>
                        <tr className="border-b border-surface-border text-left text-[11px] text-muted-foreground">
                          <th className="pb-2 font-medium">Supplier</th>
                          <th className="pb-2 text-right font-medium">Spend</th>
                          <th className="pb-2 text-center font-medium">Disclosure</th>
                          <th className="pb-2 text-center font-medium">Risk</th>
                          <th className="pb-2 text-center font-medium">Reviewed</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleRows.map((row) => (
                          <tr key={row.id} className="border-b border-surface-border/60 last:border-0">
                            <td className="py-2.5 pr-3">
                              <span className="font-medium text-foreground">{row.name}</span>
                              {(row.sector || row.country) && (
                                <span className="ml-1.5 text-xs text-muted-foreground">
                                  {[row.sector, row.country].filter(Boolean).join(" · ")}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 text-right text-xs text-muted-foreground">
                              {row.spendSharePct != null ? `${row.spendSharePct}%` : "—"}
                            </td>
                            {rowStates(row).map((state) => (
                              <td key={state.key} className="py-2.5">
                                <span className="flex justify-center">
                                  <StatusDot tone={state.tone} title={`${state.label}: ${state.title}`} />
                                </span>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {visibleRows.length === 0 && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      No suppliers match this filter.
                    </p>
                  )}
                </div>
              )}

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
          ctaHref="/esg/data"
          ctaLabel="Add a supplier"
        />
      )}
    </Card>
  );
}
