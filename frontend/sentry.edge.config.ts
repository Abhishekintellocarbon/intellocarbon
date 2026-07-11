// This file configures the initialization of Sentry for edge features (middleware, edge routes, etc).
// The config you add here will be used whenever one of the edge features is loaded.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent } from "@/lib/sentryScrub";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN_FRONTEND || undefined;

Sentry.init({
  dsn,
  environment: process.env.NODE_ENV === "production" ? "production" : "development",
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  beforeSend: scrubSentryEvent,
});
