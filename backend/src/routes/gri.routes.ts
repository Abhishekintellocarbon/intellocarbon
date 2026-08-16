import { Router } from "express";
import * as griController from "../controllers/gri.controller";
import { requireAuth } from "../middleware/requireAuth";
import { requireApproved } from "../middleware/requireApproved";

const router = Router();

router.use(requireAuth, requireApproved);

router.get("/facilities/:facilityId/reports", griController.listGriReports);

// GRI 3 comes first — the materiality assessment determines which Topic
// Standards the disclosure endpoints below will accept data for.
router.get("/facilities/:facilityId/materiality/:period", griController.getMateriality);
router.post("/facilities/:facilityId/materiality", griController.saveMateriality);

router.get("/facilities/:facilityId/data/:period", griController.getGriData);
router.post("/facilities/:facilityId/data", griController.saveGriData);

router.get("/facilities/:facilityId/report/:period", griController.getGriReport);
router.get("/report/:reportId/pdf", griController.downloadGriReportPdf);

export default router;
