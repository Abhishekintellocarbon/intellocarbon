import app from "./app";
import { env } from "./config/env";
import { logger } from "./utils/logger";
import { prisma } from "./config/prisma";
import { startScheduledJobs } from "./jobs/scheduler";

const server = app.listen(env.PORT, () => {
  logger.info(`Intellocarbon API listening on port ${env.PORT} [${env.NODE_ENV}]`);
  startScheduledJobs();
});

const shutdown = async (signal: string) => {
  logger.info(`${signal} received, shutting down gracefully`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
