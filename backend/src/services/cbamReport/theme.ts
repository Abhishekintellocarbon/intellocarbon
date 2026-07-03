export const TEAL = "#00D4AA";
export const TEAL_DARK = "#00A886";
export const NAVY = "#0F1923";
export const MUTED = "#5B6B7A";
export const BORDER = "#D8DEE4";
export const ROW_ALT = "#F8F9FA";
export const WHITE = "#FFFFFF";
export const DANGER = "#B33A3A";

export const PAGE_WIDTH = 595.28;
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
