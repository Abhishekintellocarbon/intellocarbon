"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/auth-context";

/**
 * "/" is the sign-up-focused landing page — its CTAs don't make sense for an
 * already-authenticated session, so it redirects to the user's dashboard
 * instead of rendering. Other marketing pages (/about, /faq, etc.) stay
 * browsable while logged in and don't use this gate.
 *
 * No server-side redirect is possible here: the refresh cookie is scoped to
 * the backend's /api/auth path, so frontend middleware can't read it (see
 * intellocarbon-tech-decisions memory). Blocking render until the client-side
 * auth check resolves is the closest approximation of a flash-free redirect.
 */
export function HomeRedirectGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    if (user?.approvalStatus !== "APPROVED") {
      router.replace("/pending-approval");
    } else if (user?.role === "VERIFIER") {
      router.replace("/verifier/dashboard");
    } else if (user?.role === "DATA_ENTRY_INTERNAL") {
      router.replace("/internal-data-entry");
    } else {
      router.replace("/dashboard");
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
