import { Router } from "express";
import * as leadCaptureController from "../controllers/leadCapture.controller";
import { validate } from "../middleware/validate";
import { leadCaptureRateLimiter } from "../middleware/rateLimiters";
import { leadCaptureSchema, esgWaitlistSchema } from "../validators/leadCapture.validators";

const router = Router();

router.post("/", leadCaptureRateLimiter, validate(leadCaptureSchema), leadCaptureController.submitLead);
router.post(
  "/esg-waitlist",
  leadCaptureRateLimiter,
  validate(esgWaitlistSchema),
  leadCaptureController.submitEsgWaitlist,
);
router.get("/:leadId/compliance-map.pdf", leadCaptureController.downloadComplyPdf);

export default router;
