import { Router } from "express";
import * as crossCheckReviewController from "../controllers/crossCheckReview.controller";
import { requireAuth } from "../middleware/requireAuth";
import { requireApproved } from "../middleware/requireApproved";
import { validate } from "../middleware/validate";
import { upsertCrossCheckReviewSchema } from "../validators/crossCheckReview.validators";

// Reachable by both the Super Admin and Verifier portals — access is scoped
// per-request inside the service (requireReviewerAccess), not by role
// middleware here, since neither requireSuperAdmin nor requireRole("VERIFIER")
// alone covers both callers.
const router = Router();

router.use(requireAuth, requireApproved);

router.get("/facilities/:facilityId", crossCheckReviewController.listForFacility);
router.put(
  "/activity-data/:activityDataId/documents/:documentId",
  validate(upsertCrossCheckReviewSchema),
  crossCheckReviewController.upsertReview,
);

export default router;
