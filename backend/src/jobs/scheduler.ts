import cron from "node-cron";
import { logger } from "../utils/logger";
import { runDailyComplianceCheck } from "../services/complianceCheck.service";

/**
 * Runs in-process inside this long-running Express server (Render), not as
 * a serverless function — it only fires if the process is alive at
 * 00:30 UTC. The existing keep-alive GitHub Action pinging this service is
 * what makes that a safe assumption.
 */
export const startScheduledJobs = (): void => {
  // 00:30 UTC = 06:00 IST daily.
  cron.schedule("30 0 * * *", () => {
    runDailyComplianceCheck().catch((err) => {
      logger.error("Daily compliance check job failed", err);
    });
  });
  logger.info("Scheduled jobs registered: daily compliance check at 06:00 IST");
};
