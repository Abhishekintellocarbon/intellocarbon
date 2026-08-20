import { Router } from "express";
import { COMMIT_SHA } from "../config/version";
import { dbTlsStatus } from "../config/env";
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
import companyTargetRoutes from "./companyTarget.routes";
import recRoutes from "./rec.routes";
import supplierRoutes from "./supplier.routes";
import productSkuRoutes from "./productSku.routes";
import scope3Routes from "./scope3.routes";
import voluntaryOffsetRoutes from "./voluntaryOffset.routes";
import ghgEngagementRoutes from "./ghgEngagement.routes";
import crossCheckReviewRoutes from "./crossCheckReview.routes";
import cctsObligatedEntityRoutes from "./cctsObligatedEntity.routes";
import greenSteelRoutes from "./greenSteel.routes";

const router = Router();

// `commit` makes a deploy verifiable from outside: curl this after a push and
// compare against the SHA you pushed, rather than hunting for some behaviour
// that differs between the old build and the new one. See config/version.ts.
//
// `dbTls` does the same job for an environment-variable change, which the
// commit SHA cannot: editing a variable redeploys the same commit, so the SHA
// is identical before and after and the only other confirmation was reading
// deploy logs in a dashboard. Each field is true (sslmode pins TLS), false
// (set, but can still fall back to plaintext) or null (not set at all).
router.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "intellocarbon-api",
    commit: COMMIT_SHA,
    dbTls: dbTlsStatus,
    time: new Date().toISOString(),
  });
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
router.use("/targets", companyTargetRoutes);
router.use("/recs", recRoutes);
router.use("/suppliers", supplierRoutes);
router.use("/green-steel", greenSteelRoutes);
router.use("/product-skus", productSkuRoutes);
router.use("/scope3", scope3Routes);
router.use("/offsets", voluntaryOffsetRoutes);
router.use("/ghg-runner", ghgEngagementRoutes);
router.use("/cross-check", crossCheckReviewRoutes);
router.use("/ccts-obligated-entities", cctsObligatedEntityRoutes);

export default router;
