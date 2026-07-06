import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  CLIENT_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("30d"),
  PASSWORD_RESET_TOKEN_EXPIRES_MIN: z.coerce.number().default(60),
  COOKIE_DOMAIN: z.string().default("localhost"),
  RESEND_API_KEY: z.string().optional().default(""),
  RESEND_FROM: z.string().default("Intellocarbon <notifications@intellocarbon.com>"),
  RESEND_REPLY_TO: z.string().default("abhishek@intellocarbon.com"),

  // Comma-separated list of emails allowed to view the IntelloCalc leads admin
  // dashboard. Checked against the authenticated user's email, independent of
  // their `Role` (which governs the normal company/verifier product, not this).
  SUPER_ADMIN_EMAILS: z.string().default("abhishek@intellocarbon.com"),

  RAZORPAY_KEY_ID: z.string().optional().default(""),
  RAZORPAY_KEY_SECRET: z.string().optional().default(""),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional().default(""),
  RAZORPAY_PLAN_ID_CCTS_COMPLIANCE: z.string().optional().default(""),
  RAZORPAY_PLAN_ID_CBAM_COMPLIANCE: z.string().optional().default(""),
  RAZORPAY_PLAN_ID_CBAM_PLUS_CCTS: z.string().optional().default(""),
  RAZORPAY_PLAN_ID_BRSR_CORE: z.string().optional().default(""),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";
