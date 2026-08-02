import "./instrument"; // must run before any other import — see instrument.ts
import app from "./app";
import { env } from "./config/env";
import { logger } from "./utils/logger";
import { prisma } from "./config/prisma";
import { startScheduledJobs } from "./jobs/scheduler";
import { hydrateEmissionFactorCache } from "./services/emissionFactor.service";
import { logGrandfatheredEsgBundleSubscribers } from "./services/billing.service";
import { verifyRazorpayCredentials } from "./config/razorpay";

let server: ReturnType<typeof app.listen>;

// Audit-only, doesn't gate startup — a query failure here shouldn't block
// accepting traffic. See billing.service.ts for what this actually checks.
logGrandfatheredEsgBundleSubscribers().catch((err) =>
  logger.error("Failed to run ESG Bundle repricing review log", err),
);

// Load the current CBAM certificate price / CEA grid factor from the DB
// before accepting traffic, so a restart after a Super Admin edit doesn't
// briefly serve the code defaults. Falls back to those defaults (already
// set as the initial module state) if the read fails, rather than blocking
// startup on it.
// Gates startup on purpose, unlike the two above: credentials Razorpay
// rejects mean every checkout 401s, and that should fail the deploy rather
// than be found by the first customer who tries to pay. Only an actual auth
// rejection rejects here — an unreachable or slow Razorpay warns and
// continues, so their outage can't block our releases.
verifyRazorpayCredentials()
  .catch((err) => {
    logger.error("Refusing to start — Razorpay credential check failed", err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .then(() =>
    hydrateEmissionFactorCache().catch((err) =>
      logger.error("Failed to hydrate emission factor cache from DB — using code defaults", err),
    ),
  )
  .finally(() => {
    server = app.listen(env.PORT, () => {
      logger.info(`Intellocarbon API listening on port ${env.PORT} [${env.NODE_ENV}]`);
      startScheduledJobs();
    });
  });

const shutdown = async (signal: string) => {
  logger.info(`${signal} received, shutting down gracefully`);
  server?.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
