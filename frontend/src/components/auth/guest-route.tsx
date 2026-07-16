"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/auth-context";

/**
 * Redirects already-authenticated users away from login/signup toward the
 * dashboard. AuthProvider silently checks for a restorable session (via the
 * httpOnly refresh cookie) on every mount, including this page — rendering
 * the form immediately would let the browser autofill it and then yank the
 * page away the instant that check resolves, which looks identical to the
 * form having auto-submitted. So the form stays hidden behind a loading
 * state until we know for sure the visitor is actually a guest.
 */
export function GuestRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    if (user?.approvalStatus !== "APPROVED") {
      router.replace("/pending-approval");
    } else {
      router.replace(user?.role === "VERIFIER" ? "/verifier/dashboard" : "/dashboard");
    }
  }, [isLoading, isAuthenticated, user, router]);

  if (isLoading || isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
      </div>
    );
  }

  return <>{children}</>;
}
