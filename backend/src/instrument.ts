// Sentry must be initialized before any other module (Express, routes,
// middleware) is imported, so its auto-instrumentation can patch Node's
// http/express internals in time. That's why this file is `import`ed as the
// very first line of server.ts, and why it loads its own dotenv config
// rather than depending on ./config/env (which would pull in the rest of
// the app's import graph before Sentry.init() runs).
import "dotenv/config";
import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import { logger } from "./utils/logger";

const SENSITIVE_KEYS = ["password", "token", "secret", "authorization", "cookie"];

// Anything past this size is almost certainly a full activity/emissions data
// payload rather than something useful for debugging an error — replace it
// with a size note instead of shipping the whole submission to Sentry.
const MAX_BODY_JSON_LENGTH = 2000;

const isSensitiveKey = (key: string): boolean => {
  const normalized = key.toLowerCase();
  return SENSITIVE_KEYS.some((sensitive) => normalized.includes(sensitive));
};

const scrub = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(scrub);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, v]) => [
        key,
        isSensitiveKey(key) ? "[Redacted]" : scrub(v),
      ]),
    );
  }
  return value;
};

const scrubRequestData = (data: unknown): unknown => {
  const scrubbed = scrub(data);
  const serialized = JSON.stringify(scrubbed);
  if (serialized && serialized.length > MAX_BODY_JSON_LENGTH) {
    return { note: `Request body omitted from Sentry event — ${serialized.length} chars` };
  }
  return scrubbed;
};

const dsn = process.env.SENTRY_DSN_BACKEND || undefined;

Sentry.init({
  dsn,
  environment: process.env.NODE_ENV === "production" ? "production" : "development",
  // Conservative sampling to keep event/trace volume (and Sentry cost) low
  // at this stage — revisit once real traffic patterns are known.
  tracesSampleRate: 0.1,
  profilesSampleRate: 0.1,
  integrations: [nodeProfilingIntegration()],
  // Sentry's default request capture is opt-in for PII (sendDefaultPii is
  // false by default) — explicit here so the intent is visible in code, not
  // just inherited from an SDK default.
  sendDefaultPii: false,
  beforeSend(event) {
    if (event.request?.data) {
      event.request.data = scrubRequestData(event.request.data);
    }
    if (event.request?.headers) {
      event.request.headers = scrub(event.request.headers) as typeof event.request.headers;
    }
    if (event.request?.cookies) {
      event.request.cookies = undefined;
    }
    if (event.extra) {
      event.extra = scrub(event.extra) as typeof event.extra;
    }
    return event;
  },
});

if (!dsn) {
  logger.info("[Sentry] SENTRY_DSN_BACKEND not set — error monitoring is inactive (no-op client).");
}
