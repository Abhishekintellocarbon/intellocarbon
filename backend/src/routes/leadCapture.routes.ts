import { Router } from "express";
import * as leadCaptureController from "../controllers/leadCapture.controller";
import { validate } from "../middleware/validate";
import { leadCaptureRateLimiter } from "../middleware/rateLimiters";
import { leadCaptureSchema } from "../validators/leadCapture.validators";

const router = Router();

router.post("/", leadCaptureRateLimiter, validate(leadCaptureSchema), leadCaptureController.submitLead);
router.get("/:leadId/compliance-map.pdf", leadCaptureController.downloadComplyPdf);

export default router;
