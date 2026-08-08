import { round } from "./dashboardShared.helpers";

/**
 * "Live position" strip — the small panel of genuinely dynamic, frequently
 * changing facts that give a company a reason to open the dashboard between
 * reporting deadlines.
 *
 * The hard rule this module exists to enforce: every item is derived from
 * data that actually exists. There is no placeholder branch and no default
 * copy — a builder that can't compute an item omits it, and a strip with
 * nothing to say renders as an empty list rather than as invented urgency.
 * That's why every helper below returns `LivePositionItem | null`.
 */
export type LivePositionKind = "DATA_UPDATE" | "DEADLINE" | "TREND" | "PRICE";

export interface LivePositionItem {
  id: string;
  kind: LivePositionKind;
  label: string;
  detail: string;
  /** ISO timestamp — set on backward-looking items only (DATA_UPDATE). */
  timestamp: string | null;
  /** Signed % change vs the comparison period. Negative = the metric fell. */
  deltaPct?: number;
  /** Whether a fall in this metric is the good direction (water, waste, emissions). */
  lowerIsBetter?: boolean;
  /** Deep link to the page where the underlying data lives. */
  href?: string;
}

/**
 * A period-over-period delta, or null when there aren't two comparable
 * periods or the earlier one is zero (no meaningful percentage exists).
 * Callers pass the two most recent values in chronological order.
 */
export const buildTrendItem = (options: {
  id: string;
  metricLabel: string;
  unitSuffix: string;
  previous: number | null | undefined;
  current: number | null | undefined;
  previousPeriodLabel: string;
  currentPeriodLabel: string;
  lowerIsBetter: boolean;
  href?: string;
}): LivePositionItem | null => {
  const { previous, current } = options;
  if (previous == null || current == null || previous <= 0) return null;

  const deltaPct = round(((current - previous) / previous) * 100, 1);
  // A delta that rounds to zero isn't news — reporting "up 0.0%" is noise,
  // not signal, so it's dropped the same way a missing value is.
  if (deltaPct === 0) return null;

  const direction = deltaPct < 0 ? "down" : "up";
  return {
    id: options.id,
    kind: "TREND",
    label: `${options.metricLabel} ${direction} ${Math.abs(deltaPct)}%`,
    detail: `${options.currentPeriodLabel} vs ${options.previousPeriodLabel} — ${current.toLocaleString("en-IN", {
      maximumFractionDigits: 2,
    })}${options.unitSuffix} vs ${previous.toLocaleString("en-IN", { maximumFractionDigits: 2 })}${options.unitSuffix}`,
    timestamp: null,
    deltaPct,
    lowerIsBetter: options.lowerIsBetter,
    href: options.href,
  };
};

const DAY_MS = 24 * 60 * 60 * 1000;

const fmtDate = (d: Date) => d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });

/**
 * A forward-looking deadline item, suppressed once it's further out than
 * `withinDays` — a date 10 months away isn't a live position, it's a
 * calendar entry, and surfacing it every day is exactly the manufactured
 * urgency this strip is meant to avoid.
 */
export const buildDeadlineItem = (options: {
  id: string;
  label: string;
  date: Date;
  now: Date;
  detailPrefix: string;
  withinDays?: number;
  href?: string;
}): LivePositionItem | null => {
  const { date, now, withinDays = 120 } = options;
  const daysRemaining = Math.round((date.getTime() - now.getTime()) / DAY_MS);
  if (daysRemaining < 0 || daysRemaining > withinDays) return null;

  const remaining = daysRemaining === 0 ? "due today" : daysRemaining === 1 ? "1 day remaining" : `${daysRemaining} days remaining`;
  return {
    id: options.id,
    kind: "DEADLINE",
    label: options.label,
    detail: `${options.detailPrefix} ${fmtDate(date)} — ${remaining}`,
    timestamp: null,
    href: options.href,
  };
};

/** Newest first, so the strip reads as a feed. Forward-looking items sort after dated ones. */
export const sortLivePosition = (items: LivePositionItem[]): LivePositionItem[] =>
  [...items].sort((a, b) => {
    if (a.timestamp && b.timestamp) return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    if (a.timestamp) return -1;
    if (b.timestamp) return 1;
    return 0;
  });
