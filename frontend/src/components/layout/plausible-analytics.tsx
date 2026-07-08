"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";

// Exact-match marketing routes — kept separate from the prefix list below so
// adding a new authenticated top-level route (e.g. "/about-us-internal")
// can't accidentally start matching as a marketing page.
const MARKETING_ROUTES = new Set(["/", "/about", "/faq"]);

// Routes where any sub-path should also count as a marketing page —
// /intellocalc/border, /intellocalc/comply, /intellocalc/india, and any
// future calculator added under the same prefix.
const MARKETING_PREFIXES = ["/intellocalc"];

/**
 * Everything behind login (dashboard, facilities, company, billing, esg,
 * onboarding, admin, verifier, internal-data-entry) is deliberately NOT in
 * either list above — Plausible must never load there.
 */
const isMarketingRoute = (pathname: string): boolean => {
  if (MARKETING_ROUTES.has(pathname)) return true;
  return MARKETING_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
};

export function PlausibleAnalytics() {
  const pathname = usePathname();
  if (!pathname || !isMarketingRoute(pathname)) return null;

  return (
    <Script
      defer
      data-domain="intellocarbon.com"
      src="https://plausible.io/js/script.js"
      strategy="afterInteractive"
    />
  );
}
