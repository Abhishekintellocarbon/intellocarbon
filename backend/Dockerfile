# Backend API image for Railway / Render / Fly.io / any Docker host.
# Frontend (Next.js) is deployed separately to Vercel — this image is API-only.

FROM node:20-slim AS base
WORKDIR /app
# OpenSSL is required by Prisma's query engine on Debian-based images.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

FROM base AS deps
# ONLY the manifests here. Do not add `COPY prisma ./prisma` back: it puts the
# schema into this layer's cache key, so every schema edit invalidates the
# layer and forces a full `npm ci` on the next build. That install is ~78% of
# total build time on a cold build (148s of 189s); with the layer cached it is
# ~5s on Render.
#
# The commit that made this change claimed the cache churn was pushing builds
# past Render's timeout. That was wrong — see the follow-up commit. Those
# deploys were failing in ~75s at container start on a missing env var, not
# timing out. Keep the ordering anyway; it is a real speedup, just not a fix
# for anything that was actually broken.
#
# The schema is not needed to install. @prisma/client's postinstall generates a
# client when it finds one, but the build stage below runs `npx prisma generate`
# explicitly after copying the source, so generation is covered either way.
COPY package*.json ./
RUN npm ci

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build
RUN npm prune --omit=dev

FROM base AS runner
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY package.json ./

EXPOSE 4000

# Apply pending migrations, seed reference data, then start the server.
# Requires DIRECT_URL (a non-pooled connection) to be set — see README for
# Supabase connection setup.
#
# The seed is idempotent (upserts on natural keys) and touches reference
# tables only, never tenant data, so re-running it on every container start is
# safe. It runs as compiled JS rather than `prisma db seed`, because that
# would shell out to tsx — a devDependency this stage has pruned.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/scripts/seedReferenceData.js && node dist/server.js"]
