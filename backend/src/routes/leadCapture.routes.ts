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
// Public and unauthenticated by necessity — the recipient of a marketing
// email has no account to log into. Rate-limited because it is a write
// endpoint open to the internet.
router.post("/unsubscribe", leadCaptureRateLimiter, leadCaptureController.unsubscribe);

router.get("/:leadId/compliance-map.pdf", leadCaptureController.downloadComplyPdf);

export default router;
