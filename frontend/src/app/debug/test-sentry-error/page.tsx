"use client";

// Temporary manual Sentry verification page — intentionally throws a client-side
// error on click so it flows through Sentry's browser SDK once
// NEXT_PUBLIC_SENTRY_DSN_FRONTEND is set. Visit /debug/test-sentry-error and
// click the button. Remove only once Sentry event delivery has been confirmed.
export default function TestSentryErrorPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <h1 className="text-xl font-semibold text-foreground">Sentry frontend test</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Clicking the button below throws an intentional client-side error, which Sentry&apos;s browser SDK should
        capture once NEXT_PUBLIC_SENTRY_DSN_FRONTEND is set.
      </p>
      <button
        type="button"
        className="rounded-lg bg-teal-500 px-5 py-2 text-sm font-semibold text-[#0F1923] hover:brightness-105"
        onClick={() => {
          throw new Error("Sentry frontend test error — intentionally thrown from /debug/test-sentry-error");
        }}
      >
        Trigger test error
      </button>
    </div>
  );
}
