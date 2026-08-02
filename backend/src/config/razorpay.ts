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

/** Which Razorpay account this deploy talks to, read off the key id's prefix. */
const razorpayMode = (): "LIVE" | "TEST" => (env.RAZORPAY_KEY_ID.startsWith("rzp_live") ? "LIVE" : "TEST");

/**
 * Enough to tell a mistyped credential from a mode/account mismatch, without
 * printing anything secret.
 *
 * The key id is logged in full because it is already a public identifier —
 * createCheckout returns it to the browser as `razorpayKeyId` and hands it to
 * Razorpay's checkout script. Printing it lets you diff it character by
 * character against the dashboard, which is what catches a truncated paste or
 * a stale key.
 *
 * The secret is never printed, only measured. Razorpay's 401 is identical
 * whether the secret is mistyped, truncated, from the other mode, or since
 * rotated — but a length that doesn't match the dashboard's proves truncation
 * on its own, which narrows the search without disclosing the value.
 */
const credentialFingerprint = (): string =>
  `Key id ${env.RAZORPAY_KEY_ID} (public), secret length ${env.RAZORPAY_KEY_SECRET.length} (value never logged).`;

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
    logger.info(
      `Razorpay configured in ${razorpayMode()} mode — real checkout enabled, all plan IDs and webhook secret present. ` +
        credentialFingerprint(),
    );
  }
}

const CREDENTIAL_CHECK_TIMEOUT_MS = 10_000;

/** Razorpay answers a bad key/secret pair with HTTP 401. */
const isAuthFailure = (err: unknown): boolean =>
  typeof err === "object" && err !== null && (err as { statusCode?: number }).statusCode === 401;

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
  Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms).unref()),
  ]);

/**
 * Confirms at startup that Razorpay actually accepts the configured key and
 * secret, rather than discovering it when a customer's first checkout 401s.
 * The config guard above only proves the values are non-empty; it cannot tell
 * a correct secret from a mistyped one.
 *
 * Deliberately distinguishes two failures that look similar in a log:
 *
 * - **Credentials rejected (401)** — a configuration error that will break
 *   every purchase. Fatal in production, so the deploy fails and the
 *   platform keeps the previous healthy release serving.
 * - **Razorpay unreachable, slow, or 5xx** — nothing to do with our config.
 *   Warn and continue, so an outage on their side can't block our deploys.
 *
 * Read-only: lists at most one customer and creates nothing.
 */
export const verifyRazorpayCredentials = async (): Promise<void> => {
  if (!isRazorpayConfigured || !razorpay) return;

  try {
    await withTimeout(razorpay.customers.all({ count: 1 }), CREDENTIAL_CHECK_TIMEOUT_MS);
    logger.info("Razorpay credentials verified — the API accepted this key and secret");
  } catch (err) {
    if (isAuthFailure(err)) {
      const message =
        "Razorpay rejected the configured credentials (HTTP 401 Authentication failed). " +
        "Every checkout will fail until RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are a matching pair " +
        "from the same key, in the same mode (test/live), and not since regenerated. " +
        // Repeated here rather than left to the startup line above: when a
        // deploy dies on this, the failure log should carry everything needed
        // to compare against the dashboard without hunting for another line.
        `Mode reads as ${razorpayMode()} from the key id. ${credentialFingerprint()}`;
      // `cause` keeps Razorpay's own response attached to the thrown error,
      // so the startup log shows their description alongside ours.
      if (isProd) throw new Error(message, { cause: err });
      logger.error(`${message} Continuing because this is not production.`);
      return;
    }

    logger.warn(
      "Couldn't verify Razorpay credentials at startup — the API was unreachable, slow, or returned an error " +
        "that isn't an auth failure. Continuing: this says nothing about whether our configuration is correct.",
      err,
    );
  }
};
