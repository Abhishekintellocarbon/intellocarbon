"use client";

import { openCookiePreferences } from "@/lib/cookie-consent";

/**
 * Footer entry point back into the cookie preferences dialog. GDPR requires
 * that withdrawing consent be as easy as giving it, so this stays available
 * on every marketing page after the banner has been dismissed.
 */
export function CookieSettingsLink({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={openCookiePreferences}
      className={`rounded-sm underline underline-offset-2 transition-colors hover:text-teal-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${className ?? ""}`}
    >
      Cookie settings
    </button>
  );
}
