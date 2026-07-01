import Razorpay from "razorpay";
import { env } from "./env";

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
