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

// Evidence files are stored as bytes in Postgres, not disk — repeated
// max-size (10MB) uploads directly balloon DB storage/cost/performance for
// the whole platform, not just the uploader's own company. Keyed by user
// (not IP) since the realistic abuse vector here is a single compromised or
// malicious account, not distributed traffic.
export const uploadRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.sub ?? req.ip ?? "unknown",
  message: { error: { message: "Too many uploads. Please try again later.", code: "RATE_LIMITED" } },
});

// Generous defense-in-depth cap applied globally in app.ts to every /api
// request. Legitimate usage (autosave on blur, dashboard polling) should
// never come close to this — it exists to blunt a compromised or malicious
// authenticated account hammering the API, not to shape normal traffic.
export const generalApiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.sub ?? req.ip ?? "unknown",
  message: { error: { message: "Too many requests. Please try again later.", code: "RATE_LIMITED" } },
});
