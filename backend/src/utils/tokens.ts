import crypto from "crypto";
import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env";

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: string;
  approvalStatus: string;
}

export const signAccessToken = (payload: AccessTokenPayload): string =>
  jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  } as SignOptions);

export const verifyAccessToken = (token: string): AccessTokenPayload =>
  jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;

/**
 * Refresh tokens and password-reset tokens are opaque random strings, not JWTs.
 * Only the SHA-256 hash is persisted, so a leaked DB row can't be replayed.
 */
export const generateOpaqueToken = (): { token: string; tokenHash: string } => {
  const token = crypto.randomBytes(48).toString("hex");
  const tokenHash = hashOpaqueToken(token);
  return { token, tokenHash };
};

export const hashOpaqueToken = (token: string): string =>
  crypto.createHash("sha256").update(token).digest("hex");

/** True once `timeoutMinutes` have elapsed since `lastActivityAt`. A null timestamp (pre-migration rows) is treated as not-yet-expired. */
export const isSessionIdleExpired = (lastActivityAt: Date | null, timeoutMinutes: number): boolean => {
  if (!lastActivityAt) return false;
  return Date.now() - lastActivityAt.getTime() > timeoutMinutes * 60_000;
};

export const msFromDuration = (duration: string): number => {
  const match = /^(\d+)([smhd])$/.exec(duration);
  if (!match) return 0;
  const value = Number(match[1]);
  const unit = match[2];
  const unitMs: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return value * unitMs[unit];
};
