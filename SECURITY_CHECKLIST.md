# Monthly Security Checklist

Manual review — these need human judgment and aren't automatable. Automated
checks (npm audit, rate-limit/CORS drift, git secret scan) run on their own
via `.github/workflows/monthly-security-check.yml` and email a summary to
abhishek@intellocarbon.com on the 1st of every month; this file is for the
parts that don't fit into that.

**Last reviewed:** _(update this line each time you go through the list)_

- [ ] **Sentry error logs** — look for unusual patterns: repeated failed
      auth attempts from the same source, odd spikes in API call volume,
      errors clustering around a specific endpoint or user.
- [ ] **Supabase / Render access logs** — check for unfamiliar IPs or access
      patterns you don't recognize.
- [ ] **User roles and permissions** — confirm no one has access they
      shouldn't (super-admin allowlist, verifier accounts, company
      ownership).
- [ ] **Supabase database password** — confirm it hasn't been exposed
      anywhere new (chat logs, screenshots, shared documents) since the last
      review.

---

*Note: Sentry isn't currently wired up in this codebase as of 2026-07-05 —
the first checklist item assumes it exists. If it isn't set up yet, either
set it up or adjust this item to whatever error-tracking you're actually
using.*
