// This file configures the initialization of Sentry on the server side.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN_FRONTEND || undefined;

Sentry.init({
  dsn,
  environment: process.env.NODE_ENV === "production" ? "production" : "development",
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
});
