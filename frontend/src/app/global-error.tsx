"use client";

import * as Sentry from "@sentry/nextjs";
import NextError from "next/error";
import { useEffect } from "react";

// App Router only reports errors caught by nested error.tsx boundaries to
// Sentry automatically — a crash above the root layout needs this file to
// be captured at all. See instrumentation.ts's onRequestError for the
// server-side equivalent.
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
