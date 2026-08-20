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

/**
 * "EUR" rather than the € glyph.
 *
 * pdfkit's standard fonts carry no advance width for U+20AC, so the euro sign
 * renders on top of the character after it — "€8,14,204.24" prints as a €
 * collided with the 8. It is not dropped, which is what made this survive: the
 * number is still there and still correct, just illegible at its first digit,
 * and it was doing this on the CBAM Communication Package's cover hero, the
 * liability tables and the waterfall labels.
 *
 * Same defect class as the Rupee sign and the unicode arrows already handled
 * elsewhere in these builders, and the same fix: spell the currency. The pound
 * (U+00A3) and dollar are in the standard Adobe encoding with real widths and
 * render correctly, so fmtGbp keeps its symbol.
 */
export const fmtEur = (n: number, digits = 2) => {
  const abs = Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: digits, minimumFractionDigits: digits });
  return n < 0 ? `-EUR ${abs}` : `EUR ${abs}`;
};

/** UK CBAM figures are GBP — same shape as fmtEur so the two reports format money identically apart from the symbol. */
export const fmtGbp = (n: number, digits = 2) => {
  const abs = Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: digits, minimumFractionDigits: digits });
  return n < 0 ? `-£${abs}` : `£${abs}`;
};

export const fmtSigned = (n: number, digits = 3) => (n >= 0 ? `+${fmt(n, digits)}` : fmt(n, digits));

export const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

/**
 * Date *and* time, for the "Generated" row of every document control panel.
 *
 * A regulatory submission that says only which day it was produced cannot be
 * ordered against another copy produced the same day, which is exactly the
 * question a version dispute turns on. The zone abbreviation is not decoration:
 * the API runs in UTC in production and in IST locally, so a bare wall-clock
 * time would mean two different instants depending on where the PDF was built.
 */
export const fmtDateTime = (d: Date) =>
  d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "short",
  });

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
