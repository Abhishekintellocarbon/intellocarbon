import { Router } from "express";
import * as ghgEngagementController from "../controllers/ghgEngagement.controller";
import { requireAuth } from "../middleware/requireAuth";
import { requireSuperAdmin } from "../middleware/requireSuperAdmin";
import { validate } from "../middleware/validate";
import {
  createGhgEngagementSchema,
  updateGhgEngagementSchema,
  calculatePreviewSchema,
} from "../validators/ghgEngagement.validators";
import { GHG_JURISDICTION_OPTIONS } from "../data/ghgJurisdictions";

const router = Router();

router.use(requireAuth, requireSuperAdmin);

router.get("/jurisdictions", (_req, res) => res.status(200).json({ jurisdictions: GHG_JURISDICTION_OPTIONS }));

router.post("/calculate", validate(calculatePreviewSchema), ghgEngagementController.calculatePreview);

router.get("/engagements", ghgEngagementController.listEngagements);
router.post("/engagements", validate(createGhgEngagementSchema), ghgEngagementController.createEngagement);
router.get("/engagements/:id", ghgEngagementController.getEngagement);
router.put("/engagements/:id", validate(updateGhgEngagementSchema), ghgEngagementController.updateEngagement);
router.post("/engagements/:id/finalize", ghgEngagementController.finalizeEngagement);
router.post("/engagements/:id/duplicate", ghgEngagementController.duplicateEngagement);
router.post("/engagements/:id/generate-report", ghgEngagementController.generateReport);
router.get("/engagements/:id/report", ghgEngagementController.downloadReport);

export default router;
