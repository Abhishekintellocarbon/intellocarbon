# Monthly Security Checklist

Manual review — these need human judgment and aren't automatable. Automated
checks (npm audit, rate-limit/CORS drift, git secret scan) run on their own
via `.github/workflows/monthly-security-check.yml` and email a summary to
abhishek@intellocarbon.com on the 1st of every month; this file is for the
parts that don't fit into that.

**Last reviewed:** _(update this line each time you go through the list)_

- [ ] **Sentry error logs** — implemented and confirmed delivering events.
      Look for unusual patterns: repeated failed auth attempts from the
      same source, odd spikes in API call volume, errors clustering around
      a specific endpoint or user.
- [ ] **Supabase / Render access logs** — check for unfamiliar IPs or access
      patterns you don't recognize.
- [ ] **User roles and permissions** — confirm no one has access they
      shouldn't (super-admin allowlist, verifier accounts, company
      ownership).
- [ ] **Supabase database password** — confirm it hasn't been exposed
      anywhere new (chat logs, screenshots, shared documents) since the last
      review.

---

*Note: Sentry was wired up in code on 2026-07-10 — `@sentry/node` +
`@sentry/profiling-node` on the backend (`src/instrument.ts`, initialized
before any other import; error capture via `Sentry.setupExpressErrorHandler`
in `app.ts`), and `@sentry/nextjs` on the frontend (`sentry.client/server/edge.config.ts`
+ `src/instrumentation.ts` + `withSentryConfig` in `next.config.mjs`). Both
sides read their DSN from an environment variable (`SENTRY_DSN_BACKEND` on
Render, `NEXT_PUBLIC_SENTRY_DSN_FRONTEND` on Vercel). Event delivery was
confirmed via the temporary `GET /api/debug/test-sentry-error` (backend) and
`/debug/test-sentry-error` (frontend) routes on 2026-07-12; both have since
been removed now that verification is done — don't re-add them as permanent
routes if Sentry plumbing needs debugging again, gate any future one behind
`!isProd` instead.*
