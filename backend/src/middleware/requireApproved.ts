import type { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/AppError";

/** Blocks product API access for accounts that haven't cleared admin approval yet. Run after requireAuth. */
export const requireApproved = (req: Request, _res: Response, next: NextFunction) => {
  if (req.user?.approvalStatus !== "APPROVED") {
    return next(
      AppError.forbidden(
        "Your account is pending admin approval. You'll get an email once it's reviewed.",
        "PENDING_APPROVAL",
      ),
    );
  }
  next();
};
