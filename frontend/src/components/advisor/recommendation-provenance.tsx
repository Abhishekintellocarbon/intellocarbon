"use client";

import { BookMarked, Calculator, FileText, Info, MapPin, TrendingUp, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { SOURCE_META, sourceBadgeLabel } from "@/lib/source-meta";
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
 * The five sources are styled distinctly on purpose. "0.716 tCO2e/MWh from
 * CEA" and "2,500 kVA read off your bill by OCR" carry very different
 * confidence, and rendering them identically would flatten that away. The
 * projected badge goes further and is the only dashed one in the set, because
 * the gap between "this is what your plant emitted" and "this is what it would
 * emit under a scenario" is the largest gap of all — a reader must not have to
 * read the label to spot it.
 *
 * The labels, colours and hints live in lib/source-meta.ts so they can be
 * tested; only the icons stay here.
 */

const SOURCE_ICON: Record<RecommendationInputSource, React.ReactNode> = {
  PLATFORM_CALCULATION: <Calculator className="h-2.5 w-2.5" />,
  BILL_EXTRACTION: <FileText className="h-2.5 w-2.5" />,
  PUBLISHED_BENCHMARK: <BookMarked className="h-2.5 w-2.5" />,
  FACILITY_PROFILE: <MapPin className="h-2.5 w-2.5" />,
  PROJECTED: <TrendingUp className="h-2.5 w-2.5" />,
};

export function SourceBadge({ source, derivedFrom }: { source: RecommendationInputSource; derivedFrom?: string }) {
  const meta = SOURCE_META[source];
  return (
    <span
      title={meta.hint}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
        // The four observed-source labels are two or three words and must not
        // wrap. "Projected from …" carries a full clause, so it wraps instead of
        // overflowing its card — which is what it did before this: the badge ran
        // off the right edge of the CBAM liability panel and the sentence naming
        // the projection's source was cut off mid-word.
        source === "PROJECTED" ? "min-w-0 whitespace-normal break-words text-left" : "shrink-0",
        meta.className,
      )}
    >
      <span className="shrink-0">{SOURCE_ICON[source]}</span>
      {sourceBadgeLabel(source, derivedFrom)}
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
              <span
                className={cn(
                  "text-xs font-medium",
                  // A projected figure is set in the projection colour and
                  // italicised, so the *value* is marked as well as the badge
                  // beside it — the two travel together everywhere.
                  input.source === "PROJECTED" ? "italic text-purple-300" : "text-foreground",
                )}
              >
                {input.value}
              </span>
              <SourceBadge source={input.source} derivedFrom={input.derivedFrom} />
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
