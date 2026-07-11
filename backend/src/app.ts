import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import * as Sentry from "@sentry/node";
import { isProd } from "./config/env";
import { isOriginAllowed } from "./config/cors";
import routes from "./routes";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

const app = express();

app.set("trust proxy", 1);

app.use(
  helmet({
    // helmet's defaults are SAMEORIGIN / 180-day HSTS — this is a pure JSON
    // API with no page content to frame or embed, so tighten both. CSP's
    // default-src 'none' is inert for JSON/binary responses (there's no HTML
    // document context to apply it to) but costs nothing to set correctly.
    frameguard: { action: "deny" },
    hsts: { maxAge: 31536000, includeSubDomains: true },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
  }),
);
app.use(
  cors({
    origin: (origin, callback) => {
      // No Origin header — same-origin requests, curl, server-to-server calls.
      if (!origin || isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin not allowed by CORS: ${origin}`));
      }
    },
    credentials: true,
    // Without this, fetch()'s Response.headers can't see Content-Disposition
    // cross-origin (browsers only expose a small safelist by default) — the
    // DPA/NDA generator downloads parse it client-side to name the saved file.
    exposedHeaders: ["Content-Disposition"],
  }),
);
app.use(
  express.json({
    limit: "1mb",
    // Preserve the raw body so the Razorpay webhook handler can verify its HMAC signature.
    verify: (req, _res, buf) => {
      (req as express.Request).rawBody = buf.toString("utf8");
    },
  }),
);
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan(isProd ? "combined" : "dev"));

app.use("/api", routes);

app.use(notFoundHandler);

// Sentry v8+ dropped the old Handlers.requestHandler()/tracingHandler()
// middleware — request/trace capture is now automatic from Sentry.init()
// having run (in instrument.ts) before Express was even created. All that's
// left to wire up explicitly is error capture: setupExpressErrorHandler
// must sit after every route/notFoundHandler (so it sees the real error)
// but before our own errorHandler (which sends the response) — Sentry's
// handler only records the event and calls next(err), it never responds
// itself, so it can't be the last middleware or the request would hang.
// It only reports errors with status >= 500 by default, so expected 4xx
// AppErrors (validation, 404s, auth) aren't sent as Sentry events.
Sentry.setupExpressErrorHandler(app);

app.use(errorHandler);

export default app;
