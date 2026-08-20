"use client";

import { Factory } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DashboardEmptyState } from "../shared/dashboard-empty-state";
import type { GreenSteelAssessment } from "@/lib/types";

const fmtIntensity = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 3 });

/**
 * Green Steel Taxonomy position.
 *
 * ===========================================================================
 * NOT A CERTIFICATE, AND THE COPY HERE CARRIES THAT.
 *
 * NISST certifies; Intellocarbon calculates. So this card says a calculated
 * intensity "falls in the 4-star band" and never that the producer "is
 * 4-star", and it renders the band as a text label rather than a row of gold
 * stars — a star graphic is the single design choice most likely to be
 * screenshotted and passed off as a rating somebody was awarded.
 * ===========================================================================
 *
 * Renders nothing at all when the taxonomy does not apply. The parent decides
 * that from `applicable`, but this guards it too: a steel threshold shown
 * against a cement facility would be a meaningless number wearing a
 * regulatory badge.
 */
export function GreenSteelCard({ assessment }: { assessment: GreenSteelAssessment }) {
  if (!assessment.applicable) return null;

  const { figures, rating, threshold, history } = assessment;

  return (
    <Card className="rounded-[12px] p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Green Steel Taxonomy</h2>
        <p className="text-xs text-muted-foreground">{assessment.reportingPeriod}</p>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Ministry of Steel taxonomy — enforceable from FY2026-27. Threshold {threshold} tCO2e per tonne of finished
        steel.
      </p>

      {figures && rating ? (
        <>
          <div className="mt-5 flex flex-wrap items-end gap-x-8 gap-y-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Calculated band</p>
              {/* Text, not stars — see the note above. */}
              <p className="mt-1 text-2xl font-semibold">
                {rating.stars != null ? `${rating.stars}-star band` : "Below the 3-star threshold"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Your intensity</p>
              <p className="mt-1 text-2xl font-semibold">
                {fmtIntensity(figures.emissionIntensity)}
                <span className="ml-1 text-sm font-normal text-muted-foreground">tCO2e/t</span>
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Against threshold</p>
              <p className="mt-1 text-2xl font-semibold">
                {rating.percentBelowThreshold >= 0
                  ? `${rating.percentBelowThreshold}% below`
                  : `${Math.abs(rating.percentBelowThreshold)}% above`}
              </p>
            </div>
          </div>

          <p className="mt-4 text-sm text-muted-foreground">{rating.summary}</p>

          {history.length > 1 && (
            <div className="mt-5 border-t border-surface-border pt-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Intensity over time</p>
              <ul className="mt-2 space-y-1">
                {history.map((point) => (
                  <li key={point.reportingPeriod} className="flex items-baseline justify-between text-sm">
                    <span className="text-muted-foreground">{point.reportingPeriod}</span>
                    <span className="font-medium">
                      {fmtIntensity(point.emissionIntensity)} tCO2e/t
                      <span className="ml-2 text-xs text-muted-foreground">
                        {point.starRating != null ? `${point.starRating}-star band` : "not rated"}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="mt-4 text-xs text-muted-foreground">
            Aggregated from {figures.activityDataCount} submitted{" "}
            {figures.activityDataCount === 1 ? "entry" : "entries"} — {figures.totalEmissionsTco2e.toLocaleString(
              "en-IN",
              { maximumFractionDigits: 0 },
            )}{" "}
            tCO2e over {figures.productionTonnes.toLocaleString("en-IN", { maximumFractionDigits: 0 })} t.
          </p>
        </>
      ) : (
        <div className="mt-4">
          <DashboardEmptyState
            icon={Factory}
            title="No submitted activity data for this period"
            description="Submit activity data for this facility and the intensity, band and comparison against the 2.2 tCO2e threshold appear here."
            ctaHref="/activity-data"
            ctaLabel="Enter activity data"
          />
        </div>
      )}

      {/* Required on every surface that shows a band. Read from the API so the
          card, the response and the PDF cannot drift into three wordings. */}
      <p className="mt-5 rounded-[10px] border border-surface-border bg-surface/50 p-3 text-xs leading-relaxed text-muted-foreground">
        {assessment.certificationNotice}
      </p>
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{assessment.boundaryNotice}</p>
    </Card>
  );
}
