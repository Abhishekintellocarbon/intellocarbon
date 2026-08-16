"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check, Loader2, Mail } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { API_URL } from "@/lib/config";

/**
 * Unsubscribe confirmation.
 *
 * The page does NOT unsubscribe on load. Mail clients and corporate security
 * gateways prefetch every link in an email to scan it, so a page that
 * suppressed the address as a side effect of rendering would unsubscribe
 * people who never clicked anything. The actual suppression happens on a POST
 * behind a real button press — which is also what RFC 8058's
 * List-Unsubscribe-Post header targets for native one-click controls.
 */

function UnsubscribeContent() {
  const params = useSearchParams();
  const email = params.get("email") ?? "";
  const token = params.get("token") ?? "";

  const [state, setState] = useState<"idle" | "submitting" | "done" | "error">("idle");

  const linkIncomplete = !email || !token;

  const handleUnsubscribe = async () => {
    setState("submitting");
    try {
      const res = await fetch(`${API_URL}/api/leads/unsubscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token }),
      });
      // The endpoint reports success even for a bad token, so as not to leak
      // which addresses are on the list. Anything non-2xx here is a genuine
      // transport or validation failure.
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-lg items-center px-6 py-16">
      <Card className="w-full p-8">
        <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-surface-border bg-surface-raised">
          {state === "done" ? (
            <Check className="h-5 w-5 text-teal-500" />
          ) : (
            <Mail className="h-5 w-5 text-teal-500" />
          )}
        </span>

        {state === "done" ? (
          <>
            <h1 className="mt-5 text-xl font-semibold">You&apos;re unsubscribed</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {email} will not receive further product announcements from Intellocarbon.
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              This does not affect account emails — password resets, verification decisions and billing notices
              still send, because those are things you asked for at the moment you asked for them.
            </p>
          </>
        ) : (
          <>
            <h1 className="mt-5 text-xl font-semibold">Unsubscribe from announcements</h1>

            {linkIncomplete ? (
              <p className="mt-2 text-sm text-muted-foreground">
                This unsubscribe link is incomplete. Open it directly from the email you received, or reply to that
                email and we&apos;ll remove you manually.
              </p>
            ) : (
              <>
                <p className="mt-2 text-sm text-muted-foreground">
                  Stop sending product announcements to{" "}
                  <span className="font-medium text-foreground">{email}</span>?
                </p>
                <p className="mt-3 text-xs text-muted-foreground">
                  Account emails — password resets, verification decisions, billing notices — are unaffected.
                </p>

                {state === "error" && (
                  <div className="mt-4">
                    <Alert variant="error">
                      Something went wrong. Please try again, or reply to the email you received.
                    </Alert>
                  </div>
                )}

                <Button
                  type="button"
                  className="mt-6 w-full"
                  onClick={handleUnsubscribe}
                  isLoading={state === "submitting"}
                >
                  Unsubscribe
                </Button>
              </>
            )}
          </>
        )}

        <Link
          href="/"
          className="mt-6 inline-block text-sm font-medium text-teal-500 hover:text-teal-400"
        >
          Back to intellocarbon.com
        </Link>
      </Card>
    </main>
  );
}

export default function UnsubscribePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* useSearchParams needs a Suspense boundary to keep this route
          statically renderable rather than forcing it dynamic. */}
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
          </div>
        }
      >
        <UnsubscribeContent />
      </Suspense>
    </div>
  );
}
