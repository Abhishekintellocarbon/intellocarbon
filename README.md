# Intellocarbon

India's first unified Environmental Compliance and Climate Intelligence Platform.

This repo ships the project scaffold, a production-ready authentication system,
the steel-sector emissions compliance module (company/facility setup, activity
data entry, dual-GWP CBAM + CCTS calculations), CBAM/CCTS PDF report generation,
a third-party verification workflow, and Razorpay-billed subscriptions.

## Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS — deploys to Vercel
- **Backend**: Node.js, Express, TypeScript, Prisma — deploys to any Docker host
  (Railway / Render / Fly.io) as an always-on service, separate from the frontend
- **Database**: PostgreSQL — Supabase in production, via pooled + direct connections
- **Auth**: Short-lived JWT access tokens (in memory) + rotating httpOnly refresh
  token cookies, bcrypt password hashing, account lockout, single-use password
  reset tokens
- **Payments**: Razorpay Subscriptions (3 tiers, gated by facility count)
- **Email**: Resend (welcome, password reset, verification, and billing notifications)
- **Reports**: `pdfkit`-generated CBAM Specific Embedded Emissions and CCTS GHG
  Intensity PDF reports

## Project structure

```
intellocarbon/
├── backend/            # Express API
│   ├── Dockerfile        # production image (Railway/Render/Fly)
│   ├── prisma/           # schema + migrations
│   └── src/
│       ├── config/        # env validation, Prisma client, Razorpay client
│       ├── controllers/   # request handlers
│       ├── data/           # emission factor library, GWP tables (AR4/AR5), plan config
│       ├── middleware/    # auth guard, role guard, rate limiting, validation, error handling
│       ├── routes/
│       ├── services/      # auth, email, company/facility, activity data, calculation
│       │                    engine, billing, verification, PDF report generation
│       ├── utils/
│       └── validators/    # zod schemas
├── frontend/            # Next.js app
│   └── src/
│       ├── app/            # routes: /, /login, /signup, /forgot-password,
│       │                     /reset-password, /dashboard, /onboarding/company,
│       │                     /facilities, /facilities/[id]/data-entry/..., /billing,
│       │                     /verifier/dashboard, /verifier/review/[id]
│       ├── components/     # ui/ (design system), auth/, onboarding/, facilities/,
│       │                     activity-data/, layout/
│       ├── context/         # AuthProvider
│       └── lib/              # API client, types, validation schemas, constants, Razorpay loader
└── docker-compose.yml   # local Postgres
```

## Design system

| Token | Value |
|---|---|
| Background | `#0F1923` |
| Card / surface | `#162230` |
| Teal accent | `#00D4AA` |
| Blue accent | `#4A9EFF` |
| Font | Inter |

Defined in `frontend/tailwind.config.ts` under `theme.extend.colors` (`surface`,
`teal`, `blue`) and loaded via `next/font/google` in `frontend/src/app/layout.tsx`.

## Getting started

### 1. Database

Start Postgres with Docker:

```bash
docker compose up -d
```

Or point `DATABASE_URL` in `backend/.env` at any Postgres instance (Neon, Supabase,
RDS, local install, etc).

### 2. Backend

```bash
cd backend
cp .env.example .env        # then fill in JWT_ACCESS_SECRET / JWT_REFRESH_SECRET
npm install
npx prisma migrate dev
npm run dev                 # http://localhost:4000
```

Generate strong secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

In development, if `RESEND_API_KEY` is left blank, all emails (welcome, password
reset, verification, billing) are logged to the console instead of sent — the
reset link shows up directly in the backend's terminal output. If
`RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` are left blank, subscription checkout
runs in a simulated "dev bypass" mode — clicking Subscribe activates the plan
immediately without calling Razorpay, so the full facility-gating flow is testable
without a Razorpay account.

### 3. Frontend

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev                 # http://localhost:3000
```

## Auth system overview

- **Signup / Login** — `bcrypt` password hashing, zod-validated input, rate limited.
- **Sessions** — 15-minute JWT access tokens held in memory on the client (never
  `localStorage`, to limit XSS exposure); a 30-day opaque refresh token stored as an
  httpOnly, `SameSite=Lax` cookie scoped to `/api/auth`. Refresh tokens rotate on
  every use and are hashed (SHA-256) before being persisted.
- **Account lockout** — 5 failed login attempts locks the account for 15 minutes.
- **Password reset** — single-use, 60-minute-expiry tokens; resetting a password
  revokes all of that user's existing sessions.
- **Logout** — revokes the current refresh token server-side.

## Emissions compliance module (steel sector)

- **Company onboarding** — 4-step wizard (`/onboarding/company`): company basics,
  business/sector details, applicable compliance schemes (CBAM / CCTS / PAT),
  review & confirm. One company per user account (`Company.ownerId`, unique).
- **Facilities** — `/facilities`: plants/mills under a company, with type
  (integrated steel plant, EAF mini-mill, DRI plant, ...) and production route
  (BF-BOF, EAF, DRI+EAF).
- **Steel activity data entry** — per facility, per reporting period: production
  quantity, fuel & energy consumption (dynamic rows), process materials
  (limestone/dolomite calcination), precursor materials (pig iron, DRI, scrap,
  ferro-alloys), grid/renewable electricity, imported steam.
- **Calculation engine** (`backend/src/services/emissionCalculation.service.ts`) —
  Tier-1 IPCC-style calculation producing, per activity data entry:
  - **CBAM Specific Embedded Emissions (SEE)**, using IPCC **AR5** GWPs
    (CH4=28, N2O=265 — per EU CBAM Implementing Regulation 2023/1773 Annex III)
  - **CCTS GHG intensity**, using IPCC **AR4** GWPs (CH4=25, N2O=298 — matching
    India's PAT / GHG Programme convention)
  - A full audit-trail breakdown (fuel-by-fuel, material-by-material) stored as
    JSON alongside the result
  - All default emission factors are indicative Tier-1 values (IPCC 2006
    Guidelines + typical industry figures) and are editable per line item —
    see the disclaimer on the results screen and the comments in
    `backend/src/data/emissionFactors.ts`.

## Reports, verification, and billing

- **PDF reports** — `GET /api/facilities/:facilityId/activity-data/:dataId/report/{cbam,ccts}`
  streams a PDF built with `pdfkit`. The CBAM report
  (`backend/src/services/cbamReport/`) is a 14-page Communication Package —
  cover, table of contents, executive summary, installation/declarant details,
  goods & production data, SEE results, financial impact analysis, direct/
  indirect emissions detail, precursor emissions, methodology, verification
  statement, and declaration/annexures. The CCTS report
  (`backend/src/services/report.service.ts`) is a simpler single-topic
  GHG-intensity report. Downloaded from the results page in the frontend via an
  authenticated blob fetch (the endpoint needs the bearer access token, so a
  plain `<a href>` won't work — see `activityDataApi.downloadReport` in
  `frontend/src/lib/api.ts`).
- **Verification workflow** — a `VERIFIER`-role account (toggle at signup, no
  company required) claims `PENDING` verification requests from
  `/verifier/dashboard`, reviews the submitted activity data at
  `/verifier/review/[id]`, and approves or rejects with a statement/comments.
  Company users submit a request from an activity data entry's results page;
  one verification request per activity data entry (resubmission after
  rejection means creating a new activity data entry, not reopening the old
  request).
- **Billing** — 3 Razorpay-billed, per-facility-priced tiers defined in
  `backend/src/data/plans.ts`: CCTS Compliance (₹14,999/facility/mo, domestic
  CCTS obligation only), CBAM Compliance (₹19,999/facility/mo, EU exporters),
  and CBAM + CCTS (₹29,999/facility/mo, both). None of the three plans enforce
  a facility cap server-side (`facilityLimit: null`) — pricing is a straight
  per-facility multiplication shown live on `/billing`'s facility calculator,
  not a tiered limit. Enterprise (>5 facilities, custom modules) is a
  contact-sales callout on the pricing page, not a purchasable tier. Company
  onboarding routes through `/billing` before `/facilities/new`.

## Deployment

Frontend and backend deploy to **separate hosts** — Next.js to Vercel, the
Express API to any Docker-friendly always-on host (Railway, Render, Fly.io).
This repo doesn't have a live Supabase/Vercel/Railway/Razorpay/Resend account
wired up; the steps below are what's needed to stand one up.

### 1. Supabase (production database)

1. Create a project at [supabase.com](https://supabase.com).
2. In **Project Settings → Database → Connection string**, copy:
   - The **direct connection** (port `5432`) → `DIRECT_URL`
   - The **transaction pooler / PgBouncer connection** (port `6543`, add
     `?pgbouncer=true`) → `DATABASE_URL`

   The app uses `DATABASE_URL` (pooled) at runtime and `DIRECT_URL` only for
   `prisma migrate` — see `backend/prisma/schema.prisma`'s `datasource` block.
3. Run the migration once against production:
   ```bash
   cd backend
   DATABASE_URL="<pooled>" DIRECT_URL="<direct>" npx prisma migrate deploy
   ```
   (The backend's Docker image also runs this automatically on container start.)

### 2. Backend (Railway / Render / Fly.io)

1. Point the host at `backend/Dockerfile` (all three support "deploy from
   Dockerfile" directly from this repo).
2. Set environment variables from `backend/.env.example`: `DATABASE_URL`,
   `DIRECT_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CLIENT_URL` (your
   Vercel frontend URL), `RESEND_API_KEY`, `RAZORPAY_KEY_ID`,
   `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`,
   `RAZORPAY_PLAN_ID_CCTS_COMPLIANCE`, `RAZORPAY_PLAN_ID_CBAM_COMPLIANCE`,
   `RAZORPAY_PLAN_ID_CBAM_PLUS_CCTS`, `NODE_ENV=production`.
3. Note the deployed URL (e.g. `https://api-intellocarbon.up.railway.app`) —
   you'll need it for the frontend's `NEXT_PUBLIC_API_URL`.
4. **CORS is a hardcoded allowlist**, not just `CLIENT_URL` — see
   `backend/src/config/cors.ts`. It allows `intellocarbon.com`,
   `www.intellocarbon.com`, `intellocarbon.vercel.app`, Vercel preview URLs
   (`intellocarbon-*.vercel.app` and `*.intellocarbon.vercel.app`), and
   whatever `CLIENT_URL` is set to. If you add another production domain,
   add it to that file, not just the env var — a mismatched origin makes the
   browser silently block every API response, which the frontend surfaces as
   a generic "Something went wrong" with no useful error.

**Free-tier sleep**: Render's (and some other hosts') free plans spin the
service down after ~15 minutes idle, so the first request after a lull pays a
slow cold start. `.github/workflows/keep-backend-awake.yml` pings
`/api/health` every 10 minutes via a scheduled GitHub Action to keep it warm —
update the URL in that file if your backend host/URL differs, or delete the
workflow once you're on a plan that doesn't sleep.

### 3. Frontend (Vercel)

This is a monorepo with the Next.js app in `frontend/`, not at the repo root.
Use the **Root Directory** project setting for this — it's the only approach
that correctly handles this app's dynamic/SSR routes (e.g.
`/facilities/[id]`, `/verifier/review/[id]`), because it makes Vercel's
Next.js build pipeline actually run from inside `frontend/` and package those
routes as serverless functions. There is no `vercel.json` key that replicates
this (no `rootDirectory` field exists in `vercel.json`), and faking it with a
custom `buildCommand`/`outputDirectory` produces a build that looks fine for
static pages but 404s on dynamic ones — don't reach for that instead.

1. Import this repo into Vercel.
2. In **Project Settings → Build and Deployment → Root Directory**, set it to
   `frontend`, then **Save**.
3. Leave Framework Preset, Build Command, Output Directory, and Install
   Command all on their auto-detected defaults — Vercel zero-configs Next.js
   correctly once Root Directory is set, no `vercel.json` needed.
4. Set `NEXT_PUBLIC_API_URL` to the backend URL from step 2.
5. Deploy (or redeploy, if you'd already imported the project — changing Root
   Directory takes effect on the next deployment, not retroactively).

### 4. Razorpay

1. Create a **Subscriptions → Plan** for each of the three tiers — CCTS
   Compliance, CBAM Compliance, CBAM + CCTS (Enterprise has no self-serve
   plan). Copy each Plan ID into `RAZORPAY_PLAN_ID_CCTS_COMPLIANCE` /
   `RAZORPAY_PLAN_ID_CBAM_COMPLIANCE` / `RAZORPAY_PLAN_ID_CBAM_PLUS_CCTS` on
   the backend host.
2. Add a webhook (**Settings → Webhooks**) pointing at
   `https://<backend-host>/api/billing/webhook`, subscribed to
   `subscription.activated`, `subscription.charged`, `subscription.cancelled`,
   `subscription.completed`, and `payment.failed`. Copy the webhook secret into
   `RAZORPAY_WEBHOOK_SECRET`.
3. Copy the API **Key ID** / **Key Secret** into `RAZORPAY_KEY_ID` /
   `RAZORPAY_KEY_SECRET`. Until these three are set, checkout runs in dev-bypass
   mode even in production — don't forget to set them before launch.

### 5. Resend

1. Verify a sending domain at [resend.com](https://resend.com).
2. Copy the API key into `RESEND_API_KEY`; set `RESEND_FROM` to an address on
   the verified domain.

### Cross-origin cookies

Because the frontend and backend are on different hosts, the refresh-token
cookie is sent cross-site on every API call. `backend/src/controllers/auth.controller.ts`
sets `SameSite=None; Secure` in production for exactly this reason (`Lax` is
only used in local dev, where both apps share `localhost`). This works whether
you're on free-tier default domains (`*.vercel.app` / `*.up.railway.app`) or
custom subdomains of the same domain — no further cookie configuration needed,
just make sure `CLIENT_URL` (backend) and `NEXT_PUBLIC_API_URL` (frontend) are
set correctly so CORS and cookies both resolve to the right hosts.

## Known limitations / next steps

- `next` is pinned to the latest Next.js **14** patch release per project
  requirements; several `npm audit` advisories affecting the Next.js 14.x line are
  only fixed in the Next.js 16 major — revisit this tradeoff if/when a major upgrade
  is acceptable.
- Email verification is not yet enforced (the `emailVerified` field exists on the
  `User` model but no verification flow is wired up).
- Emission factors are indicative defaults, not certified CBAM/CCTS regulatory
  values — verify against the current CBAM Implementing Regulation and India GHG
  Programme documentation before using calculations for actual regulatory
  submission.
- Only the steel sector activity-data module is built; cement, aluminium,
  fertilizer, hydrogen, and electricity sectors (also selectable at company
  onboarding) don't have data-entry modules yet.
- Facility editing isn't implemented yet (create, view, delete are).
- No self-serve checkout for the Enterprise tier by design (unlimited facilities,
  "contact sales") — there's no admin UI yet to manually provision an Enterprise
  subscription, so it currently requires a direct database update.
- Billing is single-currency (INR) and monthly-only; annual billing isn't wired up.
- Verification requests are one-per-activity-data-entry with no resubmission
  flow after rejection — the intended path is to create a corrected activity
  data entry and submit that instead.
