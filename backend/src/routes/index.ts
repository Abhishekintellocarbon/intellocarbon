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
import issbRoutes from "./issb.routes";
import griRoutes from "./gri.routes";
import csrdRoutes from "./csrd.routes";
import cdpRoutes from "./cdp.routes";
import scope3Routes from "./scope3.routes";
import voluntaryOffsetRoutes from "./voluntaryOffset.routes";
import ghgEngagementRoutes from "./ghgEngagement.routes";
import crossCheckReviewRoutes from "./crossCheckReview.routes";
import cctsObligatedEntityRoutes from "./cctsObligatedEntity.routes";

const router = Router();

router.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", service: "intellocarbon-api", time: new Date().toISOString() });
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
router.use("/issb", issbRoutes);
router.use("/gri", griRoutes);
router.use("/csrd", csrdRoutes);
router.use("/cdp", cdpRoutes);
router.use("/scope3", scope3Routes);
router.use("/offsets", voluntaryOffsetRoutes);
router.use("/ghg-runner", ghgEngagementRoutes);
router.use("/cross-check", crossCheckReviewRoutes);
router.use("/ccts-obligated-entities", cctsObligatedEntityRoutes);

export default router;
