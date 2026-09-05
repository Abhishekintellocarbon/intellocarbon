"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Route } from "lucide-react";
import { Card } from "@/components/ui/card";
import { UpsellCard } from "@/components/facilities/dashboard/upsell-card";
import { pathwayApi, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { MetricComparison, ProjectionLegend } from "./pathway-comparison";
import type { PathwayReport, PathwayScenarioId, PlanDefinition } from "@/lib/types";

/**
 * IntelloAdvisor — Pathway Modelling.
 *
 * Sits below the recommendation cards, because it projects the very things
 * those cards recommend. Self-fetching and read-only like the rest of the
 * dashboard: the server derives the projection from the stored calculation on
 * every request, so there is nothing to refresh.
 *
 * The production-change scenario is the only one that takes an input, and it is
 * deliberately not pre-filled. A default percentage would put a number on the
 * screen that the customer never chose, which is the one thing this feature
 * cannot do — so the scenario shows its own explanation until a value is
 * entered, and the server says the same thing independently.
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
      <Route className="h-4 w-4 text-purple-300" />
      <h2 className="text-lg font-semibold">Pathway modelling</h2>
    </div>
  );
}

function ScenarioSelector({
  report,
  selected,
  onSelect,
}: {
  report: PathwayReport;
  selected: PathwayScenarioId;
  onSelect: (id: PathwayScenarioId) => void;
}) {
  return (
    <div role="tablist" aria-label="Projection scenario" className="mt-4 flex flex-wrap gap-2">
      {report.scenarios.map((s) => {
        const active = s.id === selected;
        return (
          <button
            key={s.id}
            role="tab"
            type="button"
            id={`pathway-tab-${s.id}`}
            aria-selected={active}
            aria-controls={`pathway-panel-${s.id}`}
            onClick={() => onSelect(s.id)}
            className={cn(
              "rounded-lg border px-3 py-2 text-left text-xs transition-colors",
              active
                ? "border-purple-400/50 bg-purple-400/10 text-foreground"
                : "border-surface-border bg-surface-raised/60 text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="block font-semibold">{s.title}</span>
            <span className="mt-0.5 block text-[11px] leading-snug">{s.summary}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * The production-change input.
 *
 * Kept as an explicit submit rather than a live-updating field: each change is
 * a server round trip, and a projection that flickers through six intermediate
 * volumes while someone types "-12.5" is both wasteful and misleading to watch.
 */
function ProductionChangeInput({
  value,
  onApply,
  pending,
}: {
  value: number | null;
  onApply: (pct: number | null) => void;
  pending: boolean;
}) {
  const [draft, setDraft] = useState(value === null ? "" : String(value));

  return (
    <form
      className="mt-3 flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = draft.trim();
        if (trimmed === "") return onApply(null);
        const parsed = Number(trimmed);
        if (Number.isFinite(parsed)) onApply(parsed);
      }}
    >
      <label className="text-xs text-muted-foreground">
        <span className="block">Change in production volume (%)</span>
        <input
          type="number"
          step="0.1"
          min={-99}
          max={200}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="e.g. 10 or -15"
          className="mt-1 w-40 rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-purple-400/60"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-purple-400/50 bg-purple-400/10 px-3 py-2 text-xs font-medium text-purple-300 transition-colors hover:bg-purple-400/20 disabled:opacity-50"
      >
        {pending ? "Projecting…" : "Project"}
      </button>
    </form>
  );
}

export function PathwaySection({
  facilityId,
  hasEsgBundle,
  esgBundlePlan,
}: {
  facilityId: string;
  /** ESG Disclosure Bundle subscription, from the dashboard's own billing fetch. */
  hasEsgBundle: boolean;
  esgBundlePlan: PlanDefinition | null;
}) {
  const [report, setReport] = useState<PathwayReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notSubscribed, setNotSubscribed] = useState(false);
  const [selected, setSelected] = useState<PathwayScenarioId>("BUSINESS_AS_USUAL");
  const [productionChangePct, setProductionChangePct] = useState<number | null>(null);
  const [pending, setPending] = useState(false);

  const load = useCallback(
    (pct: number | null, signal: { cancelled: boolean }) => {
      setPending(true);
      setError(null);
      pathwayApi
        .forFacility(facilityId, pct)
        .then(({ report }) => {
          if (!signal.cancelled) setReport(report);
        })
        .catch((err) => {
          if (signal.cancelled) return;
          // Defence in depth: the client-side flag can be stale — a
          // subscription can lapse mid-session — so the server's own refusal is
          // honoured too.
          if (err instanceof ApiError && err.code === "ESG_BUNDLE_NOT_SUBSCRIBED") {
            setNotSubscribed(true);
            return;
          }
          setError(
            err instanceof ApiError ? err.message : "Couldn't load pathway projections for this facility. Please refresh the page.",
          );
        })
        .finally(() => {
          if (!signal.cancelled) setPending(false);
        });
    },
    [facilityId],
  );

  useEffect(() => {
    const signal = { cancelled: false };
    setReport(null);
    setError(null);
    setNotSubscribed(false);
    // Skipped when the company has no bundle: the request would be a guaranteed
    // 403 and the answer is already known. The server still gates it — this
    // only avoids a pointless round trip.
    if (!hasEsgBundle) {
      setNotSubscribed(true);
      return;
    }
    load(productionChangePct, signal);
    return () => {
      signal.cancelled = true;
    };
  }, [facilityId, hasEsgBundle, productionChangePct, load]);

  if (notSubscribed) {
    return (
      <div>
        <SectionHeading />
        <p className="mt-1.5 text-sm text-muted-foreground">
          Project this facility&apos;s emissions, CBAM liability and CCTS position forward under a chosen scenario, from
          the same calculated data your recommendations are built on.
        </p>
        <div className="mt-4 sm:max-w-md">
          {esgBundlePlan ? (
            <UpsellCard
              title={esgBundlePlan.name}
              priceLabel={esgBundlePlan.priceLabel}
              valueProposition="Forward projections of liability and CCTS position under solar, production-change and business-as-usual scenarios"
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
          <Loader2 className="h-5 w-5 animate-spin text-purple-300" />
        </Card>
      </div>
    );
  }

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

  const scenario = report.scenarios.find((s) => s.id === selected) ?? report.scenarios[0];
  const period =
    report.activityData?.periodStart && report.activityData?.periodEnd
      ? `${fmtDate(report.activityData.periodStart)} – ${fmtDate(report.activityData.periodEnd)}`
      : null;

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <SectionHeading />
        {period && <p className="text-xs text-muted-foreground">{period}</p>}
      </div>

      <p className="mt-1.5 text-sm text-muted-foreground">
        Projects this facility&apos;s calculated position forward under a scenario. It introduces no new calculation
        model — the emissions, the certificate pricing and the CCTS position are the same ones behind your reports, run
        with one input changed.
      </p>

      <ScenarioSelector report={report} selected={scenario.id} onSelect={setSelected} />

      <Card
        className="mt-4 p-5"
        role="tabpanel"
        id={`pathway-panel-${scenario.id}`}
        aria-labelledby={`pathway-tab-${scenario.id}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h3 className="text-sm font-semibold text-foreground">{scenario.title}</h3>
          {scenario.requiresComplianceReview && (
            <span
              className="shrink-0 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-500"
              title="This scenario leans on a published figure our compliance team has not yet checked against its primary source. Treat it as directional."
            >
              Pending compliance review
            </span>
          )}
        </div>

        {/* The assumption comes before the numbers, deliberately. A projection
            read without its assumption is a forecast, which is not what this is. */}
        <p className="mt-2 text-xs leading-relaxed text-foreground/80">{scenario.assumption}</p>

        {scenario.id === "PRODUCTION_CHANGE" && (
          <ProductionChangeInput value={productionChangePct} onApply={setProductionChangePct} pending={pending} />
        )}

        {scenario.unavailableReason ? (
          <div className="mt-4 rounded-lg border border-dashed border-surface-border px-3.5 py-3">
            <p className="text-xs font-medium text-muted-foreground">Nothing projected</p>
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{scenario.unavailableReason}</p>
          </div>
        ) : (
          <>
            <div className="mt-4">
              <ProjectionLegend />
            </div>
            <div className="mt-3 space-y-3">
              {scenario.metrics.map((m) => (
                <MetricComparison key={m.metric} metric={m} />
              ))}
            </div>
          </>
        )}
      </Card>

      <p className="mt-4 text-[11px] leading-snug text-muted-foreground">
        Projections, not forecasts or verified project calculations, and not professional advice. Based on the emissions
        calculation of {fmtDateTime(report.basedOnCalculationAt)} on the CBAM (AR5) basis, priced at the{" "}
        {report.current?.certificatePrice} EUR/tCO2e certificate price for {report.current?.certificatePriceQuarter}, and
        regenerated each time this page is opened.
      </p>
    </div>
  );
}
