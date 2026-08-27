"use client";

import { useState } from "react";
import { ChevronDown, Flame, Layers, Sun } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CaveatsList, CitationsList, InputsList } from "./recommendation-provenance";
import type {
  RecommendationCard as RecommendationCardData,
  RecommendationCategory,
  RecommendationGridFactorSplit,
  RecommendationImpactRange,
} from "@/lib/types";

const CATEGORY_ICON: Record<RecommendationCategory, React.ReactNode> = {
  SCOPE_2_ELECTRICITY: <Sun className="h-4 w-4 text-amber-500" />,
  SCOPE_1_COMBUSTION: <Flame className="h-4 w-4 text-danger" />,
  LIABILITY_STRUCTURE: <Layers className="h-4 w-4 text-teal-500" />,
};

const fmt = (n: number, dp = 1) => n.toLocaleString("en-IN", { minimumFractionDigits: dp, maximumFractionDigits: dp });

/**
 * The impact range, drawn as a span rather than printed as a number.
 *
 * The engine never emits a point estimate, and the UI must not let one be read
 * out of it either. A bar whose *width* is the uncertainty makes the range the
 * primary visual fact — a reader who takes only the picture away still takes
 * away "somewhere between these two", which is exactly the claim being made.
 *
 * `scaleMax` is shared across every card in the section so the bars are
 * comparable to each other: a 19.6% lever must visibly outweigh a 4.3% one.
 */
function ImpactSpan({ impact, scaleMax }: { impact: RecommendationImpactRange; scaleMax: number }) {
  const suffix = impact.unit === "PERCENT_OF_TOTAL_EMISSIONS" ? "%" : " tCO2e/yr";
  const max = Math.max(scaleMax, impact.high, 1);
  const leftPct = Math.max(0, Math.min(100, (impact.low / max) * 100));
  const widthPct = Math.max(1.5, Math.min(100 - leftPct, ((impact.high - impact.low) / max) * 100));

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-xl font-semibold text-foreground">
          {fmt(impact.low)}
          {suffix} – {fmt(impact.high)}
          {suffix}
        </span>
        <span className="text-xs text-muted-foreground">{impact.metric.charAt(0).toLowerCase() + impact.metric.slice(1)}</span>
      </div>

      <div
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-raised"
        role="img"
        aria-label={`Estimated range: ${fmt(impact.low)}${suffix} to ${fmt(impact.high)}${suffix}`}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-teal-500/70 to-teal-500"
          style={{ marginLeft: `${leftPct}%`, width: `${widthPct}%` }}
        />
      </div>

      <p className="mt-2 text-[11px] leading-snug text-muted-foreground">{impact.basis}</p>
    </div>
  );
}

/**
 * A card with no impact range.
 *
 * Rendered as a stated absence rather than an empty space, because "we could
 * not size this" is itself the useful message — a deliberate refusal to guess,
 * not an unfinished card.
 *
 * It states no specific reason. An earlier version showed `caveats[0]`, which
 * silently assumed the first caveat was the one explaining the absence — on a
 * facility in an unlisted state it surfaced the open-access note instead, so
 * the card confidently gave the wrong reason for its own blank. The engine
 * already puts the real reason in two better places: the explanation directly
 * below, and the section header above. A third copy that can be wrong is worse
 * than none.
 */
function NoImpact() {
  return (
    <div className="rounded-lg border border-dashed border-surface-border px-3 py-2.5">
      <p className="text-xs font-medium text-muted-foreground">No impact range shown</p>
      <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
        The data needed to size this wasn&apos;t available, so nothing is shown rather than an estimated figure. The
        explanation below says what is missing.
      </p>
    </div>
  );
}

/**
 * The structural card's stand-in for an impact range.
 *
 * It proposes no action, so it has no impact — but it does carry the one split
 * the engine can derive exactly, and the displacement rate that makes the
 * volume side of Scope 2 actionable. Neither figure appears anywhere else in
 * the product, so this is where they get shown.
 */
function GridSplitStats({ split }: { split: RecommendationGridFactorSplit }) {
  const nationalPct = Math.max(0, Math.min(100, split.gridFactorDrivenSharePct));
  const hasOverride = Math.abs(split.facilityFactorChoiceSharePct) > 0.05;

  return (
    <div className="rounded-lg border border-surface-border bg-surface-raised/60 p-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="text-xs text-muted-foreground">Scope 2 electricity</span>
        <span className="text-sm font-semibold text-foreground">{fmt(split.scope2ElectricityCo2e)} tCO2e</span>
      </div>

      <div className="mt-2.5 flex h-2 w-full overflow-hidden rounded-full bg-surface" role="img" aria-label={`${fmt(nationalPct)}% of Scope 2 electricity emissions are set by the national grid factor`}>
        <div className="h-full bg-teal-500/80" style={{ width: `${nationalPct}%` }} />
        {hasOverride && <div className="h-full bg-blue-500/70" style={{ width: `${Math.max(0, 100 - nationalPct)}%` }} />}
      </div>

      <div className="mt-2 space-y-1">
        <p className="flex items-baseline justify-between gap-3 text-[11px]">
          <span className="text-muted-foreground">Set by the national grid factor</span>
          <span className="font-medium text-foreground">{fmt(split.gridFactorDrivenSharePct)}%</span>
        </p>
        {hasOverride && (
          <p className="flex items-baseline justify-between gap-3 text-[11px]">
            <span className="text-muted-foreground">Set by your own verified factor</span>
            <span className="font-medium text-foreground">{fmt(split.facilityFactorChoiceSharePct)}%</span>
          </p>
        )}
      </div>

      <div className="mt-3 grid gap-3 border-t border-surface-border pt-3 sm:grid-cols-2">
        <div>
          <p className="text-[11px] text-muted-foreground">Removed per MWh displaced</p>
          <p className="text-sm font-semibold text-foreground">{split.co2ePerMwhDisplaced} tCO2e</p>
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground">Already renewable or captive</p>
          <p className="text-sm font-semibold text-foreground">
            {fmt(split.renewableSharePct)}%
            {split.renewableElectricityMwh > 0 && (
              <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                avoiding {fmt(split.alreadyAvoidedCo2e)} tCO2e
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

export function RecommendationCard({
  card,
  scaleMax,
  gridSplit,
}: {
  card: RecommendationCardData;
  scaleMax: number;
  /** Only consumed by the structural card, which has no impact range of its own. */
  gridSplit?: RecommendationGridFactorSplit | null;
}) {
  const [open, setOpen] = useState(false);
  const detailId = `advisor-detail-${card.id}`;
  const isStructural = card.category === "LIABILITY_STRUCTURE";

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-surface-border bg-surface-raised">
            {CATEGORY_ICON[card.category]}
          </span>
          <h3 className="text-sm font-semibold leading-snug text-foreground">{card.title}</h3>
        </div>
        {card.requiresComplianceReview && (
          <span
            className="shrink-0 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-500"
            title="This card leans on a published figure our compliance team has not yet checked against its primary source. Treat it as directional."
          >
            Pending compliance review
          </span>
        )}
      </div>

      <div className="mt-4">
        {isStructural ? (
          gridSplit ? (
            <GridSplitStats split={gridSplit} />
          ) : null
        ) : card.impact ? (
          <ImpactSpan impact={card.impact} scaleMax={scaleMax} />
        ) : (
          <NoImpact />
        )}
      </div>

      <p className="mt-4 text-sm leading-relaxed text-foreground/90">{card.explanation}</p>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={detailId}
        className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-teal-500 transition-colors hover:text-teal-400"
      >
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
        {open ? "Hide workings" : "Show workings and sources"}
      </button>

      {open && (
        <div id={detailId} className="mt-4 space-y-4 border-t border-surface-border pt-4">
          <InputsList inputs={card.inputs} />
          <CitationsList citations={card.citations} />
          <CaveatsList caveats={card.caveats} />
        </div>
      )}
    </Card>
  );
}
