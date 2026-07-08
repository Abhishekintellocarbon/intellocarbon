/**
 * Neutral navy/grey palette for GHG Runner's white-label report — no teal,
 * no brand color of any kind, since these PDFs go out under the
 * consultant's own name, never Intellocarbon's. Deliberately a separate
 * module from cbamReport/theme.ts rather than a parameterized version of
 * it: that file is shared by the CBAM and CCTS reports specifically to
 * guarantee their covers stay pixel-identical to each other, and its
 * helpers (coverShell, drawHeaderBand, drawFooter) hardcode the
 * Intellocarbon logo/name — reusing it here would mean threading branding
 * flags through code whose whole job is to stay branded.
 */

export const NAVY = "#1F2933";
export const NAVY_LIGHT = "#3E4C59";
export const GREY = "#7B8794";
export const GREY_LIGHT = "#CBD2D9";
export const BORDER = "#CBD2D9";
export const ROW_ALT = "#F5F7FA";
export const WHITE = "#FFFFFF";

export const PAGE_WIDTH = 595.28;
export const PAGE_HEIGHT = 841.89;
export const MARGIN_X = 50;
export const CONTENT_WIDTH = 495;
export const TOP_Y = 78;

// International consulting deliverable — US-style number/date formatting,
// not the en-IN convention the Indian CBAM/CCTS reports use.
export const fmt = (n: number, digits = 3) =>
  n.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits });

export const fmtInt = (n: number) => Math.round(n).toLocaleString("en-US");

export const fmtDate = (d: Date) => d.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
