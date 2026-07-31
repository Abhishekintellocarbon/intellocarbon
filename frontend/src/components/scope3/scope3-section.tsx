"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { DraftBadge, SubmittedBadge } from "@/components/ui/draft-badge";
import { scope3Api, ApiError } from "@/lib/api";
import type { Scope3Category, Scope3CategoryCatalogEntry, Scope3Data } from "@/lib/types";
import { METHOD_LABELS } from "./scope3-field-config";
import { Scope3EntryForm } from "./scope3-entry-form";

/**
 * Embeddable Scope 3 section for the ISSB and BRSR Core data-entry flows —
 * a standalone list of Scope3Data entries keyed on (facilityId,
 * reportingPeriod), not owned by either report. Phase 1 covers 5 of the 15
 * GHG Protocol categories; the other 10 are shown as "not yet supported"
 * rather than omitted, per the honesty requirement this was built against.
 */
export function Scope3Section({ facilityId, reportingPeriod }: { facilityId: string; reportingPeriod: string }) {
  const [categories, setCategories] = useState<Scope3CategoryCatalogEntry[] | null>(null);
  const [entries, setEntries] = useState<Scope3Data[]>([]);
  const [total, setTotal] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [openCategory, setOpenCategory] = useState<Scope3Category | null>(null);

  const load = useCallback(async () => {
    try {
      const [categoriesRes, dataRes] = await Promise.all([
        scope3Api.categories(),
        scope3Api.list(facilityId, reportingPeriod),
      ]);
      setCategories(categoriesRes.categories);
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

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-medium">
            Scope 3 emissions <span className="font-normal text-muted-foreground">(optional, if applicable)</span>
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            GHG Protocol value-chain categories. Phase 1 supports the 5 categories most relevant to Indian industrial
            clients — the rest are listed below for transparency, not omitted.
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

      {!categories && !loadError ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading Scope 3 categories...</p>
      ) : categories ? (
        <div className="mt-4 space-y-3">
          {categories.map((cat) => {
            if (!cat.prismaCategory) {
              return (
                <div
                  key={cat.number}
                  className="flex items-center justify-between rounded-xl border border-surface-border bg-background/40 px-4 py-3 opacity-60"
                >
                  <p className="text-sm">
                    Category {cat.number}: {cat.name}
                  </p>
                  <span className="text-xs font-medium text-muted-foreground">Not yet supported</span>
                </div>
              );
            }

            const category = cat.prismaCategory;
            const entry = entryFor(category);
            const isOpen = openCategory === category;

            return (
              <div key={cat.number} className="rounded-xl border border-surface-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">
                      Category {cat.number}: {cat.name}
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
                    {entry && (entry.status === "SUBMITTED" ? <SubmittedBadge /> : <DraftBadge />)}
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => setOpenCategory(isOpen ? null : category)}
                    >
                      {isOpen ? "Close" : entry ? "Edit" : "+ Add"}
                    </Button>
                  </div>
                </div>

                {isOpen && (
                  <Scope3EntryForm
                    facilityId={facilityId}
                    reportingPeriod={reportingPeriod}
                    category={category}
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
