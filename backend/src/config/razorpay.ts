import Razorpay from "razorpay";
import { env, isProd } from "./env";
import { logger } from "../utils/logger";

/**
 * True when no real Razorpay credentials are configured. In this mode, billing
 * flows simulate a successful checkout/payment locally instead of calling the
 * Razorpay API — mirrors the console-log fallback used for email in dev.
 * Set RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET (and RAZORPAY_WEBHOOK_SECRET, plan
 * IDs) to exercise the real integration.
 */
export const isRazorpayConfigured = Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);

export const razorpay = isRazorpayConfigured
  ? new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET })
  : null;

// Unlike email/WhatsApp dev-bypass (which only logs when actually used),
// this fires at startup — checkout is silent otherwise, and running
// production billing unconfigured (every checkout granting a free active
// subscription with no payment) needs to be impossible to miss in logs.
if (!isRazorpayConfigured) {
  const message = "Razorpay not configured — billing is running in dev-bypass mode (checkouts activate for free, no payment collected)";
  if (isProd) {
    logger.error(`${message}. This must not run unconfigured in production.`);
  } else {
    logger.info(message);
  }
}
