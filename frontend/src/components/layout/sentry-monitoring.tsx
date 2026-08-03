"use client";

import { useEffect } from "react";
import { useCookieConsent } from "@/hooks/use-cookie-consent";

/**
 * Consent gate for Sentry's browser SDK.
 *
 * `sentry.client.config.ts` deliberately no longer initialises on import, so
 * this is the only thing that starts client-side monitoring — and it does so
 * only once the visitor has opted into the "Performance" category. With no
 * consent, an expired consent, or Performance left off, `Sentry.init()` is
 * never called, nothing is stored on the device, and no event reaches
 * sentry.io.
 *
 * Unlike the Plausible loader this cannot be undone by unmounting: the SDK has
 * no un-init. Withdrawal is handled inside the init options instead, where
 * `beforeSend`/`beforeSendTransaction` re-check live consent per event.
 *
 * Renders nothing. It is separate from the analytics loader because the two
 * categories are independent — consenting to one must not start the other.
 */
export function SentryMonitoring() {
  const { performanceAllowed } = useCookieConsent();

  useEffect(() => {
    if (!performanceAllowed) return;
    // Imported lazily so the Sentry client config — and the init call inside
    // it — is only ever evaluated in a session that consented.
    void import("../../../sentry.client.config").then((mod) => mod.initSentryClient());
  }, [performanceAllowed]);

  return null;
}
