import type { CookieOptions, Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { env, isProd } from "../config/env";
import { msFromDuration } from "../utils/tokens";
import { AppError } from "../utils/AppError";
import * as authService from "../services/auth.service";

const REFRESH_COOKIE_NAME = "ic_refresh_token";

const refreshCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: isProd,
  // The frontend (Vercel) and this API are deployed on separate hosts, which
  // makes API calls cross-site from the browser's point of view even when both
  // sit under the same custom domain's subdomains. Cross-site fetches only carry
  // cookies with SameSite=None (which in turn requires Secure). Lax is kept for
  // local dev, where frontend/backend share "localhost" and Secure isn't available.
  sameSite: isProd ? "none" : "lax",
  path: "/api/auth",
  maxAge: msFromDuration(env.JWT_REFRESH_EXPIRES_IN),
});

const requestMeta = (req: Request) => ({
  ipAddress: req.ip,
  userAgent: req.headers["user-agent"],
});

const setRefreshCookie = (res: Response, token: string) => {
  res.cookie(REFRESH_COOKIE_NAME, token, refreshCookieOptions());
};

const clearRefreshCookie = (res: Response) => {
  res.clearCookie(REFRESH_COOKIE_NAME, { ...refreshCookieOptions(), maxAge: undefined });
};

export const signup = asyncHandler(async (req, res) => {
  const { user, accessToken, refreshToken } = await authService.signup(req.body, requestMeta(req));
  setRefreshCookie(res, refreshToken);
  res.status(201).json({ user, accessToken });
});

export const login = asyncHandler(async (req, res) => {
  const { user, accessToken, refreshToken } = await authService.login(req.body, requestMeta(req));
  setRefreshCookie(res, refreshToken);
  res.status(200).json({ user, accessToken });
});

export const refresh = asyncHandler(async (req, res) => {
  const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!rawToken) {
    throw AppError.unauthorized("No active session", "NO_REFRESH_TOKEN");
  }

  const { user, accessToken, refreshToken } = await authService.refreshSession(
    rawToken,
    requestMeta(req),
  );
  setRefreshCookie(res, refreshToken);
  res.status(200).json({ user, accessToken });
});

export const logout = asyncHandler(async (req, res) => {
  const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
  await authService.logout(rawToken);
  clearRefreshCookie(res);
  res.status(204).send();
});

export const forgotPassword = asyncHandler(async (req, res) => {
  await authService.requestPasswordReset(req.body.email);
  res.status(200).json({
    message: "If an account with that email exists, we've sent password reset instructions.",
  });
});

export const resetPassword = asyncHandler(async (req, res) => {
  await authService.resetPassword(req.body.token, req.body.password);
  res.status(200).json({ message: "Password reset successfully. You can now log in." });
});

export const me = asyncHandler(async (req, res) => {
  const user = await authService.getCurrentUser(req.user!.sub);
  res.status(200).json({ user });
});
