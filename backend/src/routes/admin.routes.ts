import { Router } from "express";
import * as leadCaptureController from "../controllers/leadCapture.controller";
import * as userApprovalController from "../controllers/userApproval.controller";
import { requireAuth } from "../middleware/requireAuth";
import { requireSuperAdmin } from "../middleware/requireSuperAdmin";

const router = Router();

router.use(requireAuth, requireSuperAdmin);

router.get("/leads", leadCaptureController.listLeads);

router.get("/pending-users", userApprovalController.listPendingUsers);
router.post("/pending-users/:userId/approve", userApprovalController.approveUser);
router.post("/pending-users/:userId/reject", userApprovalController.rejectUser);

export default router;
