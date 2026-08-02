import Razorpay from "razorpay";
import { env, isProd } from "./env";
import { logger } from "../utils/logger";
import { PLANS } from "../data/plans";

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

/**
 * Everything beyond the API keys that a working checkout needs. Plan IDs are
 * read from process.env by name (matching planIdForTier in
 * billing.service.ts, which does the same lookup per request) rather than
 * from the parsed `env` object, so this guard checks exactly what that code
 * path will see.
 */
const missingBillingConfig = (): string[] => {
  // Trimmed to match planIdForTier's own read: a whitespace-only value is
  // non-empty here but useless there, which would pass this guard and then
  // fail every checkout — exactly the split-brain the guard exists to prevent.
  const missing = Object.values(PLANS)
    .map((plan) => plan.razorpayPlanIdEnvVar)
    .filter((name): name is string => Boolean(name) && !process.env[name!]?.trim());

  // Without this, verifyWebhookSignature() fails closed on every event, so a
  // subscription created at checkout stays INCOMPLETE forever — the customer
  // pays and never gets access. Strictly worse than dev-bypass, which at
  // least grants access, so it's part of the same guard rather than a warning.
  if (!env.RAZORPAY_WEBHOOK_SECRET) missing.push("RAZORPAY_WEBHOOK_SECRET");

  return missing;
};

/**
 * Half-configured billing is the one state worse than either fully-on or
 * fully-off: keys present means the dev-bypass path is skipped, but a missing
 * plan ID 400s every checkout and a missing webhook secret takes payment
 * without granting access. Both are invisible until a customer hits them.
 *
 * In production this throws, which fails the deploy — the platform keeps the
 * previous healthy release serving rather than promoting a build whose
 * billing is broken. In development it only warns, so partial local config
 * (keys but no plans, say) still boots.
 */
if (isRazorpayConfigured) {
  const missing = missingBillingConfig();

  if (missing.length > 0) {
    const message =
      `Razorpay credentials are set but billing is only half-configured — missing: ${missing.join(", ")}. ` +
      "Checkout would fail (missing plan ID) or take payment without granting access (missing webhook secret).";
    if (isProd) {
      throw new Error(`${message} Refusing to start with billing in this state.`);
    }
    logger.warn(`${message} Continuing because this is not production.`);
  } else {
    // The key id is a public identifier (it's handed to the browser at
    // checkout), so logging its mode prefix leaks nothing and answers "which
    // Razorpay account is this deploy actually pointed at" at a glance.
    const mode = env.RAZORPAY_KEY_ID.startsWith("rzp_live") ? "LIVE" : "TEST";
    logger.info(`Razorpay configured in ${mode} mode — real checkout enabled, all plan IDs and webhook secret present`);
  }
}
