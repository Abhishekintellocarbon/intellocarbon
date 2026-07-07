import { Router } from "express";
import * as verificationController from "../controllers/verification.controller";
import * as verifierFacilityController from "../controllers/verifierFacility.controller";
import { requireAuth } from "../middleware/requireAuth";
import { requireApproved } from "../middleware/requireApproved";
import { requireRole } from "../middleware/requireRole";
import { validate } from "../middleware/validate";
import {
  decideVerificationSchema,
  updateChecklistSchema,
  raiseQuerySchema,
} from "../validators/verification.validators";

const router = Router();

router.use(requireAuth, requireApproved, requireRole("VERIFIER"));

router.get("/checklist-items", verificationController.getChecklistItems);

router.get("/requests/pending", verificationController.listPending);
router.get("/requests/mine", verificationController.listMyAssignments);
router.get("/requests/:id", verificationController.getRequestDetail);
router.post("/requests/:id/claim", verificationController.claimRequest);
router.post("/requests/:id/decide", validate(decideVerificationSchema), verificationController.decideRequest);
router.patch("/requests/:id/checklist", validate(updateChecklistSchema), verificationController.updateChecklist);
router.post("/requests/:id/queries", validate(raiseQuerySchema), verificationController.raiseQuery);
router.get("/requests/:id/queries", verificationController.listQueriesForRequest);

router.get("/facilities", verifierFacilityController.listAssignedFacilities);
router.get("/facilities/:facilityId", verifierFacilityController.getFacilityDetail);
router.get("/facilities/:facilityId/documents/:documentId/download", verifierFacilityController.downloadDocument);

export default router;
