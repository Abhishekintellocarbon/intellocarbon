import cron from "node-cron";
import { logger } from "../utils/logger";
import { runDailyComplianceCheck } from "../services/complianceCheck.service";
import { deleteStaleIncompleteSubscriptions } from "../services/billing.service";

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
  // Registered separately rather than chained onto the compliance check, so
  // a failure in either can't stop the other from running. 00:45 UTC keeps
  // the two from overlapping.
  cron.schedule("45 0 * * *", () => {
    deleteStaleIncompleteSubscriptions().catch((err) => {
      logger.error("Stale INCOMPLETE subscription cleanup failed", err);
    });
  });

  logger.info(
    "Scheduled jobs registered: daily compliance check at 06:00 IST, stale INCOMPLETE subscription cleanup at 06:15 IST",
  );
};
