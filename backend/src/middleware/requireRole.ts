import type { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/AppError";

export const requireRole =
  (...roles: string[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(AppError.forbidden("You don't have access to this resource", "FORBIDDEN_ROLE"));
    }
    next();
  };
