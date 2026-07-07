import { Router } from "express";
import * as brsrController from "../controllers/brsr.controller";
import { requireAuth } from "../middleware/requireAuth";
import { requireApproved } from "../middleware/requireApproved";

const router = Router();

router.use(requireAuth, requireApproved);

router.get("/facilities/:facilityId/data", brsrController.listBrsrReports);
router.post("/facilities/:facilityId/data", brsrController.saveBrsrData);
router.get("/facilities/:facilityId/report/:period", brsrController.getBrsrReport);
router.get("/report/:reportId/pdf", brsrController.downloadBrsrReportPdf);

export default router;
