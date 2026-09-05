import type { RecommendationInputSource } from "./types";

/**
 * How each provenance source is labelled and styled.
 *
 * Extracted out of the provenance component so it can be asserted directly: the
 * product's claim is that a reader can always tell a measured figure from a
 * published benchmark from a projection, and that claim is only true if every
 * source has an entry here and no two of them look alike. A test pins both.
 *
 * The icon for each source stays in the component — it is JSX, and this module
 * is deliberately plain data.
 */
export type SourceMeta = {
  label: string;
  /** Tailwind classes. Distinct per source: same-looking badges defeat the point. */
  className: string;
  hint: string;
};

export const SOURCE_META: Record<RecommendationInputSource, SourceMeta> = {
  PLATFORM_CALCULATION: {
    label: "Your calculated data",
    className: "border-teal-500/30 bg-teal-500/10 text-teal-500",
    hint: "Taken from this facility's own emissions calculation on the platform.",
  },
  BILL_EXTRACTION: {
    label: "Read from your bill",
    className: "border-blue-500/30 bg-blue-500/10 text-blue-400",
    hint: "Extracted from an electricity bill you uploaded. Check it against the document if it looks wrong.",
  },
  PUBLISHED_BENCHMARK: {
    label: "Published benchmark",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-500",
    hint: "An external published figure. The source is listed under Sources below.",
  },
  FACILITY_PROFILE: {
    label: "Facility profile",
    className: "border-surface-border bg-surface-raised text-muted-foreground",
    hint: "Recorded against this facility in your account.",
  },
  /**
   * Purple, dashed, and worded as a projection rather than a fact.
   *
   * The other four badges all describe something that happened. This one
   * describes something that has not, and it is the only badge in the set whose
   * border is dashed — so a projected figure is distinguishable from a measured
   * one at a glance, before any label is read, and stays distinguishable in a
   * screenshot or a printout.
   */
  PROJECTED: {
    label: "Projected",
    className: "border-dashed border-purple-400/50 bg-purple-400/10 text-purple-300",
    hint: "A forward projection under the selected scenario, not a measured or calculated figure. What it was projected from is named on the badge.",
  },
};

/**
 * The badge text for a source.
 *
 * A projected figure always reads "Projected from {what}" — the requirement is
 * that a projection can never appear on screen without saying what it was
 * projected from, so the label is built from `derivedFrom` rather than trusting
 * a caller to render it separately. With nothing to name, it degrades to the
 * bare "Projected" label rather than to a dangling "Projected from".
 */
export const sourceBadgeLabel = (source: RecommendationInputSource, derivedFrom?: string): string =>
  source === "PROJECTED" && derivedFrom ? `Projected from ${derivedFrom}` : SOURCE_META[source].label;

/** True for sources that describe a forward projection rather than something observed. */
export const isProjectedSource = (source: RecommendationInputSource): boolean => source === "PROJECTED";
