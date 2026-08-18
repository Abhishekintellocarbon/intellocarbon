import { Router } from "express";
import * as cdpController from "../controllers/cdp.controller";
import { requireAuth } from "../middleware/requireAuth";
import { requireApproved } from "../middleware/requireApproved";

const router = Router();

router.use(requireAuth, requireApproved);

router.get("/facilities/:facilityId/reports", cdpController.listCdpReports);

// No materiality endpoint, unlike GRI and CSRD. CDP asks every responding
// company every question in the questionnaire it issues, so there is nothing
// to gate the answer endpoints on.
router.get("/facilities/:facilityId/data/:period", cdpController.getCdpData);
router.post("/facilities/:facilityId/data", cdpController.saveCdpData);

router.get("/facilities/:facilityId/report/:period", cdpController.getCdpReport);
router.get("/report/:reportId/pdf", cdpController.downloadCdpReportPdf);

export default router;
