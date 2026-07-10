import { Router } from "express";
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

// Temporary manual Sentry verification route — intentionally throws so the
// error flows through the normal error-handling chain (app.ts) and gets
// captured by Sentry.setupExpressErrorHandler once SENTRY_DSN_BACKEND is
// set. Trigger with: GET /api/debug/test-sentry-error
// Remove only once Sentry event delivery has been confirmed.
router.get("/debug/test-sentry-error", () => {
  throw new Error("Sentry backend test error — intentionally thrown via GET /api/debug/test-sentry-error");
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
