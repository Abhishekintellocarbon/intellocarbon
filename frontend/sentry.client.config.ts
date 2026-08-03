// This file configures the initialization of Sentry on the client (browser).
// https://docs.sentry.io/platforms/javascript/guides/nextjs/
//
// Unlike the server and edge configs, this one does NOT initialise on import.
// The browser SDK stores state on the visitor's device and sends error and
// performance events off-site, so under GDPR/ePrivacy it is non-essential and
// needs consent first. `initSentryClient()` is called by
// components/layout/sentry-monitoring.tsx once — and only once — the visitor
// has opted into the "Performance" cookie category.
//
// The consequence is deliberate: visitors who decline are not monitored at all,
// so client-side error volume reflects only consenting sessions. Server-side
// Sentry (sentry.server.config.ts) is unaffected — it observes our own
// infrastructure rather than storing anything on the visitor's device.

import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent } from "@/lib/sentryScrub";
import { isPerformanceConsented } from "@/lib/cookie-consent";

// Note: the frontend DSN is exposed via NEXT_PUBLIC_ so it's available in
// this client bundle — Sentry DSNs are not secret (they only allow
// submitting events, not reading project data), so this is safe. Leave it
// unset to disable Sentry entirely (Sentry.init() becomes a no-op client).
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN_FRONTEND || undefined;

let initialised = false;

export function initSentryClient(): void {
  if (initialised) return;
  initialised = true;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV === "production" ? "production" : "development",
    // Conservative sampling to keep event/trace volume (and Sentry cost) low
    // at this stage — revisit once real traffic patterns are known.
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    // Second gate, behind the init gate above. The SDK cannot be un-initialised
    // once running, so every outbound event re-checks live consent: withdrawing
    // it mid-session drops errors and transactions from that moment on, rather
    // than keeping the pipe open until the next reload.
    beforeSend: (event) => (isPerformanceConsented() ? scrubSentryEvent(event) : null),
    beforeSendTransaction: (event) => (isPerformanceConsented() ? event : null),
  });
}
