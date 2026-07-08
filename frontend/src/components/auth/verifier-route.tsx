"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { InactivityGuard } from "./inactivity-guard";

/** Like ProtectedRoute, but only admits users with the VERIFIER role. */
export function VerifierRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace("/login");
    } else if (user?.approvalStatus !== "APPROVED") {
      router.replace("/pending-approval");
    } else if (user?.role !== "VERIFIER") {
      router.replace(user?.role === "DATA_ENTRY_INTERNAL" ? "/internal-data-entry" : "/dashboard");
    }
  }, [isLoading, isAuthenticated, user, router]);

  if (isLoading || !isAuthenticated || user?.approvalStatus !== "APPROVED" || user?.role !== "VERIFIER") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
      </div>
    );
  }

  return <InactivityGuard>{children}</InactivityGuard>;
}
