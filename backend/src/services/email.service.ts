import { Resend } from "resend";
import { env } from "../config/env";
import { logger } from "../utils/logger";

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

const sendEmail = async ({ to, subject, html }: SendEmailParams): Promise<void> => {
  if (!resend) {
    logger.info(`[email:dev] Would send email to ${to}`, { subject, html });
    return;
  }

  const { error } = await resend.emails.send({ from: env.RESEND_FROM, to, subject, html });
  if (error) {
    logger.error(`Resend failed to send email to ${to}`, error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
};

const emailShell = (title: string, bodyHtml: string) => `
  <div style="background:#0F1923;padding:32px;font-family:Inter,Arial,sans-serif;">
    <div style="max-width:480px;margin:0 auto;background:#162230;border-radius:12px;padding:32px;border:1px solid #22303f;">
      <h1 style="color:#00D4AA;font-size:20px;margin:0 0 16px;">Intellocarbon</h1>
      <h2 style="color:#F5F7FA;font-size:18px;margin:0 0 12px;">${title}</h2>
      <div style="color:#B5C0CC;font-size:14px;line-height:1.6;">${bodyHtml}</div>
    </div>
  </div>
`;

const button = (href: string, label: string) => `
  <p style="margin:24px 0;">
    <a href="${href}" style="background:#00D4AA;color:#0F1923;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">${label}</a>
  </p>
`;

export const sendPasswordResetEmail = async (to: string, resetUrl: string): Promise<void> => {
  const html = emailShell(
    "Reset your password",
    `<p>We received a request to reset your Intellocarbon password. This link expires in ${env.PASSWORD_RESET_TOKEN_EXPIRES_MIN} minutes.</p>
     ${button(resetUrl, "Reset password")}
     <p>If you didn't request this, you can safely ignore this email.</p>`,
  );
  await sendEmail({ to, subject: "Reset your Intellocarbon password", html });
};

export const sendWelcomeEmail = async (to: string, name: string): Promise<void> => {
  const html = emailShell(
    `Welcome, ${name}`,
    `<p>Your Intellocarbon account is ready. Start tracking emissions, compliance, and climate risk in one place.</p>`,
  );
  await sendEmail({ to, subject: "Welcome to Intellocarbon", html });
};

export const sendSubscriptionActivatedEmail = async (to: string, planName: string): Promise<void> => {
  const html = emailShell(
    "Subscription activated",
    `<p>Your <strong>${planName}</strong> plan is now active. You can add facilities and start generating CBAM and CCTS reports right away.</p>
     ${button(`${env.CLIENT_URL}/billing`, "View billing")}`,
  );
  await sendEmail({ to, subject: `Your Intellocarbon ${planName} plan is active`, html });
};

export const sendPaymentFailedEmail = async (to: string): Promise<void> => {
  const html = emailShell(
    "Payment failed",
    `<p>We couldn't process your latest subscription payment. Please update your payment method to avoid losing access to your facilities and reports.</p>
     ${button(`${env.CLIENT_URL}/billing`, "Update payment method")}`,
  );
  await sendEmail({ to, subject: "Action needed: Intellocarbon payment failed", html });
};

export const sendVerificationSubmittedEmail = async (to: string, facilityName: string): Promise<void> => {
  const html = emailShell(
    "Verification request submitted",
    `<p>Your activity data for <strong>${facilityName}</strong> has been submitted for independent verification. We'll notify you once a verifier has reviewed it.</p>`,
  );
  await sendEmail({ to, subject: "Verification request submitted", html });
};

export const sendVerificationDecidedEmail = async (
  to: string,
  facilityName: string,
  approved: boolean,
  resultUrl: string,
): Promise<void> => {
  const html = emailShell(
    approved ? "Verification approved" : "Verification rejected",
    `<p>Your activity data for <strong>${facilityName}</strong> has been ${
      approved ? "<strong style=\"color:#00D4AA\">approved</strong>" : "<strong style=\"color:#FF5C6C\">rejected</strong>"
    } by an independent verifier.</p>
     ${button(resultUrl, "View details")}`,
  );
  await sendEmail({
    to,
    subject: approved ? "Your emissions data has been verified" : "Your emissions data was not verified",
    html,
  });
};

export const sendNewVerificationRequestEmail = async (to: string, facilityName: string): Promise<void> => {
  const html = emailShell(
    "New verification request available",
    `<p>A new activity data submission for <strong>${facilityName}</strong> is awaiting an independent verifier.</p>
     ${button(`${env.CLIENT_URL}/verifier/dashboard`, "Open verifier dashboard")}`,
  );
  await sendEmail({ to, subject: "New verification request available", html });
};
