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
    // Small enough to fit at every width; no responsive override needed.
    markResponsive: "",
    markResponsive3d: "",
  },
  lg: {
    // The header mark. 40px was too quiet for a top-left primary brand mark,
    // and it also cost the gradient: the band is 13/120 of the box, so at 40px
    // it is ~4.3px wide and the green→teal→blue ramp has too little area to
    // read — the mark looked like a flat teal outline even though the gradient
    // was painting correctly. 54px is where the ramp becomes legible.
    //
    // That sizing is md-and-up only. The full lockup measures 379px, which is
    // wider than a 375px phone on its own: below md it overflowed the header
    // and pushed the mobile menu button off the right edge entirely. Mobile
    // therefore keeps the pre-scale-up 40px mark, where the gradient argument
    // above does not apply — there is no room for 54px regardless.
    //
    // Four wordmark steps. Each is the largest that fits the width below it,
    // measured against the space the lockup actually has: viewport, less the
    // 24px header padding on both sides, less the 36px menu button and the
    // 16px before it. The 400px stop is not a device — it is where 22px stops
    // overflowing a 390px phone, which is the most common width in the range.
    //
    //   375px -> 275px for the lockup   text-xl   (20px) -> lockup 111 + word
    //   400px -> 300px                  22px
    //   640px -> sm, clock returns      text-2xl  (24px)
    //   768px -> md, full desktop nav   text-3xl  (30px)
    wrapper: "gap-3.5 md:gap-4",
    mark: 54,
    text: "text-xl min-[400px]:text-[22px] sm:text-2xl md:text-3xl",
    // The mark's px size is an attribute, not a class, so the responsive half
    // has to come from CSS that overrides it. Written out in full because
    // Tailwind only sees class strings that exist literally in the source.
    //
    // 48px rather than the 40px this first shrank to. That number was chosen
    // when the mark's wrapper was still padding the lockup with 14px of dead
    // space; with the box tight against the svg the width is available, and it
    // buys back some of the gradient legibility 54px exists for.
    markResponsive: "w-12 md:w-[54px] h-12 md:h-[54px]",
    markResponsive3d: "[&>svg]:w-[49px] [&>svg]:h-[49px] md:[&>svg]:w-[55px] md:[&>svg]:h-[55px]",
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
          className={s.markResponsive3d}
        />
      ) : (
        <IntellocarbonLogoFace
          size={s.mark}
          decorative={!iconOnly}
          idScope={idScope}
          className={s.markResponsive}
        />
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
