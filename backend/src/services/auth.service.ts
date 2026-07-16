import { randomBytes } from "crypto";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { AppError } from "../utils/AppError";
import { hashPassword, verifyPassword } from "../utils/password";
import {
  generateOpaqueToken,
  hashOpaqueToken,
  isSessionIdleExpired,
  msFromDuration,
  signAccessToken,
} from "../utils/tokens";
import { sendAdminNewSignupEmail, sendPasswordResetEmail, sendWelcomeEmail } from "./email.service";
import { sendAdminNewSignupWhatsApp } from "./whatsapp.service";
import type { LoginInput, SignupInput } from "../validators/auth.validators";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
// Precomputed bcrypt hash of a random value, used only to equalize timing (see login()).
const DUMMY_PASSWORD_HASH = "$2a$12$C6UzMDM.H6dfI/f/IKcEeO0V6zL/oGx0/kqbQOa1nq6M4x0aWnrmO";

interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

const superAdminEmails = env.SUPER_ADMIN_EMAILS.split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const publicUser = (user: { id: string; name: string; email: string; companyName: string | null; role: string; approvalStatus: string; emailVerified: boolean; createdAt: Date }) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  companyName: user.companyName,
  role: user.role,
  approvalStatus: user.approvalStatus,
  emailVerified: user.emailVerified,
  createdAt: user.createdAt,
  isSuperAdmin: superAdminEmails.includes(user.email.toLowerCase()),
});

const issueTokenPair = async (
  user: { id: string; email: string; role: string; approvalStatus: string },
  meta: RequestMeta,
) => {
  const accessToken = signAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    approvalStatus: user.approvalStatus,
  });

  const { token: refreshToken, tokenHash } = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + msFromDuration(env.JWT_REFRESH_EXPIRES_IN));

  await prisma.refreshToken.create({
    data: {
      tokenHash,
      userId: user.id,
      expiresAt,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    },
  });

  // Starts (or restarts) the server-side idle-timeout clock — requireAuth
  // and the next refresh both measure against this timestamp.
  await prisma.user.update({
    where: { id: user.id },
    data: { lastActivityAt: new Date() },
  });

  return { accessToken, refreshToken, refreshTokenExpiresAt: expiresAt };
};

export const signup = async (input: SignupInput, meta: RequestMeta) => {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw AppError.conflict("An account with this email already exists", "EMAIL_TAKEN");
  }

  // Super admins bootstrap themselves — otherwise nobody could ever approve
  // the first account. Everyone else starts PENDING (see schema default).
  const isSuperAdmin = superAdminEmails.includes(input.email.toLowerCase());

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
      companyName: input.accountType === "VERIFIER" ? null : input.companyName || null,
      role: input.accountType === "VERIFIER" ? "VERIFIER" : "ADMIN",
      approvalStatus: isSuperAdmin ? "APPROVED" : "PENDING",
    },
  });

  const tokens = await issueTokenPair(user, meta);

  // Sector is only captured during company onboarding, which happens after
  // approval — nothing to report yet at signup time.
  const sector = "Not selected yet (set during onboarding)";

  if (isSuperAdmin) {
    sendWelcomeEmail(user.email, user.name).catch(() => {});
    // Email address alone isn't proof of ownership — nothing stops someone
    // else from signing up with an email that happens to match
    // SUPER_ADMIN_EMAILS before its real owner does, and this path
    // auto-approves without the usual human-review step specifically
    // because it has to (bootstrapping the very first account). The
    // unique constraint on User.email means this can't happen for an
    // *already-registered* admin — but for a not-yet-claimed entry in the
    // list, it silently succeeded with no trace. Every configured admin
    // gets notified now regardless, so an unexpected auto-approval is
    // never invisible.
    superAdminEmails.forEach((adminEmail) => {
      sendAdminNewSignupEmail(adminEmail, {
        name: user.name,
        email: user.email,
        companyName: user.companyName,
        sector,
        accountType: input.accountType,
      }).catch(() => {});
    });
  } else {
    superAdminEmails.forEach((adminEmail) => {
      sendAdminNewSignupEmail(adminEmail, {
        name: user.name,
        email: user.email,
        companyName: user.companyName,
        sector,
        accountType: input.accountType,
      }).catch(() => {});
    });

    sendAdminNewSignupWhatsApp({
      name: user.name,
      companyName: user.companyName,
      sector,
    }).catch(() => {});
  }

  return { user: publicUser(user), ...tokens };
};

export const login = async (input: LoginInput, meta: RequestMeta) => {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  // Constant-shape error so we don't leak which emails are registered.
  const invalidCredentials = () => AppError.unauthorized("Invalid email or password", "INVALID_CREDENTIALS");

  if (!user) {
    // Run a dummy bcrypt compare so lookups for unknown emails take the same
    // time as real ones, closing a timing side-channel for user enumeration.
    await verifyPassword(input.password, DUMMY_PASSWORD_HASH).catch(() => false);
    throw invalidCredentials();
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    throw AppError.forbidden(
      `Account temporarily locked due to too many failed attempts. Try again in ${minutesLeft} minute(s).`,
      "ACCOUNT_LOCKED",
    );
  }

  const passwordValid = await verifyPassword(input.password, user.passwordHash);

  if (!passwordValid) {
    const failedLoginCount = user.failedLoginCount + 1;
    const shouldLock = failedLoginCount >= MAX_FAILED_ATTEMPTS;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: shouldLock ? 0 : failedLoginCount,
        lockedUntil: shouldLock ? new Date(Date.now() + LOCKOUT_MS) : null,
      },
    });

    throw invalidCredentials();
  }

  if (user.failedLoginCount > 0 || user.lockedUntil) {
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null },
    });
  }

  // PENDING users can still log in — they just land on /pending-approval.
  // REJECTED accounts are locked out entirely, with a clear reason.
  if (user.approvalStatus === "REJECTED") {
    throw AppError.forbidden(
      "Your account application was not approved. Contact abhishek@intellocarbon.com if you believe this is a mistake.",
      "ACCOUNT_REJECTED",
    );
  }

  // Independent of approvalStatus — a Super Admin can deactivate a
  // previously-approved account without touching its approval history.
  if (!user.active) {
    throw AppError.forbidden(
      "This account has been deactivated. Contact abhishek@intellocarbon.com if you believe this is a mistake.",
      "ACCOUNT_DEACTIVATED",
    );
  }

  const tokens = await issueTokenPair(user, meta);

  return { user: publicUser(user), ...tokens };
};

export const refreshSession = async (rawToken: string, meta: RequestMeta) => {
  const tokenHash = hashOpaqueToken(rawToken);
  const existing = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!existing) {
    throw AppError.unauthorized("Session expired, please log in again", "SESSION_EXPIRED");
  }

  // A token that's already revoked being presented again means it was
  // rotated away once already (normal logout/refresh/reset) and is now
  // being replayed — either a copy was stolen, or this is a stale retry
  // racing a rotation that already happened. Either way we can't tell which
  // holder is legitimate, so the safe response is to revoke every active
  // session for this user, not just reject this one request.
  if (existing.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { userId: existing.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw AppError.unauthorized("Session expired, please log in again", "SESSION_EXPIRED");
  }

  if (existing.expiresAt < new Date()) {
    throw AppError.unauthorized("Session expired, please log in again", "SESSION_EXPIRED");
  }

  // Without this, a background silent-refresh would keep the session alive
  // forever regardless of real user activity — the refresh token itself is
  // valid for 30 days and carries no notion of idle time on its own.
  if (isSessionIdleExpired(existing.user.lastActivityAt, env.SESSION_IDLE_TIMEOUT_MINUTES)) {
    await prisma.refreshToken.updateMany({
      where: { userId: existing.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw AppError.unauthorized("Session expired due to inactivity", "SESSION_IDLE_TIMEOUT");
  }

  // Rotate: revoke the used token and issue a fresh pair.
  await prisma.refreshToken.update({
    where: { id: existing.id },
    data: { revokedAt: new Date() },
  });

  const tokens = await issueTokenPair(existing.user, meta);

  await prisma.refreshToken.update({
    where: { id: existing.id },
    data: { replacedBy: tokens.refreshToken.slice(0, 16) },
  });

  return { user: publicUser(existing.user), ...tokens };
};

export const logout = async (rawToken: string | undefined): Promise<void> => {
  if (!rawToken) return;
  const tokenHash = hashOpaqueToken(rawToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
};

export const requestPasswordReset = async (email: string): Promise<void> => {
  const user = await prisma.user.findUnique({ where: { email } });

  // Always resolve silently — don't reveal whether an email is registered.
  if (!user) return;

  const { token, tokenHash } = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + env.PASSWORD_RESET_TOKEN_EXPIRES_MIN * 60 * 1000);

  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash, expiresAt },
  });

  const resetUrl = `${env.CLIENT_URL}/reset-password?token=${token}`;
  await sendPasswordResetEmail(user.email, resetUrl);
};

export const resetPassword = async (rawToken: string, newPassword: string): Promise<void> => {
  const tokenHash = hashOpaqueToken(rawToken);
  const resetToken = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
    throw AppError.badRequest("This reset link is invalid or has expired", "INVALID_RESET_TOKEN");
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash, failedLoginCount: 0, lockedUntil: null },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    }),
    // Reset compromises trust in existing sessions — sign the user out everywhere.
    prisma.refreshToken.updateMany({
      where: { userId: resetToken.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
};

export const getCurrentUser = async (userId: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw AppError.notFound("User not found");
  return publicUser(user);
};

// Privacy Policy §5 / DPA: personal information is deleted or anonymised on
// request, except where regulatory retention applies. CBAM records must be
// kept a minimum of 7 years (Privacy Policy §5.2, EU 2024/3210 Article 23) —
// so a company with appliesCbam still true keeps its Company/Facility/
// ActivityData/Report/VerificationRequest rows (the audit trail) intact;
// only the requesting user's own identity is anonymised. A company with no
// CBAM hold has nothing blocking full erasure, so it's cascade-deleted
// outright (Company -> Facility -> ActivityData -> ... all onDelete: Cascade).
// The User row itself is never hard-deleted, only anonymised in place —
// other users' records (verification statements, audit logs) can reference
// it via onDelete: Restrict/SetNull relations that a hard delete would
// either violate or silently erase context from.
export const deleteMyAccount = async (userId: string, password: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { company: true } });
  if (!user) throw AppError.notFound("User not found");

  const validPassword = await verifyPassword(password, user.passwordHash);
  if (!validPassword) {
    throw AppError.unauthorized("Incorrect password", "INVALID_PASSWORD");
  }

  const companyDataRetainedForCompliance = Boolean(user.company?.appliesCbam);

  if (user.company && !companyDataRetainedForCompliance) {
    await prisma.company.delete({ where: { id: user.company.id } });
  }

  const anonymizedEmail = `deleted-${user.id}@deleted.intellocarbon.invalid`;
  const unusablePasswordHash = await hashPassword(randomBytes(32).toString("hex"));

  await prisma.$transaction([
    prisma.refreshToken.deleteMany({ where: { userId } }),
    prisma.passwordResetToken.deleteMany({ where: { userId } }),
    // LeadCapture isn't FK-linked to User (it's pre-signup IntelloCalc tool
    // usage), but rows matching this email are the same person's personal
    // data and aren't covered by any CBAM retention requirement.
    prisma.leadCapture.updateMany({
      where: { email: user.email },
      data: { name: null, email: anonymizedEmail, company: null, phone: null },
    }),
    prisma.user.update({
      where: { id: userId },
      data: {
        name: "Deleted user",
        email: anonymizedEmail,
        passwordHash: unusablePasswordHash,
        companyName: null,
        active: false,
        emailVerified: false,
      },
    }),
  ]);

  return { companyDataRetainedForCompliance };
};
