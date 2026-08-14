import { cn } from "@/lib/utils";
import { IntellocarbonLogoFace } from "./intellocarbon-logo";

/**
 * The Intellocarbon lockup — mark plus wordmark.
 *
 * The mark is IntellocarbonLogoFace: the static gradient face, no extrusion
 * and no interaction. The 3D interactive treatment is a separate stage and is
 * not used at these sizes.
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
    wrapper: "gap-3.5",
    // The header mark, at the specified 40px.
    mark: 40,
    text: "text-2xl",
  },
} as const;

export function Logo({
  className,
  iconOnly,
  size = "md",
}: {
  className?: string;
  iconOnly?: boolean;
  size?: keyof typeof SIZE_STYLES;
}) {
  const s = SIZE_STYLES[size];

  return (
    <div className={cn("flex items-center", s.wrapper, className)}>
      <IntellocarbonLogoFace size={s.mark} decorative={!iconOnly} />
      {!iconOnly && (
        <span
          className={cn(
            "font-wordmark font-extrabold uppercase leading-none tracking-[0.09em] text-foreground",
            s.text,
          )}
        >
          Intellocarbon
        </span>
      )}
    </div>
  );
}
