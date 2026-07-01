import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { AppError } from "../utils/AppError";
import { hashPassword, verifyPassword } from "../utils/password";
import {
  generateOpaqueToken,
  hashOpaqueToken,
  msFromDuration,
  signAccessToken,
} from "../utils/tokens";
import { sendPasswordResetEmail, sendWelcomeEmail } from "./email.service";
import type { LoginInput, SignupInput } from "../validators/auth.validators";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
// Precomputed bcrypt hash of a random value, used only to equalize timing (see login()).
const DUMMY_PASSWORD_HASH = "$2a$12$C6UzMDM.H6dfI/f/IKcEeO0V6zL/oGx0/kqbQOa1nq6M4x0aWnrmO";

interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

const publicUser = (user: { id: string; name: string; email: string; companyName: string | null; role: string; emailVerified: boolean; createdAt: Date }) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  companyName: user.companyName,
  role: user.role,
  emailVerified: user.emailVerified,
  createdAt: user.createdAt,
});

const issueTokenPair = async (
  user: { id: string; email: string; role: string },
  meta: RequestMeta,
) => {
  const accessToken = signAccessToken({ sub: user.id, email: user.email, role: user.role });

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

  return { accessToken, refreshToken, refreshTokenExpiresAt: expiresAt };
};

export const signup = async (input: SignupInput, meta: RequestMeta) => {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw AppError.conflict("An account with this email already exists", "EMAIL_TAKEN");
  }

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
      companyName: input.accountType === "VERIFIER" ? null : input.companyName || null,
      role: input.accountType === "VERIFIER" ? "VERIFIER" : "ADMIN",
    },
  });

  const tokens = await issueTokenPair(user, meta);

  sendWelcomeEmail(user.email, user.name).catch(() => {});

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

  const tokens = await issueTokenPair(user, meta);

  return { user: publicUser(user), ...tokens };
};

export const refreshSession = async (rawToken: string, meta: RequestMeta) => {
  const tokenHash = hashOpaqueToken(rawToken);
  const existing = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!existing || existing.revokedAt || existing.expiresAt < new Date()) {
    throw AppError.unauthorized("Session expired, please log in again", "SESSION_EXPIRED");
  }

  // Rotate: revoke the used token and issue a fresh pair. If a revoked token is
  // replayed, it signals theft — revoke every token for that user as a precaution.
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
