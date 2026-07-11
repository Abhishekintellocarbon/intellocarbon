import { env, isProd } from "../config/env";
import { logger } from "../utils/logger";

// Where pending-signup alerts go. Not an env var — Twilio credentials are
// configurable per-environment, but there's a single ops recipient today.
const ADMIN_WHATSAPP_TO = "+919238824664";

const twilioConfigured = Boolean(
  env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_WHATSAPP_FROM,
);

const asWhatsAppAddress = (raw: string) => (raw.startsWith("whatsapp:") ? raw : `whatsapp:${raw}`);

const sendWhatsAppMessage = async (to: string, body: string): Promise<void> => {
  if (!twilioConfigured) {
    // Only dump the recipient/body locally — if Twilio creds are ever
    // missing in production this must degrade to a redacted log line, not
    // leak a phone number and message content into production logs.
    if (isProd) {
      logger.error("Twilio credentials missing in production — WhatsApp message not sent (content redacted)");
    } else {
      logger.info(`[whatsapp:dev] Would send WhatsApp message to ${to}`, { body });
    }
    return;
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`;
  const credentials = Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString("base64");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      From: asWhatsAppAddress(env.TWILIO_WHATSAPP_FROM),
      To: asWhatsAppAddress(to),
      Body: body,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    logger.error(`Twilio failed to send WhatsApp message to ${to}`, { status: res.status, detail });
    throw new Error(`Failed to send WhatsApp message: ${res.status}`);
  }
};

export const sendAdminNewSignupWhatsApp = async (signup: {
  name: string;
  companyName: string | null;
  sector: string;
}): Promise<void> => {
  const body = [
    "New Intellocarbon signup awaiting approval",
    `Name: ${signup.name}`,
    `Company: ${signup.companyName ?? "—"}`,
    `Sector: ${signup.sector}`,
    `Review: ${env.CLIENT_URL}/admin/approvals`,
  ].join("\n");

  await sendWhatsAppMessage(ADMIN_WHATSAPP_TO, body);
};
