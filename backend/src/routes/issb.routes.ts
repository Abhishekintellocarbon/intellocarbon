import { Router } from "express";
import * as issbController from "../controllers/issb.controller";
import { requireAuth } from "../middleware/requireAuth";
import { requireApproved } from "../middleware/requireApproved";

const router = Router();

router.use(requireAuth, requireApproved);

router.get("/facilities/:facilityId/data", issbController.listIssbReports);
router.post("/facilities/:facilityId/data", issbController.saveIssbData);
router.get("/facilities/:facilityId/report/:period", issbController.getIssbReport);
router.get("/report/:reportId/pdf", issbController.downloadIssbReportPdf);

export default router;
