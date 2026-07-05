import { Router } from "express";
import * as referenceController from "../controllers/reference.controller";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

router.get("/emission-factors", requireAuth, referenceController.getEmissionFactorReference);
router.get("/report-windows", requireAuth, referenceController.getReportWindowStatus);

export default router;
