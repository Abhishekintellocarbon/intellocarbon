import { Router } from "express";
import * as verificationController from "../controllers/verification.controller";
import { requireAuth } from "../middleware/requireAuth";
import { requireApproved } from "../middleware/requireApproved";
import { requireRole } from "../middleware/requireRole";
import { validate } from "../middleware/validate";
import { decideVerificationSchema } from "../validators/verification.validators";

const router = Router();

router.use(requireAuth, requireApproved, requireRole("VERIFIER"));

router.get("/requests/pending", verificationController.listPending);
router.get("/requests/mine", verificationController.listMyAssignments);
router.get("/requests/:id", verificationController.getRequestDetail);
router.post("/requests/:id/claim", verificationController.claimRequest);
router.post("/requests/:id/decide", validate(decideVerificationSchema), verificationController.decideRequest);

export default router;
