"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut, ShieldX, TimerReset } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";

export function PendingApprovalContent() {
  const { isAuthenticated, isLoading, user, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace("/login");
    } else if (user?.approvalStatus === "APPROVED") {
      router.replace(user.role === "VERIFIER" ? "/verifier/dashboard" : "/dashboard");
    }
  }, [isLoading, isAuthenticated, user, router]);

  if (isLoading || !isAuthenticated || user?.approvalStatus === "APPROVED") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
      </div>
    );
  }

  const rejected = user?.approvalStatus === "REJECTED";

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-md rounded-2xl border border-surface-border bg-surface p-8 text-center animate-fade-in">
        <span
          className={
            rejected
              ? "mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10"
              : "mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-teal-500/30 bg-teal-500/10"
          }
        >
          {rejected ? (
            <ShieldX className="h-5 w-5 text-red-400" />
          ) : (
            <TimerReset className="h-5 w-5 text-teal-500" />
          )}
        </span>

        <h1 className="mt-5 text-xl font-semibold text-foreground">
          {rejected ? "Application not approved" : "Your account is under review"}
        </h1>

        <p className="mt-2 text-sm text-muted-foreground">
          {rejected
            ? "After review, we weren't able to approve this account. If you believe this is a mistake, reach out and we'll take another look."
            : "Thanks for signing up. Our team reviews every new account before granting access — you'll get an email within 24 hours once yours is approved."}
        </p>

        {user?.name && (
          <p className="mt-4 text-xs text-muted">
            Signed in as <span className="text-muted-foreground">{user.email}</span>
          </p>
        )}

        <p className="mt-6 text-xs text-muted">
          Questions? Write to{" "}
          <a href="mailto:abhishek@intellocarbon.com" className="text-teal-500 hover:text-teal-400">
            abhishek@intellocarbon.com
          </a>
        </p>

        <Button variant="secondary" className="mt-6 w-full" onClick={handleLogout}>
          <LogOut className="h-3.5 w-3.5" />
          Log out
        </Button>
      </div>
    </div>
  );
}
