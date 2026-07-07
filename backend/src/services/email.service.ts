import { Resend } from "resend";
import { env } from "../config/env";
import { logger } from "../utils/logger";
import type { BorderResults, ComplyResults, IndiaResults } from "./intellocalcCalculations";
import { buildComplyPdf } from "./complyPdf.service";
import { CBAM_CERTIFICATE_PRICE_EUR, CBAM_CERTIFICATE_PRICE_QUARTER } from "../data/intellocalcConstants";

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  attachments?: { filename: string; content: Buffer }[];
}

const sendEmail = async ({ to, subject, html, attachments }: SendEmailParams): Promise<void> => {
  if (!resend) {
    logger.info(`[email:dev] Would send email to ${to}`, { subject, html, attachments: attachments?.map((a) => a.filename) });
    return;
  }

  const { error } = await resend.emails.send({
    from: env.RESEND_FROM,
    to,
    subject,
    html,
    replyTo: env.RESEND_REPLY_TO,
    attachments,
  });
  if (error) {
    logger.error(`Resend failed to send email to ${to}`, error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
};

const pdfToBuffer = (doc: PDFKit.PDFDocument): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });

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

export const sendMonthlyReminderEmail = async (
  to: string,
  facilityName: string,
  currentMonthLabel: string,
  previousMonthIncomplete: boolean,
  previousMonthLabel: string,
): Promise<void> => {
  const html = emailShell(
    `Enter ${currentMonthLabel} activity data`,
    previousMonthIncomplete
      ? `<p>Your <strong>${previousMonthLabel}</strong> activity data for <strong>${facilityName}</strong> is still incomplete or in draft. Please finish it, then enter your ${currentMonthLabel} data.</p>
         ${button(`${env.CLIENT_URL}/facilities`, "Complete activity data")}`
      : `<p>Please enter ${currentMonthLabel} activity data for <strong>${facilityName}</strong>.</p>
         ${button(`${env.CLIENT_URL}/facilities`, "Enter activity data")}`,
  );
  await sendEmail({
    to,
    subject: `Reminder: enter ${currentMonthLabel} activity data for ${facilityName}`,
    html,
  });
};

export const sendDeadlineWarningEmail = async (
  to: string,
  framework: "CCTS" | "CBAM",
  daysLeft: 30 | 7,
  incompleteCount: number,
  totalCount: number,
  deadlineLabel: string,
): Promise<void> => {
  const urgent = daysLeft === 7;
  const html = emailShell(
    urgent ? `Urgent: ${framework} report due in 7 days` : `${framework} report due in 30 days`,
    `<p>${urgent ? '<strong style="color:#FF5C6C">Urgent — a</strong>' : "Your"} ${framework} report is due on <strong>${deadlineLabel}</strong> (${daysLeft} days away). <strong>${incompleteCount} of ${totalCount}</strong> required data entries ${incompleteCount === 1 ? "is" : "are"} still incomplete.</p>
     ${button(`${env.CLIENT_URL}/facilities`, "Review activity data")}`,
  );
  await sendEmail({
    to,
    subject: urgent
      ? `Urgent: ${framework} report due in 7 days — ${incompleteCount} entries incomplete`
      : `${framework} report due in 30 days — ${incompleteCount} entries incomplete`,
    html,
  });
};

const fmtNum = (n: number, digits = 2) => n.toLocaleString("en-IN", { maximumFractionDigits: digits });
const fmtEur = (n: number) => `€${fmtNum(n)}`;
const fmtInr = (n: number) => `₹${fmtNum(n)}`;

const row = (label: string, value: string) => `
  <tr>
    <td style="padding:6px 0;color:#8AA0B4;font-size:13px;">${label}</td>
    <td style="padding:6px 0;color:#E8F0F7;font-size:13px;font-weight:600;text-align:right;">${value}</td>
  </tr>
`;

export const sendLeadBorderEmail = async (to: string, name: string, results: BorderResults): Promise<void> => {
  const rows = [
    row("EU Default Embedded Emissions Rate", `${fmtNum(results.seeValue, 3)} tCO2e/tonne`),
    row("Total Embedded Emissions for EU Exports", `${fmtNum(results.totalEmbeddedEmissionsTco2e)} tCO2e`),
    row("Estimated CBAM Certificates Required", fmtNum(results.certificatesRequired)),
    row("Estimated CBAM Exposure", `${fmtEur(results.cbamLiabilityEur)} (approx. ${fmtInr(results.cbamLiabilityInr)})`),
  ];
  if (results.article9DeductionEur !== undefined) {
    rows.push(row("Article 9 Deduction (CCTS)", fmtEur(results.article9DeductionEur)));
  }
  if (results.netLiabilityEur !== undefined) {
    rows.push(row("Net CBAM Exposure After CCTS Deduction", fmtEur(results.netLiabilityEur)));
  }

  const html = emailShell(
    `Hi ${name}, here's your CBAM exposure estimate`,
    `<p>Thanks for using <strong>IntelloCalc Border</strong>. Here's your instant CBAM exposure estimate:</p>
     <table style="width:100%;border-collapse:collapse;margin-top:8px;">${rows.join("")}</table>
     <p style="margin-top:16px;font-size:12px;color:#8AA0B4;">This estimate uses EU default values per EU 2025/2621. Certificate price used: EUR ${CBAM_CERTIFICATE_PRICE_EUR} (${CBAM_CERTIFICATE_PRICE_QUARTER}).</p>
     ${button(`${env.CLIENT_URL}/signup`, "Generate Your Verified CBAM Report")}
     <p>Questions? Reply to this email or write to abhishek@intellocarbon.com.</p>`,
  );
  await sendEmail({ to, subject: "Your CBAM Exposure Estimate — Intellocarbon IntelloCalc Border", html });
};

export const sendLeadIndiaEmail = async (to: string, name: string, results: IndiaResults): Promise<void> => {
  const positionLabel: Record<string, string> = {
    SURPLUS_LIKELY: "Surplus likely — you may be eligible to earn Carbon Credit Certificates",
    NEAR_TARGET: "Near target — precise calculation needed",
    DEFICIT_LIKELY: "Deficit likely — you may need to purchase CCCs",
    NO_REFERENCE: "Sector-specific target required from BEE",
  };

  const rows = [
    row("Your Estimated GHG Intensity", `${fmtNum(results.ghgIntensity, 3)} tCO2e/tonne`),
    row(
      "Sector Reference Intensity",
      results.referenceIntensity !== null ? `${fmtNum(results.referenceIntensity, 3)} tCO2e/tonne` : "Not available",
    ),
    row("Your Position", positionLabel[results.position]),
  ];
  if (results.estimatedCccImpact !== null) {
    rows.push(row("Estimated Annual CCC Impact", `${fmtNum(results.estimatedCccImpact)} CCCs`));
  }

  const html = emailShell(
    `Hi ${name}, here's your CCTS position check`,
    `<p>Thanks for using <strong>IntelloCalc India</strong>. Here's your instant CCTS GHG intensity check:</p>
     <table style="width:100%;border-collapse:collapse;margin-top:8px;">${rows.join("")}</table>
     <p style="margin-top:16px;font-size:12px;color:#8AA0B4;">This is an indicative estimate based on sector reference benchmarks. GWP values used: AR2/BUR3 as per S.O. 2825(E) 2023.</p>
     ${button(`${env.CLIENT_URL}/signup`, "Get Your Full CCTS Compliance Report")}
     <p>Questions? Reply to this email or write to abhishek@intellocarbon.com.</p>`,
  );
  await sendEmail({ to, subject: "Your CCTS Position Check — Intellocarbon IntelloCalc India", html });
};

export const sendLeadComplyEmail = async (
  to: string,
  name: string,
  results: ComplyResults,
  leadId: string,
): Promise<void> => {
  let bodyHtml: string;
  if (results.nonManufacturer) {
    bodyHtml = `<p>Most carbon compliance frameworks apply to manufacturers. You may still have EPR obligations if you import or sell packaged goods. Contact us to assess.</p>`;
  } else if (results.noneApplicable) {
    bodyHtml = `<p>Great news — based on your answers, you may not have mandatory carbon compliance obligations right now. However UK CBAM starts 2027 and India CCTS is expanding. Stay ahead with Intellocarbon monitoring.</p>`;
  } else {
    const items = results.frameworks
      .map(
        (f) =>
          `<li style="margin-bottom:10px;"><strong style="color:#E8F0F7;">${f.name}</strong> — <span style="color:#00D4AA;">${f.status}</span><br/><span style="color:#8AA0B4;font-size:12px;">${f.deadline}</span></li>`,
      )
      .join("");
    bodyHtml = `<p>Here are the frameworks that apply to your business:</p><ul style="padding-left:18px;">${items}</ul>`;
  }

  const attachments = !results.nonManufacturer && !results.noneApplicable
    ? [{ filename: "intellocalc-compliance-map.pdf", content: await pdfToBuffer(buildComplyPdf(name, "", results)) }]
    : undefined;

  const html = emailShell(
    `Hi ${name}, here's your personalised compliance map`,
    `${bodyHtml}
     ${button(`${env.CLIENT_URL}/signup`, "Get Started on Intellocarbon")}
     <p style="font-size:12px;color:#8AA0B4;">Reference: ${leadId.slice(-8)}. Questions? Reply to this email or write to abhishek@intellocarbon.com.</p>`,
  );
  await sendEmail({
    to,
    subject: "Your Personalised Compliance Map — Intellocarbon IntelloCalc Comply",
    html,
    attachments,
  });
};

export const sendAdminNewSignupEmail = async (
  to: string,
  signup: { name: string; email: string; companyName: string | null; sector: string; accountType: string },
): Promise<void> => {
  const html = emailShell(
    "New signup awaiting approval",
    `<p>A new user has signed up and is waiting for approval.</p>
     <table style="width:100%;border-collapse:collapse;margin-top:8px;">
       ${row("Name", signup.name)}
       ${row("Email", signup.email)}
       ${row("Company", signup.companyName ?? "—")}
       ${row("Sector", signup.sector)}
       ${row("Account type", signup.accountType)}
     </table>
     ${button(`${env.CLIENT_URL}/admin/approvals`, "Review in Super Admin panel")}`,
  );
  await sendEmail({ to, subject: `New signup awaiting approval: ${signup.name}`, html });
};

export const sendAccountApprovedEmail = async (to: string, name: string): Promise<void> => {
  const html = emailShell(
    `You're approved, ${name}`,
    `<p>Your Intellocarbon account has been reviewed and approved. You can log in now and get started.</p>
     ${button(`${env.CLIENT_URL}/login`, "Log in to Intellocarbon")}`,
  );
  await sendEmail({ to, subject: "Your Intellocarbon account is approved", html });
};

export const sendAccountRejectedEmail = async (to: string, name: string): Promise<void> => {
  const html = emailShell(
    `About your Intellocarbon application`,
    `<p>Hi ${name}, thanks for your interest in Intellocarbon. After review, we're not able to approve this account at this time.</p>
     <p>If you believe this is a mistake, reply to this email or write to abhishek@intellocarbon.com and we'll take another look.</p>`,
  );
  await sendEmail({ to, subject: "Your Intellocarbon account application", html });
};

export const sendNewVerificationRequestEmail = async (to: string, facilityName: string): Promise<void> => {
  const html = emailShell(
    "New verification request available",
    `<p>A new activity data submission for <strong>${facilityName}</strong> is awaiting an independent verifier.</p>
     ${button(`${env.CLIENT_URL}/verifier/dashboard`, "Open verifier dashboard")}`,
  );
  await sendEmail({ to, subject: "New verification request available", html });
};
