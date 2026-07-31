"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { DraftBadge, SubmittedBadge } from "@/components/ui/draft-badge";
import { Tooltip } from "@/components/ui/tooltip";
import { companyApi, scope3Api, ApiError } from "@/lib/api";
import type {
  CalculableScope3Category,
  Scope3Category,
  Scope3CategoryRelevance,
  Scope3Data,
  Scope3Relevance,
} from "@/lib/types";
import { METHOD_LABELS } from "./scope3-field-config";
import { Scope3EntryForm } from "./scope3-entry-form";

/**
 * Embeddable Scope 3 section for the ISSB and BRSR Core data-entry flows —
 * a standalone list of Scope3Data entries keyed on (facilityId,
 * reportingPeriod), not owned by either report.
 *
 * All 15 GHG Protocol categories are rendered, each tagged with its relevance
 * for this company (from sector + ownership model + business model). Only 5
 * have a calculation path today; a relevant category without one shows a
 * "Coming soon" badge, and a category that doesn't apply to this company is
 * disabled with the reasoning in a tooltip rather than silently dropped.
 */

const RELEVANCE_CHIP: Record<Scope3Relevance, { label: string; className: string }> = {
  MANDATORY: {
    label: "Required",
    className: "border-teal-500/30 bg-teal-500/10 text-teal-500",
  },
  OPTIONAL: {
    label: "Optional",
    className: "border-surface-border bg-surface-raised text-muted-foreground",
  },
  NOT_APPLICABLE: {
    label: "Not applicable",
    className: "border-surface-border bg-surface-raised text-muted-foreground",
  },
};

function RelevanceChip({ relevance, reasoning }: { relevance: Scope3Relevance; reasoning: string }) {
  const { label, className } = RELEVANCE_CHIP[relevance];
  return (
    <Tooltip content={reasoning}>
      <span
        className={`inline-flex cursor-help items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${className}`}
      >
        {label}
        <Info className="h-3 w-3" />
      </span>
    </Tooltip>
  );
}

/** Same visual language as the Coming Soon chips on the public /esg page. */
function ComingSoonChip() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-surface-border bg-surface-raised px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
      <Clock className="h-3 w-3" />
      Coming soon
    </span>
  );
}

export function Scope3Section({ facilityId, reportingPeriod }: { facilityId: string; reportingPeriod: string }) {
  const [relevance, setRelevance] = useState<Scope3CategoryRelevance[] | null>(null);
  const [entries, setEntries] = useState<Scope3Data[]>([]);
  const [total, setTotal] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [openCategory, setOpenCategory] = useState<Scope3Category | null>(null);

  const load = useCallback(async () => {
    try {
      // The relevance answer is per company, and Scope 3 is only ever entered
      // for the caller's own company, so the id comes from /api/company
      // rather than being threaded through both parent report forms.
      const [{ company }, dataRes] = await Promise.all([companyApi.getMine(), scope3Api.list(facilityId, reportingPeriod)]);
      if (!company) {
        setLoadError("Complete your company profile to record Scope 3 emissions.");
        return;
      }
      const relevanceRes = await scope3Api.relevance(company.id);

      setRelevance(relevanceRes.categories);
      setEntries(dataRes.entries);
      setTotal(dataRes.totalSubmittedTco2e);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Couldn't load Scope 3 data. Please refresh the page.");
    }
  }, [facilityId, reportingPeriod]);

  useEffect(() => {
    load();
  }, [load]);

  const entryFor = (category: Scope3Category) => entries.find((e) => e.category === category);

  // Mandatory categories that can actually be filled in today and haven't
  // been submitted yet. Categories still marked "Coming soon" are excluded —
  // it would be dishonest to hold a disclosure open against a form that
  // doesn't exist.
  const outstandingMandatory = (relevance ?? []).filter(
    (cat) => cat.relevance === "MANDATORY" && cat.calculable && entryFor(cat.prismaCategory)?.status !== "SUBMITTED",
  );

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-medium">
            Scope 3 emissions <span className="font-normal text-muted-foreground">(value chain)</span>
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            All 15 GHG Protocol value-chain categories, tagged for your sector and business model. Five are calculable
            today; the rest are listed with their relevance so nothing material is silently omitted.
          </p>
        </div>
        {total > 0 && (
          <div className="shrink-0 text-right">
            <p className="text-2xl font-bold tabular-nums text-teal-500">{total}</p>
            <p className="text-xs text-muted-foreground">tCO2e submitted</p>
          </div>
        )}
      </div>

      {loadError && (
        <Alert variant="error">
          <span>{loadError}</span>
        </Alert>
      )}

      {relevance && outstandingMandatory.length > 0 && (
        <div className="mt-4">
          <Alert variant="info">
            <span>
              {outstandingMandatory.length} required{" "}
              {outstandingMandatory.length === 1 ? "category is" : "categories are"} not yet submitted:{" "}
              {outstandingMandatory.map((c) => `Category ${c.category}`).join(", ")}.
            </span>
          </Alert>
        </div>
      )}

      {!relevance && !loadError ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading Scope 3 categories...</p>
      ) : relevance ? (
        <div className="mt-4 space-y-3">
          {relevance.map((cat) => {
            const notApplicable = cat.relevance === "NOT_APPLICABLE";
            const entry = entryFor(cat.prismaCategory);
            const isOpen = openCategory === cat.prismaCategory;

            // Disabled and explained, rather than hidden — a reader of the
            // inventory needs to see that the category was considered.
            if (notApplicable) {
              return (
                <div
                  key={cat.category}
                  aria-disabled
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-surface-border bg-background/40 px-4 py-3 opacity-60"
                >
                  <p className="text-sm">
                    Category {cat.category}: {cat.name}
                  </p>
                  <RelevanceChip relevance={cat.relevance} reasoning={cat.reasoning} />
                </div>
              );
            }

            return (
              <div key={cat.category} className="rounded-xl border border-surface-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">
                      Category {cat.category}: {cat.name}
                    </p>
                    {entry && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {METHOD_LABELS[entry.calculationMethod]} ·{" "}
                        <span className="font-semibold text-foreground">{entry.calculatedEmissionsTco2e} tCO2e</span> ·{" "}
                        {entry.emissionFactorSource}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <RelevanceChip relevance={cat.relevance} reasoning={cat.reasoning} />
                    {cat.calculable ? (
                      <>
                        {entry && (entry.status === "SUBMITTED" ? <SubmittedBadge /> : <DraftBadge />)}
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => setOpenCategory(isOpen ? null : cat.prismaCategory)}
                        >
                          {isOpen ? "Close" : entry ? "Edit" : "+ Add"}
                        </Button>
                      </>
                    ) : (
                      <ComingSoonChip />
                    )}
                  </div>
                </div>

                {isOpen && cat.calculable && (
                  <Scope3EntryForm
                    facilityId={facilityId}
                    reportingPeriod={reportingPeriod}
                    category={cat.prismaCategory as CalculableScope3Category}
                    existingEntry={entry}
                    onSaved={() => {
                      setOpenCategory(null);
                      load();
                    }}
                    onDeleted={() => {
                      setOpenCategory(null);
                      load();
                    }}
                    onCancel={() => setOpenCategory(null)}
                  />
                )}
              </div>
            );
          })}
        </div>
      ) : null}
    </Card>
  );
}
