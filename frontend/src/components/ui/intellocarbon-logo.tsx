import { cn } from "@/lib/utils";

/**
 * The Intellocarbon mark.
 *
 * Two components over one shared geometry: a flat single-colour mark for
 * favicons, app icons and anything under 28px, and a static gradient "face"
 * for the site header. The full 3D interactive treatment is a separate stage
 * and deliberately not built here — at 40px an extrusion stack is cost with
 * nothing to show for it.
 *
 * The geometry below is a spec, not a drawing. Do not adjust the coordinates
 * by eye: the band is a pointy-top hexagon broken into two open sub-paths with
 * mitred joins, and the gap positions, the 13-unit stroke and the miter limit
 * of 6 are what give the corners their exact shape. Re-deriving any of it from
 * a screenshot will silently change the mark.
 */

/**
 * Two open sub-paths, not a closed hexagon — the two gaps are the design.
 * Stroked at 13 units with mitred joins and butt caps; nothing here is rounded.
 */
const BAND_PATH =
  "M41.83,18.5 L60,8 L105.03,34 L105.03,86 L86.83,96.5 M78.17,101.5 L60,112 L14.97,86 L14.97,34 L33.17,23.5";

const BAND_STROKE_WIDTH = 13;
const BAND_MITER_LIMIT = 6;

/** The "C" of the monogram. The "I" is a plain rect beside it — see below. */
const MONOGRAM_C_PATH =
  "M93,39 L84,39 L84,43.5 L78,43.5 L78,39 L62.5,39 L53,50 L53,70 L62.5,81 L93,81 L85,68.5 L69,68.5 L64.5,63.5 L64.5,56.5 L69,51.5 L85,51.5 Z";

/**
 * Centres the monogram in the 120-unit box and scales it to sit inside the
 * band. The inner translate is -63.5,-60 rather than -60,-60: the monogram's
 * own optical centre is not its bounding-box centre.
 */
const MONOGRAM_TRANSFORM = "translate(60,60) scale(0.81) translate(-63.5,-60)";

/** Single-colour mark colour — favicon, print, anything under 28px. */
export const INTELLOCARBON_FLAT_COLOR = "#0A8A61";

/** The navy the mark is designed to sit on. */
export const INTELLOCARBON_NAVY = "#0F1923";

interface MarkProps {
  /** Rendered size in px, applied to both width and height. */
  size?: number;
  className?: string;
  /**
   * Set when the mark sits beside a visible "Intellocarbon" wordmark, or
   * inside a link that is already named. The mark then renders as decorative
   * (aria-hidden, no role) so the accessible name is not announced twice.
   */
  decorative?: boolean;
}

/** role="img" + label, or fully hidden — never both, and never neither. */
const a11yProps = (decorative: boolean) =>
  decorative ? ({ "aria-hidden": true } as const) : ({ role: "img", "aria-label": "Intellocarbon" } as const);

/**
 * Flat single-colour mark. No gradient, no mask, no 3D, no interaction —
 * everything that would not survive being rasterised to 16px.
 */
export function IntellocarbonLogoFlat({ size = 32, className, decorative = false }: MarkProps) {
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      {...a11yProps(decorative)}
    >
      <path
        d={BAND_PATH}
        fill="none"
        stroke={INTELLOCARBON_FLAT_COLOR}
        strokeWidth={BAND_STROKE_WIDTH}
        strokeLinejoin="miter"
        strokeMiterlimit={BAND_MITER_LIMIT}
        strokeLinecap="butt"
      />
      <g transform={MONOGRAM_TRANSFORM} fill={INTELLOCARBON_FLAT_COLOR}>
        <rect x="34" y="39" width="14" height="42" />
        <path d={MONOGRAM_C_PATH} />
      </g>
    </svg>
  );
}

/**
 * Static gradient face. This is the header mark.
 *
 * The band gradient is painted as a **fill through a mask**, never as
 * `stroke="url(#icGrad)"`. A gradient applied directly to a stroke renders
 * flat in a number of engines — including several rasterisers and PDF
 * pipelines — and does so silently, with no error and no visual warning at
 * authoring time. Masking a filled rect with a stroked white path produces the
 * same shape with paint that survives everywhere.
 *
 * The gradient ids are fixed rather than generated per instance, as specified.
 * Two marks on one page therefore share ids, which is harmless here: every
 * instance defines identical paint, so whichever definition a `url(#id)`
 * reference resolves to is the same gradient either way.
 */
export function IntellocarbonLogoFace({ size = 40, className, decorative = false }: MarkProps) {
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      {...a11yProps(decorative)}
    >
      <defs>
        <linearGradient id="icGrad" gradientUnits="userSpaceOnUse" x1="16" y1="10" x2="104" y2="110">
          <stop offset="0%" stopColor="#4BE895" />
          <stop offset="46%" stopColor="#15B9A4" />
          <stop offset="100%" stopColor="#2A78A6" />
        </linearGradient>

        <linearGradient id="icMonoGrad" gradientUnits="userSpaceOnUse" x1="34" y1="36" x2="86" y2="84">
          <stop offset="0%" stopColor="#FDFEFE" />
          <stop offset="55%" stopColor="#DCE6E6" />
          <stop offset="100%" stopColor="#B4C2C4" />
        </linearGradient>

        <mask id="icBandMask" maskUnits="userSpaceOnUse" x="0" y="0" width="120" height="120">
          <path
            d={BAND_PATH}
            fill="none"
            stroke="#fff"
            strokeWidth={BAND_STROKE_WIDTH}
            strokeLinejoin="miter"
            strokeMiterlimit={BAND_MITER_LIMIT}
            strokeLinecap="butt"
          />
        </mask>
      </defs>

      {/* The band: gradient as fill, shaped by the stroked mask above. */}
      <rect width="120" height="120" fill="url(#icGrad)" mask="url(#icBandMask)" />

      <g transform={MONOGRAM_TRANSFORM} fill="url(#icMonoGrad)">
        <rect x="34" y="39" width="14" height="42" />
        <path d={MONOGRAM_C_PATH} />
      </g>
    </svg>
  );
}

/**
 * The flat mark as a standalone SVG document string.
 *
 * Needed because the app-icon routes rasterise through Satori, which takes an
 * image source rather than arbitrary inline SVG children. Built from the same
 * constants as the components above, so the icon files cannot drift from the
 * on-screen mark.
 */
export const flatMarkSvgMarkup = (background?: string): string =>
  [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">`,
    background ? `<rect width="120" height="120" fill="${background}"/>` : "",
    `<path d="${BAND_PATH}" fill="none" stroke="${INTELLOCARBON_FLAT_COLOR}" stroke-width="${BAND_STROKE_WIDTH}" stroke-linejoin="miter" stroke-miterlimit="${BAND_MITER_LIMIT}" stroke-linecap="butt"/>`,
    `<g transform="${MONOGRAM_TRANSFORM}" fill="${INTELLOCARBON_FLAT_COLOR}">`,
    `<rect x="34" y="39" width="14" height="42"/>`,
    `<path d="${MONOGRAM_C_PATH}"/>`,
    `</g>`,
    `</svg>`,
  ].join("");
