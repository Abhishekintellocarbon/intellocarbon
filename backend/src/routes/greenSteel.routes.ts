import { Router } from "express";
import * as controller from "../controllers/greenSteel.controller";
import { requireAuth } from "../middleware/requireAuth";
import { requireApproved } from "../middleware/requireApproved";

const router = Router();

router.use(requireAuth, requireApproved);

router.get("/facilities/:facilityId/assessment", controller.getAssessment);
router.get("/report/:assessmentId/pdf", controller.downloadAssessmentPdf);

export default router;
