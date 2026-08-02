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

  // Privacy-friendly analytics by Plausible.
  //
  // Two tags, exactly as Plausible's dashboard issues them: the per-site
  // loader, then an inline stub that queues calls made before it finishes
  // downloading. The site is identified by the script's own filename now —
  // there is no data-domain attribute in this version, which is why the old
  // one is gone rather than being carried over.
  return (
    <>
      <Script async src="https://plausible.io/js/pa-NB28iRFr_0A67YV6TBiPe.js" strategy="afterInteractive" />
      <Script id="plausible-init" strategy="afterInteractive">
        {`window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};
plausible.init()`}
      </Script>
    </>
  );
}
