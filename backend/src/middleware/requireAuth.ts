import type { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/AppError";
import { verifyAccessToken, isSessionIdleExpired, type AccessTokenPayload } from "../utils/tokens";
import { prisma } from "../config/prisma";
import { env } from "../config/env";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
    }
  }
}

export const requireAuth = async (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

  if (!token) {
    return next(AppError.unauthorized("Authentication required"));
  }

  let payload: AccessTokenPayload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    return next(AppError.unauthorized("Invalid or expired token", "TOKEN_EXPIRED"));
  }

  // The JWT's own expiry only proves the token was issued recently — it says
  // nothing about whether the user has actually been active since. A silent
  // refresh can keep minting valid access tokens indefinitely, so idle
  // timeout has to be enforced here, server-side, on every request — a
  // client-side JS timer alone is unreliable (backgrounded/minimized tabs
  // and locked devices throttle or pause it).
  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { lastActivityAt: true },
    });

    if (!user) {
      return next(AppError.unauthorized("Invalid or expired token", "TOKEN_EXPIRED"));
    }

    if (isSessionIdleExpired(user.lastActivityAt, env.SESSION_IDLE_TIMEOUT_MINUTES)) {
      return next(AppError.unauthorized("Session expired due to inactivity", "SESSION_IDLE_TIMEOUT"));
    }

    await prisma.user.update({
      where: { id: payload.sub },
      data: { lastActivityAt: new Date() },
    });

    req.user = payload;
    next();
  } catch (err) {
    next(err);
  }
};
