import { Router } from "express";
import * as brsrController from "../controllers/brsr.controller";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

router.use(requireAuth);

router.get("/facilities/:facilityId/data", brsrController.listBrsrReports);
router.post("/facilities/:facilityId/data", brsrController.saveBrsrData);
router.get("/facilities/:facilityId/report/:period", brsrController.getBrsrReport);
router.get("/report/:reportId/pdf", brsrController.downloadBrsrReportPdf);

export default router;
