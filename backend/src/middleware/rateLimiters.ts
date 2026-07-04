import rateLimit from "express-rate-limit";

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: "Too many attempts. Please try again later.", code: "RATE_LIMITED" } },
});

export const passwordResetRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: { message: "Too many password reset requests. Please try again later.", code: "RATE_LIMITED" },
  },
});

export const leadCaptureRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: "Too many requests. Please try again later.", code: "RATE_LIMITED" } },
});
