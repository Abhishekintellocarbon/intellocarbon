"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Lightbulb, Loader2, TriangleAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { UpsellCard } from "@/components/facilities/dashboard/upsell-card";
import { recommendationsApi, ApiError } from "@/lib/api";
import { RecommendationCard } from "./recommendation-card";
import type { PlanDefinition, RecommendationReport } from "@/lib/types";

/**
 * IntelloAdvisor — decarbonization recommendations for one facility.
 *
 * Read-only and self-fetching, like the other dashboard sections. The server
 * derives the report from the stored emissions calculation on every request,
 * so there is nothing to refresh here and no regenerate button to offer: this
 * mounting is itself the regeneration.
 *
 * Every state is rendered explicitly — loading, no submitted data, an empty
 * rule set, and a failed fetch. On a feature whose value is that it never
 * invents a number, an ambiguous blank space is the one outcome that would
 * undermine it.
 */

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : null;

const fmtDateTime = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

function SectionHeading() {
  return (
    <div className="flex items-center gap-2">
      <Lightbulb className="h-4 w-4 text-teal-500" />
      <h2 className="text-lg font-semibold">Decarbonization recommendations</h2>
    </div>
  );
}

export function RecommendationsSection({
  facilityId,
  hasEsgBundle,
  esgBundlePlan,
}: {
  facilityId: string;
  /** ESG Disclosure Bundle subscription, from the dashboard's own billing fetch. */
  hasEsgBundle: boolean;
  esgBundlePlan: PlanDefinition | null;
}) {
  const [report, setReport] = useState<RecommendationReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Set when the server refuses on subscription grounds. Tracked separately
  // from `error` because it is not a failure — it is the paywall answering,
  // and it renders as an upsell rather than as something that went wrong.
  const [notSubscribed, setNotSubscribed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setReport(null);
    setError(null);
    setNotSubscribed(false);
    // Skipped when the company has no bundle: the request would be a
    // guaranteed 403 and the answer is already known. The server still gates
    // it — this only avoids a pointless round trip.
    if (!hasEsgBundle) {
      setNotSubscribed(true);
      return;
    }
    recommendationsApi
      .forFacility(facilityId)
      .then(({ report }) => !cancelled && setReport(report))
      .catch((err) => {
        if (cancelled) return;
        // Defence in depth: the client-side flag can be stale — a subscription
        // can lapse mid-session — so the server's own refusal is honoured too.
        if (err instanceof ApiError && err.code === "ESG_BUNDLE_NOT_SUBSCRIBED") {
          setNotSubscribed(true);
          return;
        }
        setError(
          err instanceof ApiError ? err.message : "Couldn't load recommendations for this facility. Please refresh the page.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [facilityId, hasEsgBundle]);

  if (notSubscribed) {
    return (
      <div>
        <SectionHeading />
        <p className="mt-1.5 text-sm text-muted-foreground">
          Rules-based decarbonization recommendations derived from this facility&apos;s own calculated emissions and your
          uploaded electricity bills.
        </p>
        <div className="mt-4 sm:max-w-md">
          {esgBundlePlan ? (
            <UpsellCard
              title={esgBundlePlan.name}
              priceLabel={esgBundlePlan.priceLabel}
              valueProposition="Cited solar sizing, fuel-switch analysis and a grid-factor breakdown for every facility"
            />
          ) : (
            <Card className="p-6">
              <p className="text-sm text-muted-foreground">
                IntelloAdvisor is part of the ESG Disclosure Bundle. Visit Billing to subscribe.
              </p>
            </Card>
          )}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <SectionHeading />
        <Card className="mt-4 p-6">
          <p className="text-sm text-danger">{error}</p>
        </Card>
      </div>
    );
  }

  if (!report) {
    return (
      <div>
        <SectionHeading />
        <Card className="mt-4 flex justify-center p-10">
          <Loader2 className="h-5 w-5 animate-spin text-teal-500" />
        </Card>
      </div>
    );
  }

  // No submitted period yet, so there is no calculation to reason about. The
  // server explains why in words; this just routes the customer to the fix.
  if (report.unavailableReason) {
    return (
      <div>
        <SectionHeading />
        <Card className="mt-4 p-6">
          <p className="text-sm text-muted-foreground">{report.unavailableReason}</p>
          <Link
            href={`/facilities/${facilityId}/data-entry`}
            className="mt-3 inline-block text-sm text-teal-500 hover:text-teal-400"
          >
            Enter activity data
          </Link>
        </Card>
      </div>
    );
  }

  const period =
    report.activityData?.periodStart && report.activityData?.periodEnd
      ? `${fmtDate(report.activityData.periodStart)} – ${fmtDate(report.activityData.periodEnd)}`
      : null;

  // Shared across every bar so the cards are visually comparable to one another
  // rather than each being scaled to its own maximum.
  const scaleMax = Math.max(...report.recommendations.map((c) => c.impact?.high ?? 0), 1);

  const anyPendingReview = report.recommendations.some((c) => c.requiresComplianceReview);

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <SectionHeading />
        {period && <p className="text-xs text-muted-foreground">{period}</p>}
      </div>

      <p className="mt-1.5 text-sm text-muted-foreground">
        Rules-based, derived from this facility&apos;s own calculated emissions and published benchmarks. Every figure below
        traces to one or the other — nothing here is estimated or generated.
      </p>

      {/* A state mismatch outranks everything else here: it can make every
          open-access figure below apply to the wrong regime. Rendered as a
          bordered warning rather than another line of muted text, because the
          engine deliberately did not resolve it and the customer has to. */}
      {report.billDataUsed.stateMismatch && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 px-3.5 py-3">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div>
            <p className="text-xs font-semibold text-warning">
              This bill is from {report.billDataUsed.stateMismatch.billState}, but the facility is registered in{" "}
              {report.billDataUsed.stateMismatch.facilityState}
            </p>
            <p className="mt-1 text-[11px] leading-snug text-foreground/80">
              {report.billDataUsed.stateMismatch.message}
            </p>
          </div>
        </div>
      )}

      {/* Sizing depends on the sanctioned load, which comes from an uploaded
          bill. Saying so up front turns a missing impact range further down
          from a gap into a task the customer can act on. */}
      {report.billDataUsed.sanctionedLoad ? (
        <p className="mt-1.5 text-xs text-muted-foreground">
          Using a sanctioned load of{" "}
          <span className="font-medium text-foreground">
            {report.billDataUsed.sanctionedLoad.value.toLocaleString("en-IN")} {report.billDataUsed.sanctionedLoad.unit}
          </span>{" "}
          read from an uploaded bill
          {report.billDataUsed.sanctionedLoad.discomName ? ` (${report.billDataUsed.sanctionedLoad.discomName})` : ""}.
        </p>
      ) : (
        report.billDataUsed.absenceReason && (
          <p className="mt-1.5 text-xs text-amber-500">{report.billDataUsed.absenceReason}</p>
        )
      )}

      {report.recommendations.length === 0 ? (
        <Card className="mt-4 p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No recommendations apply to this facility&apos;s current emissions profile. The rule set only fires where a
            lever is material — nothing here means nothing was found, not that nothing was checked.
          </p>
        </Card>
      ) : (
        <div className="mt-4 space-y-4">
          {report.recommendations.map((card) => (
            <RecommendationCard key={card.id} card={card} scaleMax={scaleMax} gridSplit={report.gridFactorSplit} />
          ))}
        </div>
      )}

      <div className="mt-4 space-y-1.5">
        {anyPendingReview && (
          <p className="text-[11px] leading-snug text-amber-500">
            Cards marked <span className="font-medium">Pending compliance review</span> rely on a published figure that
            has not yet been checked against its primary source. Treat those as directional and confirm before acting.
          </p>
        )}
        <p className="text-[11px] leading-snug text-muted-foreground">
          Directional guidance, not verified project calculations or professional advice. Based on the emissions
          calculation of {fmtDateTime(report.basedOnCalculationAt)} on the CBAM (AR5) basis, and regenerated each time
          this page is opened.
        </p>
      </div>
    </div>
  );
}
