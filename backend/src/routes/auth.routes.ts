import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import { validate } from "../middleware/validate";
import { requireAuth } from "../middleware/requireAuth";
import { authRateLimiter, passwordResetRateLimiter } from "../middleware/rateLimiters";
import {
  deleteAccountSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
} from "../validators/auth.validators";

const router = Router();

router.post("/signup", authRateLimiter, validate(signupSchema), authController.signup);
router.post("/login", authRateLimiter, validate(loginSchema), authController.login);
router.post("/refresh", authController.refresh);
router.post("/logout", authController.logout);
router.post(
  "/forgot-password",
  passwordResetRateLimiter,
  validate(forgotPasswordSchema),
  authController.forgotPassword,
);
router.post(
  "/reset-password",
  passwordResetRateLimiter,
  validate(resetPasswordSchema),
  authController.resetPassword,
);
router.get("/me", requireAuth, authController.me);
router.delete(
  "/account",
  requireAuth,
  authRateLimiter,
  validate(deleteAccountSchema),
  authController.deleteAccount,
);

export default router;
