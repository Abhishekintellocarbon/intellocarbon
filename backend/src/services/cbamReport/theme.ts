export const TEAL = "#00D4AA";
export const TEAL_DARK = "#00A886";
export const NAVY = "#0F1923";
export const MUTED = "#5B6B7A";
export const BORDER = "#D8DEE4";
export const ROW_ALT = "#F8F9FA";
export const WHITE = "#FFFFFF";
export const DANGER = "#B33A3A";

// Cover gradient panel — teal to dark navy, per the premium-report design system.
export const COVER_GRADIENT_FROM = "#00A88E";
export const COVER_GRADIENT_TO = "#0F1923";

// Shared status-color system — green/amber/red for favourable / pending / unfavourable
// figures, badges and headline-stat indicators, used identically across both reports.
export const STATUS_GREEN = "#1E8E5A";
export const STATUS_GREEN_BG = "#E5F5EC";
export const STATUS_AMBER = "#B8750F";
export const STATUS_AMBER_BG = "#FCF1DD";
export const STATUS_RED = "#B33A3A";
export const STATUS_RED_BG = "#FBEAEA";

export type StatusTone = "green" | "amber" | "red";

export const STATUS_COLORS: Record<StatusTone, { fg: string; bg: string }> = {
  green: { fg: STATUS_GREEN, bg: STATUS_GREEN_BG },
  amber: { fg: STATUS_AMBER, bg: STATUS_AMBER_BG },
  red: { fg: STATUS_RED, bg: STATUS_RED_BG },
};

export const PAGE_WIDTH = 595.28;
export const PAGE_HEIGHT = 841.89;
export const MARGIN_X = 50;
export const CONTENT_WIDTH = 495;
export const TOP_Y = 78;

export const fmt = (n: number, digits = 3) =>
  n.toLocaleString("en-IN", { maximumFractionDigits: digits, minimumFractionDigits: digits });

export const fmtInt = (n: number) => Math.round(n).toLocaleString("en-IN");

export const fmtEur = (n: number, digits = 2) => {
  const abs = Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: digits, minimumFractionDigits: digits });
  return n < 0 ? `-€${abs}` : `€${abs}`;
};

export const fmtSigned = (n: number, digits = 3) => (n >= 0 ? `+${fmt(n, digits)}` : fmt(n, digits));

export const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

export const titleCase = (s: string) =>
  s
    .toLowerCase()
    .split("_")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");

export interface CitationNumbering {
  /** Per-row citation number, same order as the `sources` passed in — identical source text shares a number. */
  numbers: number[];
  /** e.g. "[1] EU 2023/1773 Annex VIII   [2] IPCC 2006 Vol.3 Ch.2" for a table-footer note. */
  legend: string;
}

/**
 * Assigns a stable citation number to each distinct source string, in first-seen
 * order, so tables whose rows cite different regulations (not just one uniform
 * source) can still show a single inline badge per row instead of a full source
 * column — see `table()`'s `^n` cell-suffix convention in layout.ts.
 */
export const buildCitationNumbering = (sources: string[]): CitationNumbering => {
  const seen = new Map<string, number>();
  const numbers = sources.map((source) => {
    if (!seen.has(source)) seen.set(source, seen.size + 1);
    return seen.get(source)!;
  });
  const legend = Array.from(seen.entries())
    .map(([source, n]) => `[${n}] ${source}`)
    .join("   ");
  return { numbers, legend };
};
