import { Router } from "express";
import * as csrdController from "../controllers/csrd.controller";
import { requireAuth } from "../middleware/requireAuth";
import { requireApproved } from "../middleware/requireApproved";

const router = Router();

router.use(requireAuth, requireApproved);

router.get("/facilities/:facilityId/reports", csrdController.listCsrdReports);

// The double materiality assessment comes first — it determines which ESRS
// standards the disclosure endpoints below will accept datapoints for.
router.get("/facilities/:facilityId/materiality/:period", csrdController.getMateriality);
router.post("/facilities/:facilityId/materiality", csrdController.saveMateriality);

router.get("/facilities/:facilityId/data/:period", csrdController.getCsrdData);
router.post("/facilities/:facilityId/data", csrdController.saveCsrdData);

router.get("/facilities/:facilityId/report/:period", csrdController.getCsrdReport);
router.get("/report/:reportId/pdf", csrdController.downloadCsrdReportPdf);

export default router;
