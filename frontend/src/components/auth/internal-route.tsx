"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { InactivityGuard } from "./inactivity-guard";

/** Like ProtectedRoute, but only admits users with the DATA_ENTRY_INTERNAL role. */
export function InternalRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace("/login");
    } else if (user?.approvalStatus !== "APPROVED") {
      router.replace("/pending-approval");
    } else if (user?.role !== "DATA_ENTRY_INTERNAL") {
      router.replace(user?.role === "VERIFIER" ? "/verifier/dashboard" : "/dashboard");
    }
  }, [isLoading, isAuthenticated, user, router]);

  if (isLoading || !isAuthenticated || user?.approvalStatus !== "APPROVED" || user?.role !== "DATA_ENTRY_INTERNAL") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
      </div>
    );
  }

  return <InactivityGuard>{children}</InactivityGuard>;
}
