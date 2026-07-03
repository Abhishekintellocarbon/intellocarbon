"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/context/auth-context";
import { useInactivityLogout } from "@/hooks/use-inactivity-logout";

export function InactivityGuard({ children }: { children: React.ReactNode }) {
  const { logout } = useAuth();
  const router = useRouter();

  const handleLogout = useCallback(async () => {
    await logout();
    router.push("/login?reason=inactivity");
  }, [logout, router]);

  const { showWarning, resetTimer, logoutNow } = useInactivityLogout({ onLogout: handleLogout });

  return (
    <>
      {children}
      {showWarning && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
          <Card className="w-full max-w-sm rounded-2xl p-6">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warning/10">
                <AlertTriangle className="h-5 w-5 text-warning" />
              </span>
              <div>
                <h2 className="font-semibold text-foreground">Session about to expire</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  You will be automatically logged out in 5 minutes due to inactivity.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="secondary" size="sm" onClick={logoutNow}>
                Log out now
              </Button>
              <Button size="sm" onClick={resetTimer}>
                Stay logged in
              </Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
