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

// Credential/secret keys plus the personal-data fields the app actually
// collects (see prisma/schema.prisma): direct identifiers (email, phone),
// precise location (latitude/longitude), and business identifiers (gstin).
// Sentry only needs enough of an error event to debug it — it doesn't need
// any of this, so it's redacted regardless of event size.
const SENSITIVE_KEYS = [
  "password",
  "token",
  "secret",
  "authorization",
  "cookie",
  "email",
  "phone",
  "latitude",
  "longitude",
  "address",
  "gstin",
];

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

// scrub() only redacts structured data by object key — it never touches the
// exception message/stack trace *text* itself. A DB connection error is the
// realistic case here: some drivers echo the connection string (with its
// embedded password) back in the thrown error's .message on a connection
// failure, and that text goes to Sentry as event.exception, completely
// outside the key-based scrubbing above.
const CONNECTION_STRING_PATTERN = /\b\w+:\/\/[^\s'"]*:[^\s'"@]*@[^\s'"]+/g;
const redactConnectionStrings = (text: string): string => text.replace(CONNECTION_STRING_PATTERN, "[REDACTED_CONNECTION_STRING]");

// If scrubbing itself throws on some unexpected shape, beforeSend must not
// let that exception propagate — Sentry drops the *entire* event (silently,
// no error surfaced to us) when beforeSend throws. Better to lose one field
// than lose the whole event, so every scrub call below goes through this.
const safeScrub = (label: string, fn: () => unknown): unknown => {
  try {
    return fn();
  } catch (err) {
    logger.warn(`[Sentry] beforeSend: failed to scrub ${label}, omitting field`, err);
    return "[Scrub error — field omitted]";
  }
};

const dsn = process.env.SENTRY_DSN_BACKEND || undefined;

// Opt-in verbose SDK tracing (DSN validation, transport attempts, send
// success/failure) — set SENTRY_DEBUG=true temporarily on Render if events
// still aren't arriving after "Sentry initialized: true" confirms init ran.
// Off by default so production logs aren't noisy.
const sentryDebug = process.env.SENTRY_DEBUG === "true";

Sentry.init({
  dsn,
  debug: sentryDebug,
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
    const requestData = event.request?.data;
    if (requestData) {
      event.request!.data = safeScrub("request.data", () => scrubRequestData(requestData));
    }
    const requestHeaders = event.request?.headers;
    if (requestHeaders) {
      event.request!.headers = safeScrub("request.headers", () => scrub(requestHeaders)) as typeof requestHeaders;
    }
    if (event.request?.cookies) {
      event.request.cookies = undefined;
    }
    const extra = event.extra;
    if (extra) {
      event.extra = safeScrub("extra", () => scrub(extra)) as typeof extra;
    }
    if (event.message) {
      event.message = safeScrub("message", () => redactConnectionStrings(event.message!)) as string;
    }
    if (event.exception?.values) {
      event.exception.values = safeScrub("exception.values", () =>
        event.exception!.values!.map((v) => (v.value ? { ...v, value: redactConnectionStrings(v.value) } : v)),
      ) as typeof event.exception.values;
    }
    // Never return null/undefined here — that silently drops the event
    // instead of just redacting a field. Always return the (scrubbed) event.
    return event;
  },
});

// Requested diagnostic: confirms at startup whether SENTRY_DSN_BACKEND was
// actually readable from process.env at the moment Sentry.init() ran —
// without ever printing the DSN value itself. Check Render's logs for this
// line after every deploy.
logger.info(`Sentry initialized: ${Boolean(dsn)}`);

if (!dsn) {
  logger.info("[Sentry] SENTRY_DSN_BACKEND not set — error monitoring is inactive (no-op client).");
}
