import crypto from "crypto";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { logger } from "../utils/logger";

/**
 * Unsubscribe tokens and the marketing-email suppression list.
 *
 * Tokens are DERIVED, not stored: an HMAC of the normalised email under a
 * dedicated secret. That means a link works forever without a row existing
 * for every address ever mailed, and an unsubscribe link in a two-year-old
 * email still resolves. The cost is that rotating EMAIL_UNSUBSCRIBE_SECRET
 * invalidates every link already in every inbox, which is why config/env.ts
 * documents it as never-rotate and refuses to boot production on the dev
 * default.
 *
 * The token authorises one action — "suppress this address" — and nothing
 * else. It is not a session, reveals nothing about the recipient, and grants
 * no read access, so a leaked link costs the recipient only the marketing
 * email they were trying to stop anyway.
 */

/** Lowercased and trimmed. The only writer of `EmailSuppression.email`, so the unique index actually holds. */
export const normaliseEmail = (email: string): string => email.trim().toLowerCase();

/**
 * base64url of HMAC-SHA256(normalised email). Truncated to 32 chars (192
 * bits) — far past brute-force for an action this cheap, and short enough to
 * survive an email client's URL wrapping without a line break.
 */
export const unsubscribeToken = (email: string): string =>
  crypto
    .createHmac("sha256", env.EMAIL_UNSUBSCRIBE_SECRET)
    .update(normaliseEmail(email))
    .digest("base64url")
    .slice(0, 32);

/**
 * Constant-time compare. A plain `===` on an HMAC leaks the position of the
 * first differing byte through timing, which is exactly the oracle needed to
 * forge a token one character at a time.
 */
export const verifyUnsubscribeToken = (email: string, token: string): boolean => {
  const expected = unsubscribeToken(email);
  const provided = Buffer.from(token ?? "", "utf8");
  const expectedBuf = Buffer.from(expected, "utf8");
  // timingSafeEqual throws on a length mismatch, which would itself be a
  // timing signal — compare lengths first and still run the comparison.
  if (provided.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(provided, expectedBuf);
};

/** The link that goes in a marketing email's footer and its List-Unsubscribe header. */
export const unsubscribeUrl = (email: string): string => {
  const normalised = normaliseEmail(email);
  const params = new URLSearchParams({ email: normalised, token: unsubscribeToken(normalised) });
  return `${env.CLIENT_URL}/unsubscribe?${params.toString()}`;
};

export interface SuppressionResult {
  email: string;
  /** False when the address was already suppressed — the caller can still report success. */
  newlySuppressed: boolean;
}

/**
 * Adds an address to the suppression list.
 *
 * Idempotent by design: unsubscribe links get clicked twice, prefetched, and
 * retried, and every one of those has to look like success to the person
 * clicking. A second call updates nothing and reports newlySuppressed: false.
 */
export const suppressEmail = async (
  email: string,
  reason: string,
  suppressedBy?: string,
): Promise<SuppressionResult> => {
  const normalised = normaliseEmail(email);

  const existing = await prisma.emailSuppression.findUnique({ where: { email: normalised } });
  if (existing) return { email: normalised, newlySuppressed: false };

  await prisma.emailSuppression.create({
    data: { email: normalised, reason, suppressedBy: suppressedBy ?? null },
  });
  logger.info(`Email suppressed: ${normalised} (${reason})`);
  return { email: normalised, newlySuppressed: true };
};

export const isEmailSuppressed = async (email: string): Promise<boolean> => {
  const found = await prisma.emailSuppression.findUnique({
    where: { email: normaliseEmail(email) },
    select: { id: true },
  });
  return found !== null;
};

/**
 * Filters a recipient list down to those who may still receive marketing
 * email. One query for the whole list rather than one per address — a launch
 * send is the only caller and it runs over the full waitlist at once.
 */
export const filterSuppressed = async (
  emails: string[],
): Promise<{ sendable: string[]; suppressed: string[] }> => {
  const normalised = Array.from(new Set(emails.map(normaliseEmail)));
  const rows = await prisma.emailSuppression.findMany({
    where: { email: { in: normalised } },
    select: { email: true },
  });
  const blocked = new Set(rows.map((r) => r.email));
  return {
    sendable: normalised.filter((e) => !blocked.has(e)),
    suppressed: normalised.filter((e) => blocked.has(e)),
  };
};
