"use client";

import { BookMarked, Calculator, FileText, Info, MapPin, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  RecommendationCitation,
  RecommendationInput,
  RecommendationInputSource,
} from "@/lib/types";

/**
 * Provenance rendering for a recommendation card.
 *
 * The engine's whole claim is that no figure is invented, and that claim is
 * only worth anything if the reader can check it. So every number a card
 * quotes is shown here with where it came from, and every external figure with
 * the document it was taken from. This is not supporting detail that could be
 * dropped for a tidier card — it is the difference between a recommendation and
 * an assertion.
 *
 * The three sources are styled distinctly on purpose. "0.716 tCO2e/MWh from
 * CEA" and "2,500 kVA read off your bill by OCR" carry very different
 * confidence, and rendering them identically would flatten that away.
 */

const SOURCE_META: Record<
  RecommendationInputSource,
  { label: string; className: string; icon: React.ReactNode; hint: string }
> = {
  PLATFORM_CALCULATION: {
    label: "Your calculated data",
    className: "border-teal-500/30 bg-teal-500/10 text-teal-500",
    icon: <Calculator className="h-2.5 w-2.5" />,
    hint: "Taken from this facility's own emissions calculation on the platform.",
  },
  BILL_EXTRACTION: {
    label: "Read from your bill",
    className: "border-blue-500/30 bg-blue-500/10 text-blue-400",
    icon: <FileText className="h-2.5 w-2.5" />,
    hint: "Extracted from an electricity bill you uploaded. Check it against the document if it looks wrong.",
  },
  PUBLISHED_BENCHMARK: {
    label: "Published benchmark",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-500",
    icon: <BookMarked className="h-2.5 w-2.5" />,
    hint: "An external published figure. The source is listed under Sources below.",
  },
  FACILITY_PROFILE: {
    label: "Facility profile",
    className: "border-surface-border bg-surface-raised text-muted-foreground",
    icon: <MapPin className="h-2.5 w-2.5" />,
    hint: "Recorded against this facility in your account.",
  },
};

export function SourceBadge({ source }: { source: RecommendationInputSource }) {
  const meta = SOURCE_META[source];
  return (
    <span
      title={meta.hint}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
        meta.className,
      )}
    >
      {meta.icon}
      {meta.label}
    </span>
  );
}

export function InputsList({ inputs }: { inputs: RecommendationInput[] }) {
  if (inputs.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-foreground">Figures used</p>
      <ul className="mt-2 space-y-2">
        {inputs.map((input) => (
          <li key={`${input.label}-${input.value}`} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span className="text-xs text-muted-foreground">{input.label}</span>
            <span className="flex items-center gap-2">
              <span className="text-xs font-medium text-foreground">{input.value}</span>
              <SourceBadge source={input.source} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CitationsList({ citations }: { citations: RecommendationCitation[] }) {
  if (citations.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-foreground">Sources</p>
      <ul className="mt-2 space-y-2.5">
        {citations.map((c) => (
          <li key={`${c.publisher}-${c.reference}`} className="text-[11px] leading-snug">
            <p className="font-medium text-foreground">
              {c.publisher}
              {c.verification === "NEEDS_COMPLIANCE_REVIEW" && (
                <span
                  className="ml-1.5 inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-500"
                  title="This figure has not yet been checked against its primary source by our compliance team. Confirm it before relying on it."
                >
                  <Info className="h-2.5 w-2.5" />
                  Pending review
                </span>
              )}
            </p>
            <p className="text-muted-foreground">{c.document}</p>
            <p className="text-muted-foreground">
              {c.reference} · {c.asOf}
            </p>
            {c.url && (
              <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-teal-500 hover:text-teal-400">
                Open source
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CaveatsList({ caveats }: { caveats: string[] }) {
  if (caveats.length === 0) return null;
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
        <TriangleAlert className="h-3 w-3 text-amber-500" />
        What would change this
      </p>
      <ul className="mt-2 space-y-1.5">
        {caveats.map((caveat) => (
          <li key={caveat} className="text-[11px] leading-snug text-muted-foreground">
            {caveat}
          </li>
        ))}
      </ul>
    </div>
  );
}
