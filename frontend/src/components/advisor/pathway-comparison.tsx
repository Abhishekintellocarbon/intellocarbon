"use client";

import { useState } from "react";
import { ArrowRight, ChevronDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  METRIC_UNIT_SUFFIX,
  cctsPositionLabel,
  changeTone,
  formatAtPrecision,
  formatChange,
  formatProjected,
} from "@/lib/pathway-display";
import { CaveatsList, CitationsList, InputsList, SourceBadge } from "./recommendation-provenance";
import type { PathwayMetric } from "@/lib/types";

/**
 * One metric's before/after comparison.
 *
 * The layout carries the argument: the current position on the left, an arrow,
 * the projection on the right, and the two sides deliberately styled so they
 * cannot be mistaken for each other. The left is a solid card in the normal
 * foreground colour; the right sits on a dashed purple border, in the projection
 * colour, with a "Projected from …" badge above it. A reader glancing at a
 * screenshot must be able to say which number their plant actually produced.
 */

const TONE_CLASS = {
  GOOD: "text-teal-500",
  BAD: "text-danger",
  NEUTRAL: "text-muted-foreground",
} as const;

function CurrentSide({ metric }: { metric: PathwayMetric }) {
  const suffix = METRIC_UNIT_SUFFIX[metric.metric];
  const dp = metric.projected?.decimals ?? 1;

  return (
    <div className="min-w-0 flex-1 rounded-lg border border-surface-border bg-surface-raised/60 p-3.5">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Now</span>
        <SourceBadge source={metric.currentSource} />
      </div>
      <p className="mt-2 text-lg font-semibold text-foreground">
        {metric.current === null ? "—" : `${formatAtPrecision(metric.current, dp)}${suffix}`}
      </p>
      {metric.metric === "CCTS_POSITION_TCO2E" && metric.current !== null && (
        <p className="mt-0.5 text-[11px] text-muted-foreground">{cctsPositionLabel(metric.current)} against target</p>
      )}
    </div>
  );
}

function ProjectedSide({ metric }: { metric: PathwayMetric }) {
  const suffix = METRIC_UNIT_SUFFIX[metric.metric];
  if (!metric.projected) return null;

  return (
    <div className="min-w-0 flex-1 rounded-lg border border-dashed border-purple-400/50 bg-purple-400/[0.06] p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-purple-300">Projected</span>
        <SourceBadge source="PROJECTED" derivedFrom={metric.projectedFrom} />
      </div>
      {/* Italic and in the projection colour, so the figure itself is marked
          and not only the label above it. */}
      <p className="mt-2 text-lg font-semibold italic text-purple-300">
        {formatProjected(metric.projected)}
        {suffix}
      </p>
      {metric.metric === "CCTS_POSITION_TCO2E" && (
        <p className="mt-0.5 text-[11px] text-purple-300/80">
          {metric.projected.isPoint
            ? `${cctsPositionLabel(metric.projected.low)} against target`
            : "surplus or deficit against target, across the range"}
        </p>
      )}
    </div>
  );
}

export function MetricComparison({ metric }: { metric: PathwayMetric }) {
  const [open, setOpen] = useState(false);
  const detailId = `pathway-detail-${metric.metric}`;
  const changeText = formatChange(metric);
  const tone = changeTone(metric);
  const suffix = METRIC_UNIT_SUFFIX[metric.metric];

  if (metric.unavailableReason) {
    return (
      <div className="rounded-xl border border-surface-border p-4">
        <p className="text-xs font-semibold text-foreground">{metric.label}</p>
        <div className="mt-2 rounded-lg border border-dashed border-surface-border px-3 py-2.5">
          <p className="text-[11px] font-medium text-muted-foreground">Not projected</p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{metric.unavailableReason}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-surface-border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-xs font-semibold text-foreground">{metric.label}</p>
        {changeText && (
          <p className={cn("text-xs font-semibold", TONE_CLASS[tone])}>
            {changeText}
            {suffix}
          </p>
        )}
      </div>

      <div className="mt-3 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
        <CurrentSide metric={metric} />
        <ArrowRight className="mx-auto h-4 w-4 shrink-0 rotate-90 text-muted-foreground sm:rotate-0" aria-hidden />
        <ProjectedSide metric={metric} />
      </div>

      {/* The basis is not optional detail — it is the sentence that stops a
          range being read as a confidence interval, or a point value being
          read as a certainty. It sits with the numbers, not behind a toggle. */}
      {metric.projected && (
        <p className="mt-2.5 text-[11px] leading-snug text-muted-foreground">{metric.projected.basis}</p>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={detailId}
        className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-teal-500 transition-colors hover:text-teal-400"
      >
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
        {open ? "Hide workings" : "Show workings and sources"}
      </button>

      {open && (
        <div id={detailId} className="mt-4 space-y-4 border-t border-surface-border pt-4">
          <InputsList inputs={metric.inputs} />
          <CitationsList citations={metric.citations} />
          <CaveatsList caveats={metric.caveats} />
        </div>
      )}
    </div>
  );
}

/** The legend that tells a first-time reader what the dashed purple styling means. */
export function ProjectionLegend() {
  return (
    <p className="flex items-start gap-1.5 text-[11px] leading-snug text-muted-foreground">
      <TrendingUp className="mt-0.5 h-3 w-3 shrink-0 text-purple-300" aria-hidden />
      <span>
        Figures shown <span className="italic text-purple-300">in this style</span> are projections under the selected
        scenario, not measured or calculated results. Each one names what it was projected from.
      </span>
    </p>
  );
}
