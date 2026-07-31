"use client";

import { useId, useState } from "react";

/**
 * Minimal hover/focus tooltip. Deliberately CSS-and-state only rather than a
 * Radix dependency — this is the first tooltip in the codebase and it needs to
 * do one thing: explain why a disabled control is disabled.
 *
 * Opens on hover and on keyboard focus, closes on Escape, and is wired to the
 * trigger with aria-describedby so screen readers get the reason too. The
 * trigger keeps `title` as a no-JS/native fallback.
 */
export function Tooltip({ content, children }: { content: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
      }}
    >
      <span tabIndex={0} aria-describedby={open ? id : undefined} title={content} className="inline-flex outline-none">
        {children}
      </span>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-left text-xs font-normal leading-relaxed text-muted-foreground shadow-lg"
        >
          {content}
        </span>
      )}
    </span>
  );
}
