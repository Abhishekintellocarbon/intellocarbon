import { Router } from "express";
import * as billingController from "../controllers/billing.controller";
import { requireAuth } from "../middleware/requireAuth";
import { requireApproved } from "../middleware/requireApproved";
import { validate } from "../middleware/validate";
import { checkoutSchema, cancelSchema } from "../validators/billing.validators";

const router = Router();

// Razorpay calls this directly — authenticated via HMAC signature, not a session.
router.post("/webhook", billingController.razorpayWebhook);

router.use(requireAuth, requireApproved);
router.get("/plans", billingController.getPlans);
router.get("/subscription", billingController.getSubscription);
router.post("/checkout", validate(checkoutSchema), billingController.createCheckout);
router.post("/cancel", validate(cancelSchema), billingController.cancelSubscription);

export default router;
