// This file configures the initialization of Sentry on the client (browser).
// The config you add here will be used whenever a user loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

// Note: the frontend DSN is exposed via NEXT_PUBLIC_ so it's available in
// this client bundle — Sentry DSNs are not secret (they only allow
// submitting events, not reading project data), so this is safe. Leave it
// unset to disable Sentry entirely (Sentry.init() becomes a no-op client).
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN_FRONTEND || undefined;

Sentry.init({
  dsn,
  environment: process.env.NODE_ENV === "production" ? "production" : "development",
  // Conservative sampling to keep event/trace volume (and Sentry cost) low
  // at this stage — revisit once real traffic patterns are known.
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
});
