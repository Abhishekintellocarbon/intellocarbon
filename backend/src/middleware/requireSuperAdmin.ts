import type { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/AppError";
import { env } from "../config/env";

const superAdminEmails = env.SUPER_ADMIN_EMAILS.split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export const requireSuperAdmin = (req: Request, _res: Response, next: NextFunction) => {
  const email = req.user?.email?.toLowerCase();
  if (!email || !superAdminEmails.includes(email)) {
    return next(AppError.forbidden("You don't have access to this resource", "FORBIDDEN_ROLE"));
  }
  next();
};
