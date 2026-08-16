import "dotenv/config";
import { z } from "zod";

// Exported so the production guard below and the dev-mode tests can compare
// against the literal rather than restating it.
export const DEV_UNSUBSCRIBE_SECRET = "dev-only-unsubscribe-secret-not-for-production-use";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  CLIENT_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("30d"),
  // Server-enforced inactivity logout — checked against User.lastActivityAt
  // on every authenticated request, independent of the JWT's own expiry.
  SESSION_IDLE_TIMEOUT_MINUTES: z.coerce.number().default(15),
  PASSWORD_RESET_TOKEN_EXPIRES_MIN: z.coerce.number().default(15),
  RESEND_API_KEY: z.string().optional().default(""),
  RESEND_FROM: z.string().default("Intellocarbon <notifications@intellocarbon.com>"),
  RESEND_REPLY_TO: z.string().default("abhishek@intellocarbon.com"),

  // Signs the unsubscribe links embedded in marketing email. Separate from the
  // JWT secrets on purpose: those are rotated when a session-security incident
  // demands it, and rotating this one silently breaks the unsubscribe link in
  // every email already sitting in a recipient's inbox — which is both a
  // deliverability problem and, in several jurisdictions, a compliance one.
  //
  // TREAT AS NEVER-ROTATE. If it must change, keep the old value readable and
  // verify against both (see verifyUnsubscribeToken) until the old campaigns
  // have aged out.
  EMAIL_UNSUBSCRIBE_SECRET: z
    .string()
    .min(32, "EMAIL_UNSUBSCRIBE_SECRET must be at least 32 characters")
    // Dev-only fallback so a local checkout boots without another secret to
    // set. Production refuses to start on this value — see the guard below.
    .default(DEV_UNSUBSCRIBE_SECRET),

  // Comma-separated list of emails allowed to view the IntelloCalc leads admin
  // dashboard. Checked against the authenticated user's email, independent of
  // their `Role` (which governs the normal company/verifier product, not this).
  SUPER_ADMIN_EMAILS: z.string().default("abhishek@intellocarbon.com"),

  // WhatsApp (Twilio) — leave blank in dev to log the pending-signup alert to
  // the console instead of sending. TWILIO_WHATSAPP_FROM is the Twilio-assigned
  // sender number, with or without the "whatsapp:" prefix (e.g. the sandbox
  // number "whatsapp:+14155238886"). Configured at https://console.twilio.com.
  TWILIO_ACCOUNT_SID: z.string().optional().default(""),
  TWILIO_AUTH_TOKEN: z.string().optional().default(""),
  TWILIO_WHATSAPP_FROM: z.string().optional().default(""),

  // Trimmed: these are pasted by hand into a hosting dashboard, and a
  // trailing newline or space is invisible there but is sent verbatim as part
  // of the credential. That surfaced as a Razorpay 401 "Authentication
  // failed" on every checkout, with the value looking correct in the UI.
  // The same silent failure applies to the webhook secret (every event
  // rejected) and the plan IDs (plan not found), so all seven are trimmed.
  RAZORPAY_KEY_ID: z.string().trim().optional().default(""),
  RAZORPAY_KEY_SECRET: z.string().trim().optional().default(""),
  RAZORPAY_WEBHOOK_SECRET: z.string().trim().optional().default(""),
  RAZORPAY_PLAN_ID_CCTS_COMPLIANCE: z.string().trim().optional().default(""),
  RAZORPAY_PLAN_ID_CBAM_COMPLIANCE: z.string().trim().optional().default(""),
  RAZORPAY_PLAN_ID_CBAM_PLUS_CCTS: z.string().trim().optional().default(""),
  RAZORPAY_PLAN_ID_BRSR_CORE: z.string().trim().optional().default(""),

  // Error monitoring (Sentry) — left blank, Sentry.init() becomes a no-op
  // client (nothing is sent, nothing crashes) until a real DSN is set.
  SENTRY_DSN_BACKEND: z.string().optional().default(""),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";

// Unlike the two warnings below, this exits. Those are benign misconfigurations
// (a broken link, a redundant TLS flag); this one is not. The unsubscribe
// secret signs the tokens that authorise suppressing an address, so a value
// anyone can read out of the repo lets a stranger forge a valid unsubscribe
// for any email they like and suppress the entire marketing list in a loop.
if (isProd && env.EMAIL_UNSUBSCRIBE_SECRET === DEV_UNSUBSCRIBE_SECRET) {
  console.error(
    "EMAIL_UNSUBSCRIBE_SECRET is still the development default in production — unsubscribe tokens would be forgeable by anyone with the repo. Set a real secret.",
  );
  process.exit(1);
}

// CORS itself doesn't depend on this (production origins are hardcoded in
// config/cors.ts), but CLIENT_URL is baked into every transactional email
// link (password reset, welcome, billing, deadline alerts) — left at its
// localhost default in production, every one of those links is broken.
// Not fatal (nothing insecure happens), so this warns rather than exits.
if (isProd && env.CLIENT_URL === "http://localhost:3000") {
  console.error(
    "CLIENT_URL is still the localhost default in production — every emailed link (password reset, welcome, billing) will point to localhost. Set CLIENT_URL to the real frontend origin.",
  );
}

// Supabase's endpoints reject plaintext connections at the network level
// regardless of what's in the connection string, so this is defense-in-depth
// documentation, not a real vulnerability if missing — a soft warning, not a
// fail-fast, since a legitimate provider/proxy could enforce TLS without
// this exact query param.
if (isProd && !env.DATABASE_URL.includes("sslmode")) {
  console.error(
    "DATABASE_URL has no sslmode parameter — add sslmode=require so the client also refuses to fall back to a plaintext connection.",
  );
}
