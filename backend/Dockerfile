# Backend API image for Railway / Render / Fly.io / any Docker host.
# Frontend (Next.js) is deployed separately to Vercel — this image is API-only.

FROM node:20-slim AS base
WORKDIR /app
# OpenSSL is required by Prisma's query engine on Debian-based images.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package*.json ./
COPY prisma ./prisma
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

# Apply pending migrations, then start the server. Requires DIRECT_URL (a
# non-pooled connection) to be set — see README for Supabase connection setup.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
