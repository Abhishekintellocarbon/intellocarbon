"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, ScrollText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DraftBadge, SubmittedBadge } from "@/components/ui/draft-badge";
import { ApiError, cdpApi } from "@/lib/api";
import type { CdpReport } from "@/lib/types";

/**
 * CDP responses for one facility, on the facility detail page.
 *
 * Self-contained and bundle-gated the same way CsrdSection is — it renders
 * nothing at all for a company without the ESG Disclosure Bundle, rather than
 * showing a locked teaser, so the facility page stays identical for those
 * companies.
 */
export function CdpSection({ facilityId }: { facilityId: string }) {
  const [reports, setReports] = useState<CdpReport[] | null>(null);
  const [notSubscribed, setNotSubscribed] = useState(false);

  useEffect(() => {
    cdpApi
      .list(facilityId)
      .then(({ reports }) => setReports(reports))
      .catch((err) => {
        if (err instanceof ApiError && err.code === "ESG_BUNDLE_NOT_SUBSCRIBED") {
          setNotSubscribed(true);
          return;
        }
        // Any other failure leaves the section in its empty state rather than
        // showing an error — this is a secondary panel on a page whose primary
        // content has already loaded.
        setReports([]);
      });
  }, [facilityId]);

  if (notSubscribed) return null;

  return (
    <>
      <div className="mt-10 mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">CDP Climate Change responses</h2>
        <Link href={`/facilities/${facilityId}/cdp/new`}>
          <Button size="sm" variant="secondary">
            <Plus className="h-4 w-4" />
            Start CDP response
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
            <ScrollText className="h-5 w-5 text-teal-500" />
          </span>
          <h3 className="font-medium">No CDP responses yet</h3>
          <p className="max-w-sm text-sm text-muted-foreground">
            The full CDP Climate Change questionnaire. Start one only if a customer or investor asked you to — CDP is
            voluntary, not a legal requirement. Emissions, energy and Scope 3 figures are reused from this
            facility&apos;s activity data above.
          </p>
          <Link href={`/facilities/${facilityId}/cdp/new`} className="mt-2">
            <Button size="sm" variant="secondary">
              <Plus className="h-4 w-4" />
              Start CDP response
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => {
            const isDraft = report.status === "DRAFT";
            const counts = report._count;

            // Unlike GRI and CSRD there is no assessment gate, so a draft
            // always goes straight back to the module form.
            const href = isDraft
              ? `/facilities/${facilityId}/cdp/${encodeURIComponent(report.reportingPeriod)}/edit`
              : `/facilities/${facilityId}/cdp/${encodeURIComponent(report.reportingPeriod)}`;

            return (
              <Link key={report.id} href={href}>
                <Card className="flex flex-col gap-3 p-5 transition-colors hover:border-teal-500/40 sm:flex-row sm:items-center sm:justify-between">
                  <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <ScrollText className="h-3.5 w-3.5 text-muted" />
                    {report.reportingPeriod}
                    {isDraft ? <DraftBadge /> : <SubmittedBadge />}
                  </p>
                  <span className="text-xs text-muted">
                    {counts
                      ? `${counts.risks} risks & opportunities · ${counts.targets} targets · `
                      : ""}
                    {isDraft ? "in progress" : "view response & download pack"}
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
