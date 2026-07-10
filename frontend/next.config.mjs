import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // src/instrumentation.ts (Sentry's server/edge init) needs this on Next 14.
  experimental: {
    instrumentationHook: true,
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
