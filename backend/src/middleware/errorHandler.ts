import type { NextFunction, Request, Response } from "express";
import * as Sentry from "@sentry/node";
import { AppError } from "../utils/AppError";
import { logger } from "../utils/logger";
import { isProd } from "../config/env";

export const notFoundHandler = (req: Request, _res: Response, next: NextFunction) => {
  next(AppError.notFound(`Route ${req.method} ${req.originalUrl} not found`, "ROUTE_NOT_FOUND"));
};

export const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: { message: err.message, code: err.code },
    });
  }

  logger.error("Unhandled error", err instanceof Error ? err.stack : err);

  // Sentry.setupExpressErrorHandler (app.ts) already captured this exception
  // upstream — lastEventId() reads that event id back rather than capturing
  // a second time, so support can look up exactly what happened without the
  // client ever seeing a stack trace, query, or file path.
  const eventId = Sentry.lastEventId();

  return res.status(500).json({
    error: {
      message: isProd ? "Something went wrong" : String(err instanceof Error ? err.message : err),
      code: "INTERNAL_SERVER_ERROR",
      eventId: eventId || undefined,
    },
  });
};
