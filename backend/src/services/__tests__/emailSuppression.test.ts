import { describe, it, expect, afterEach } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../../config/prisma";
import {
  normaliseEmail,
  unsubscribeToken,
  verifyUnsubscribeToken,
  unsubscribeUrl,
  suppressEmail,
  isEmailSuppressed,
  filterSuppressed,
} from "../emailSuppression.service";

/**
 * Unsubscribe tokens and the marketing suppression list.
 *
 * Two properties matter more than the rest: a token must not be forgeable for
 * an address the sender didn't sign, and suppression must never reach
 * transactional mail. The second is enforced by which function a caller
 * reaches for — see the sendEmail/sendMarketingEmail split — and is asserted
 * structurally at the bottom of this file.
 */

const suffix = Date.now();
const addr = (n: string) => `suppress-${n}-${suffix}@example.com`;

afterEach(async () => {
  await prisma.emailSuppression.deleteMany({ where: { email: { contains: `-${suffix}@example.com` } } });
});

describe("normaliseEmail", () => {
  it("lowercases and trims, so the unique index actually holds", () => {
    expect(normaliseEmail("  Someone@Example.COM ")).toBe("someone@example.com");
  });
});

describe("unsubscribeToken", () => {
  it("is stable for the same address, so an old link still works", () => {
    expect(unsubscribeToken("a@example.com")).toBe(unsubscribeToken("a@example.com"));
  });

  it("ignores case and surrounding whitespace", () => {
    expect(unsubscribeToken(" A@Example.com ")).toBe(unsubscribeToken("a@example.com"));
  });

  it("differs per address", () => {
    expect(unsubscribeToken("a@example.com")).not.toBe(unsubscribeToken("b@example.com"));
  });

  it("is long enough not to be guessable and short enough to survive URL wrapping", () => {
    expect(unsubscribeToken("a@example.com")).toHaveLength(32);
  });

  it("is URL-safe, so it survives a query string intact", () => {
    // base64url: no +, / or = to be mangled by an email client rewriting links.
    expect(unsubscribeToken("a@example.com")).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe("verifyUnsubscribeToken", () => {
  it("accepts the token issued for that address", () => {
    expect(verifyUnsubscribeToken("a@example.com", unsubscribeToken("a@example.com"))).toBe(true);
  });

  // The forgery case. Without this, anyone could suppress any address they
  // liked and quietly drain the marketing list.
  it("rejects another address's token", () => {
    expect(verifyUnsubscribeToken("a@example.com", unsubscribeToken("b@example.com"))).toBe(false);
  });

  it("rejects a truncated or padded token rather than throwing", () => {
    const valid = unsubscribeToken("a@example.com");
    expect(verifyUnsubscribeToken("a@example.com", valid.slice(0, 20))).toBe(false);
    expect(verifyUnsubscribeToken("a@example.com", `${valid}xx`)).toBe(false);
  });

  it("rejects empty and garbage input rather than throwing", () => {
    expect(verifyUnsubscribeToken("a@example.com", "")).toBe(false);
    expect(verifyUnsubscribeToken("a@example.com", "not-a-token")).toBe(false);
    expect(verifyUnsubscribeToken("a@example.com", undefined as unknown as string)).toBe(false);
  });

  it("accepts a token for the same address written differently", () => {
    // The link carries the normalised address, but a recipient may retype it.
    expect(verifyUnsubscribeToken("A@Example.com", unsubscribeToken("a@example.com"))).toBe(true);
  });
});

describe("unsubscribeUrl", () => {
  it("carries the normalised address and its matching token", () => {
    const url = new URL(unsubscribeUrl("  Someone@Example.COM "));
    expect(url.pathname).toBe("/unsubscribe");
    expect(url.searchParams.get("email")).toBe("someone@example.com");
    expect(
      verifyUnsubscribeToken(url.searchParams.get("email")!, url.searchParams.get("token")!),
    ).toBe(true);
  });

  it("percent-encodes the address so a + in it survives the round trip", () => {
    // "a+tag@example.com" — a bare + in a query string decodes to a space.
    const url = new URL(unsubscribeUrl("a+tag@example.com"));
    expect(url.searchParams.get("email")).toBe("a+tag@example.com");
  });
});

describe("suppressEmail", () => {
  it("adds an address and reports it as newly suppressed", async () => {
    const email = addr("new");
    const result = await suppressEmail(email, "Unsubscribed via email link");

    expect(result).toEqual({ email, newlySuppressed: true });
    expect(await isEmailSuppressed(email)).toBe(true);
  });

  // Unsubscribe links get clicked twice, prefetched and retried. Every one of
  // those has to look like success to the person clicking.
  it("is idempotent — a second call succeeds without creating a duplicate", async () => {
    const email = addr("twice");
    await suppressEmail(email, "Unsubscribed via email link");
    const second = await suppressEmail(email, "Unsubscribed via email link");

    expect(second.newlySuppressed).toBe(false);
    expect(await prisma.emailSuppression.count({ where: { email } })).toBe(1);
  });

  it("suppresses case-insensitively, so re-mailing a differently-cased address is blocked", async () => {
    const email = addr("case");
    await suppressEmail(email.toUpperCase(), "Unsubscribed via email link");
    expect(await isEmailSuppressed(email)).toBe(true);
  });

  it("records who suppressed on the recipient's behalf, and leaves it null for a self-serve unsubscribe", async () => {
    const self = addr("self");
    const byStaff = addr("staff");
    await suppressEmail(self, "Unsubscribed via email link");
    await suppressEmail(byStaff, "Spam complaint", "ops@intellocarbon.com");

    expect((await prisma.emailSuppression.findUniqueOrThrow({ where: { email: self } })).suppressedBy).toBeNull();
    expect(
      (await prisma.emailSuppression.findUniqueOrThrow({ where: { email: byStaff } })).suppressedBy,
    ).toBe("ops@intellocarbon.com");
  });
});

describe("filterSuppressed", () => {
  it("splits a recipient list into sendable and suppressed", async () => {
    const blocked = addr("blocked");
    const allowed = addr("allowed");
    await suppressEmail(blocked, "Unsubscribed via email link");

    const result = await filterSuppressed([allowed, blocked]);
    expect(result.sendable).toEqual([allowed]);
    expect(result.suppressed).toEqual([blocked]);
  });

  it("dedupes the input, so one person on a list twice is mailed once", async () => {
    const email = addr("dupe");
    const result = await filterSuppressed([email, email.toUpperCase(), ` ${email} `]);
    expect(result.sendable).toEqual([email]);
  });

  it("returns everything as sendable when nothing is suppressed", async () => {
    const result = await filterSuppressed([addr("a"), addr("b")]);
    expect(result.sendable).toHaveLength(2);
    expect(result.suppressed).toEqual([]);
  });

  it("handles an empty list without querying for nothing", async () => {
    expect(await filterSuppressed([])).toEqual({ sendable: [], suppressed: [] });
  });
});

/**
 * The safety property, asserted against the source rather than behaviour:
 * suppression must gate marketing mail and must NOT gate transactional mail.
 * A person who unsubscribed from launch announcements has not asked to be
 * locked out of resetting their password — and that failure would be silent,
 * since the send path logs and returns rather than throwing.
 */
// Resolved from the package root rather than import.meta.url: this project's
// tsconfig targets a module format where import.meta is a type error, even
// though vitest would resolve it fine at runtime.
const readEmailService = () =>
  readFile(path.join(process.cwd(), "src/services/email.service.ts"), "utf8");

describe("suppression never blocks transactional email", () => {
  it("only sendMarketingEmail consults the suppression list", async () => {
    const source = await readEmailService();

    const marketingStart = source.indexOf("export const sendMarketingEmail");
    expect(marketingStart).toBeGreaterThan(-1);

    // isEmailSuppressed must appear, and only after sendMarketingEmail begins.
    const firstCheck = source.indexOf("isEmailSuppressed(", marketingStart);
    expect(firstCheck).toBeGreaterThan(marketingStart);

    // The transactional sender is defined above it and must contain no check.
    const transactional = source.slice(source.indexOf("const sendEmail ="), marketingStart);
    expect(transactional).not.toContain("isEmailSuppressed");
  });

  it("keeps the transactional senders off the marketing path", async () => {
    const source = await readEmailService();

    for (const fn of [
      "sendPasswordResetEmail",
      "sendVerificationDecidedEmail",
      "sendPaymentFailedEmail",
      "sendDeadlineWarningEmail",
    ]) {
      const start = source.indexOf(`export const ${fn}`);
      expect(start, `${fn} not found`).toBeGreaterThan(-1);
      const body = source.slice(start, source.indexOf("export const ", start + 10));
      expect(body, `${fn} must not send via the marketing path`).not.toContain("sendMarketingEmail");
    }
  });
});
