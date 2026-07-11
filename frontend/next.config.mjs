import { withSentryConfig } from "@sentry/nextjs";

// Third-party origins the app actually loads at runtime: Razorpay's checkout
// widget (frontend/src/lib/razorpay.ts), Plausible analytics (marketing pages
// only — components/layout/plausible-analytics.tsx), and Sentry's event
// ingest. Kept as a single list so script-src/connect-src/frame-src below
// can't silently drift out of sync with each other.
const RAZORPAY_CHECKOUT_ORIGIN = "https://checkout.razorpay.com";
const RAZORPAY_API_ORIGIN = "https://api.razorpay.com";
const PLAUSIBLE_ORIGIN = "https://plausible.io";
const SENTRY_INGEST_ORIGINS = "https://*.sentry.io https://*.ingest.sentry.io https://*.ingest.us.sentry.io";
// Render's production URL, kept alongside NEXT_PUBLIC_API_URL (rather than
// only reading the env var) so a build with that var misconfigured doesn't
// also silently break every API fetch's CSP allowance on top of it.
const API_ORIGINS = [
  ...new Set(
    [
      "https://intellocarbon-api.onrender.com",
      process.env.NEXT_PUBLIC_API_URL,
      process.env.NODE_ENV !== "production" ? "http://localhost:4000" : null,
    ].filter(Boolean),
  ),
].join(" ");

// Next.js App Router's own RSC/hydration payload uses inline <script> tags,
// which need either 'unsafe-inline' or a per-request nonce via middleware.
// The nonce route forces fully dynamic rendering on every page (Next's own
// requirement — see nextjs.org/docs/app/guides/content-security-policy),
// which would take marketing/calculator pages that currently benefit from
// static generation and force them dynamic site-wide. That's a real
// performance/architecture trade-off, not just a header, so this stays with
// 'unsafe-inline' for script-src — it still blocks loading script from any
// origin other than the ones explicitly listed below, which is the actual
// XSS vector CSP is meant to close here (attacker-controlled external JS).
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${RAZORPAY_CHECKOUT_ORIGIN} ${PLAUSIBLE_ORIGIN}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${API_ORIGINS} ${RAZORPAY_API_ORIGIN} ${PLAUSIBLE_ORIGIN} ${SENTRY_INGEST_ORIGINS}`,
  `frame-src ${RAZORPAY_CHECKOUT_ORIGIN} ${RAZORPAY_API_ORIGIN}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // src/instrumentation.ts (Sentry's server/edge init) needs this on Next 14.
  experimental: {
    instrumentationHook: true,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "Content-Security-Policy", value: CSP },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // These are read from SENTRY_ORG / SENTRY_PROJECT / SENTRY_AUTH_TOKEN at
  // build time — unset until the founder creates the Sentry project and
  // adds them to Vercel. Source map upload is simply skipped until then;
  // the build itself isn't affected.
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  silent: !process.env.CI,
  widenClientFileUpload: true,
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
  },

  // Hidden source maps: upload full source maps to Sentry for readable
  // stack traces, then strip them from the public build output so they're
  // never served to end users.
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },
});
