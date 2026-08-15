"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";
import { IntellocarbonLogoFace } from "./intellocarbon-logo";
import { HEADER_DEPTH_SCALE, IntellocarbonLogo3D, markBoxRatio } from "./intellocarbon-logo-3d";

/**
 * The Intellocarbon lockup — mark plus wordmark.
 *
 * The mark is IntellocarbonLogoFace by default: the static gradient face, no
 * extrusion and no interaction. Pass `dimensional` for the full treatment —
 * extrusion stack, gloss, speculars, hover parallax and idle float. Both
 * headers opt in; everything else (auth shell, footers) stays flat.
 *
 * Accessibility: whenever the wordmark is visible the mark is decorative, so a
 * home link wrapping this lockup is announced once ("Intellocarbon") rather
 * than twice. In iconOnly mode there is no text, so the mark itself carries
 * the accessible name.
 */
const SIZE_STYLES = {
  md: {
    wrapper: "gap-2.5",
    mark: 32,
    text: "text-lg",
  },
  lg: {
    // The header mark. 40px was too quiet for a top-left primary brand mark,
    // and it also cost the gradient: the band is 13/120 of the box, so at 40px
    // it is ~4.3px wide and the green→teal→blue ramp has too little area to
    // read — the mark looked like a flat teal outline even though the gradient
    // was painting correctly. 54px is where the ramp becomes legible.
    wrapper: "gap-4",
    mark: 54,
    text: "text-3xl",
  },
} as const;

/**
 * The wordmark's gradient half. Same three tokens as the mark's band, running
 * left-to-right so it tracks the band's top-left-to-bottom-right ramp.
 *
 * "carbon" only, not the whole word: at header weight a fully gradient wordmark
 * loses its top-left anchor against the navy, and splitting at the compound
 * boundary reads as deliberate rather than as a wash.
 */
const WORDMARK_GRADIENT =
  "bg-gradient-to-r from-[#4BE895] via-[#15B9A4] to-[#2A78A6] bg-clip-text text-transparent";

export function Logo({
  className,
  iconOnly,
  size = "md",
  dimensional = false,
}: {
  className?: string;
  iconOnly?: boolean;
  size?: keyof typeof SIZE_STYLES;
  /** Extrusion stack, gloss, speculars, hover parallax and idle float. Headers only. */
  dimensional?: boolean;
}) {
  const s = SIZE_STYLES[size];
  // Per-instance ids for the mark's gradients and mask. Several lockups can be
  // in one document at once (header + footer, or a responsive pair where one
  // side is display:none) and shared ids let a hidden copy win the `url(#id)`
  // lookup and blank the visible mark. useId is stable across SSR/hydration;
  // the non-alphanumerics React puts in it are stripped so the value is safe
  // in a fragment reference. This is also why the file is "use client".
  const idScope = `ic${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <div className={cn("flex items-center", s.wrapper, className)}>
      {dimensional ? (
        // The svg box is enlarged so the *face* still reads at s.mark: the
        // extrusion needs room inside the viewBox, so the assembly is scaled to
        // fit and the box grows to compensate. Optical size is unchanged.
        <IntellocarbonLogo3D
          size={Math.round(s.mark / markBoxRatio(HEADER_DEPTH_SCALE))}
          decorative={!iconOnly}
          idScope={idScope}
          depthScale={HEADER_DEPTH_SCALE}
        />
      ) : (
        <IntellocarbonLogoFace size={s.mark} decorative={!iconOnly} idScope={idScope} />
      )}
      {!iconOnly && (
        <span
          className={cn(
            "font-wordmark font-extrabold uppercase tracking-[0.09em] text-foreground",
            s.text,
            // After s.text: Tailwind's text-{size} utilities carry their own
            // line-height, so this has to win the cascade order.
            "leading-none",
          )}
        >
          {/* No whitespace between the two spans — this is one word, and a
              newline here would have assistive tech announce it as two. */}
          <span>Intello</span>
          <span className={WORDMARK_GRADIENT}>carbon</span>
        </span>
      )}
    </div>
  );
}
