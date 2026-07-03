import { Router } from "express";
import authRoutes from "./auth.routes";
import companyRoutes from "./company.routes";
import facilityRoutes from "./facility.routes";
import referenceRoutes from "./reference.routes";
import billingRoutes from "./billing.routes";
import verifierRoutes from "./verifier.routes";
import leadCaptureRoutes from "./leadCapture.routes";
import adminRoutes from "./admin.routes";

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
router.use("/leads", leadCaptureRoutes);
router.use("/admin", adminRoutes);

export default router;
