"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Globe2, Loader2, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DraftBadge, SubmittedBadge } from "@/components/ui/draft-badge";
import { ApiError, griApi } from "@/lib/api";
import type { GriReport } from "@/lib/types";

/**
 * GRI reports for one facility, on the facility detail page.
 *
 * Self-contained and bundle-gated the same way VoluntaryOffsetsSection is —
 * it renders nothing at all for a company without the ESG Disclosure Bundle,
 * rather than showing a locked teaser, so the facility page stays identical
 * for those companies.
 */
export function GriSection({ facilityId }: { facilityId: string }) {
  const [reports, setReports] = useState<GriReport[] | null>(null);
  const [notSubscribed, setNotSubscribed] = useState(false);

  useEffect(() => {
    griApi
      .list(facilityId)
      .then(({ reports }) => setReports(reports))
      .catch((err) => {
        if (err instanceof ApiError && err.code === "ESG_BUNDLE_NOT_SUBSCRIBED") {
          setNotSubscribed(true);
          return;
        }
        // Any other failure leaves reports null and the section shows its
        // loading state rather than an error — this is a secondary panel on a
        // page whose primary content has already loaded.
        setReports([]);
      });
  }, [facilityId]);

  if (notSubscribed) return null;

  return (
    <>
      <div className="mt-10 mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">GRI Standards reports</h2>
        <Link href={`/facilities/${facilityId}/gri/new`}>
          <Button size="sm" variant="secondary">
            <Plus className="h-4 w-4" />
            Start GRI report
          </Button>
        </Link>
      </div>

      {reports === null ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-teal-500" />
        </div>
      ) : reports.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-surface-border bg-surface-raised">
            <Globe2 className="h-5 w-5 text-teal-500" />
          </span>
          <h3 className="font-medium">No GRI reports yet</h3>
          <p className="max-w-sm text-sm text-muted-foreground">
            Full GRI Standards 2021. Starts with a GRI 3 materiality assessment that determines which Topic Standards
            you report — emissions, energy and water figures are reused from this facility&apos;s activity data above.
          </p>
          <Link href={`/facilities/${facilityId}/gri/new`} className="mt-2">
            <Button size="sm" variant="secondary">
              <Plus className="h-4 w-4" />
              Start GRI report
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => {
            const isDraft = report.status === "DRAFT";
            const materialityComplete = report.materialityAssessment?.completedAt != null;
            const materialCount = report.materialTopics?.filter((t) => t.isMaterial).length ?? 0;

            // A draft whose materiality assessment is unfinished has to go
            // back to the assessment — the disclosure form is locked until it
            // is complete, so linking there would dead-end the user.
            const href = !materialityComplete
              ? `/facilities/${facilityId}/gri/${encodeURIComponent(report.reportingPeriod)}/materiality`
              : isDraft
                ? `/facilities/${facilityId}/gri/${encodeURIComponent(report.reportingPeriod)}/edit`
                : `/facilities/${facilityId}/gri/${encodeURIComponent(report.reportingPeriod)}`;

            return (
              <Link key={report.id} href={href}>
                <Card className="flex flex-col gap-3 p-5 transition-colors hover:border-teal-500/40 sm:flex-row sm:items-center sm:justify-between">
                  <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Globe2 className="h-3.5 w-3.5 text-muted" />
                    {report.reportingPeriod}
                    {isDraft ? <DraftBadge /> : <SubmittedBadge />}
                  </p>
                  <span className="text-xs text-muted">
                    {!materialityComplete
                      ? "Materiality assessment not finished"
                      : isDraft
                        ? `${materialCount} material topics · not yet submitted`
                        : `${materialCount} material topics · view report & download PDF`}
                  </span>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
