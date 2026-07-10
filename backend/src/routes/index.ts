import { Router } from "express";
import * as Sentry from "@sentry/node";
import { logger } from "../utils/logger";
import authRoutes from "./auth.routes";
import companyRoutes from "./company.routes";
import facilityRoutes from "./facility.routes";
import referenceRoutes from "./reference.routes";
import billingRoutes from "./billing.routes";
import verifierRoutes from "./verifier.routes";
import internalDataEntryRoutes from "./internalDataEntry.routes";
import leadCaptureRoutes from "./leadCapture.routes";
import adminRoutes from "./admin.routes";
import notificationRoutes from "./notification.routes";
import brsrRoutes from "./brsr.routes";
import ghgEngagementRoutes from "./ghgEngagement.routes";
import crossCheckReviewRoutes from "./crossCheckReview.routes";

const router = Router();

router.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", service: "intellocarbon-api", time: new Date().toISOString() });
});

// Temporary manual Sentry verification route. Calls Sentry.captureException
// directly (rather than only relying on Sentry.setupExpressErrorHandler's
// automatic capture in app.ts, which is exercised separately by
// /debug/test-sentry-error-thrown below) and awaits Sentry.flush() so the
// response itself reports whether the event was captured and actually
// sent — no need to check Render logs or the Sentry dashboard just to
// confirm the plumbing works. Trigger with: GET /api/debug/test-sentry-error
// Remove only once Sentry event delivery has been confirmed.
router.get("/debug/test-sentry-error", async (_req, res) => {
  const error = new Error("Sentry backend test error — intentionally thrown via GET /api/debug/test-sentry-error");
  const eventId = Sentry.captureException(error);
  const flushed = await Sentry.flush(2000);
  logger.info(`[Sentry] test route: eventId=${eventId} flushed=${flushed}`);
  res.status(500).json({
    error: { message: error.message, code: "INTERNAL_SERVER_ERROR" },
    sentry: { eventId, flushed },
  });
});

// Same test, but via a plain throw — exercises the automatic capture path
// (Sentry.setupExpressErrorHandler in app.ts) with no direct Sentry calls
// in this file at all, to isolate whether that automatic wiring is what's
// failing versus the explicit capture above. Trigger with:
// GET /api/debug/test-sentry-error-thrown
router.get("/debug/test-sentry-error-thrown", () => {
  throw new Error("Sentry backend test error (thrown) — via GET /api/debug/test-sentry-error-thrown");
});

router.use("/auth", authRoutes);
router.use("/company", companyRoutes);
router.use("/facilities", facilityRoutes);
router.use("/reference", referenceRoutes);
router.use("/billing", billingRoutes);
router.use("/verifier", verifierRoutes);
router.use("/internal-data-entry", internalDataEntryRoutes);
router.use("/leads", leadCaptureRoutes);
router.use("/admin", adminRoutes);
router.use("/notifications", notificationRoutes);
router.use("/brsr", brsrRoutes);
router.use("/ghg-runner", ghgEngagementRoutes);
router.use("/cross-check", crossCheckReviewRoutes);

export default router;
