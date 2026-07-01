"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";

/** Redirects already-authenticated users away from login/signup toward the dashboard. */
export function GuestRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace(user?.role === "VERIFIER" ? "/verifier/dashboard" : "/dashboard");
    }
  }, [isLoading, isAuthenticated, user, router]);

  return <>{children}</>;
}
