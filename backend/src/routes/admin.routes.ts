import { Router } from "express";
import * as leadCaptureController from "../controllers/leadCapture.controller";
import { requireAuth } from "../middleware/requireAuth";
import { requireSuperAdmin } from "../middleware/requireSuperAdmin";

const router = Router();

router.use(requireAuth, requireSuperAdmin);

router.get("/leads", leadCaptureController.listLeads);

export default router;
