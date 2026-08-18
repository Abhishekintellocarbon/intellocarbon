"use client";

import { Check, ClipboardList, Minus } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { EcovadisReadiness, ReadinessBand } from "@/lib/types";

const BAND_LABELS: Record<ReadinessBand, string> = {
  NOT_STARTED: "Not started",
  DEVELOPING: "Developing",
  ESTABLISHED: "Established",
  STRONG: "Strong",
};

const BAND_CLASS: Record<ReadinessBand, string> = {
  STRONG: "border-teal-500/30 bg-teal-500/10 text-teal-500",
  ESTABLISHED: "border-teal-500/20 bg-teal-500/5 text-teal-500",
  DEVELOPING: "border-amber-500/30 bg-amber-500/10 text-amber-500",
  NOT_STARTED: "border-surface-border bg-surface-raised text-muted-foreground",
};

/**
 * EcoVadis readiness across the four themes.
 *
 * The "this is not a score" notice sits above the bands, not below them.
 * EcoVadis is a scoring body, so a percentage next to its name is read as a
 * predicted score unless the card says otherwise before the reader gets
 * there — the same reason CDP's readiness bands carry their caveat up front.
 *
 * Coverage percentages are per theme and deliberately never rolled into a
 * single headline number, which would look like the 0-100 EcoVadis actually
 * awards.
 */
export function EcovadisReadinessCard({ ecovadis }: { ecovadis: EcovadisReadiness }) {
  return (
    <Card className="rounded-[12px] p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">EcoVadis readiness</h2>
        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${BAND_CLASS[ecovadis.overallBand]}`}>
          {BAND_LABELS[ecovadis.overallBand]}
        </span>
      </div>

      {/* Before the numbers, deliberately. */}
      <p className="mt-2 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-xs text-amber-500">
        {ecovadis.notScoreNotice}
      </p>

      <div className="mt-5 space-y-3">
        {ecovadis.themes.map((theme) => (
          <div key={theme.key} className="rounded-xl border border-surface-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">{theme.label}</p>
              <span className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {theme.metCount} of {theme.totalCount}
                </span>
                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${BAND_CLASS[theme.band]}`}>
                  {BAND_LABELS[theme.band]}
                </span>
              </span>
            </div>

            <ul className="mt-3 space-y-1.5">
              {theme.indicators.map((indicator) => (
                <li key={indicator.key} className="flex items-start justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-start gap-2">
                    {indicator.met ? (
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-500" />
                    ) : (
                      <Minus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" />
                    )}
                    <span className={indicator.met ? "" : "text-muted-foreground"}>{indicator.label}</span>
                  </span>
                  {/* A gap points at the surface that would fill it. */}
                  <span className="shrink-0 text-xs text-muted-foreground">{indicator.sourcedFrom}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {ecovadis.gaps.length > 0 && (
        <div className="mt-5 border-t border-surface-border pt-4">
          <h3 className="text-xs font-medium text-muted-foreground">Where you would be starting from nothing</h3>
          <ul className="mt-2 space-y-1.5">
            {ecovadis.gaps.map((gap, i) => (
              <li key={i} className="flex gap-2 text-xs text-muted-foreground">
                <span className="text-amber-500">•</span>
                <span>{gap}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-4 flex items-start gap-1.5 border-t border-surface-border pt-4 text-xs text-muted-foreground">
        <ClipboardList className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>{ecovadis.notSubmissionNotice}</span>
      </p>
    </Card>
  );
}
