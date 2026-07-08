"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { LiveClock } from "@/components/layout/live-clock";
import { NotificationBell } from "@/components/layout/notification-bell";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";

const COMPANY_NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/facilities", label: "Facilities" },
  // Straight to the functional flow (not the public /esg marketing hub) —
  // a logged-in user clicking this from inside the app wants to use BRSR
  // Core, not read about frameworks they're already a customer of.
  { href: "/esg/brsr", label: "ESG" },
  { href: "/billing", label: "Billing" },
  { href: "/company/settings", label: "Company" },
];

const VERIFIER_NAV_LINKS = [{ href: "/verifier/dashboard", label: "Verifier dashboard" }];

const INTERNAL_NAV_LINKS = [{ href: "/internal-data-entry", label: "My Assigned Facilities" }];

const HOME_HREF: Record<string, string> = {
  VERIFIER: "/verifier/dashboard",
  DATA_ENTRY_INTERNAL: "/internal-data-entry",
};

export function AppHeader() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const navLinks =
    user?.role === "VERIFIER" ? VERIFIER_NAV_LINKS : user?.role === "DATA_ENTRY_INTERNAL" ? INTERNAL_NAV_LINKS : COMPANY_NAV_LINKS;
  // Internal operators never see the Admin Panel link even if their email
  // happens to be on the super admin allowlist — that combination isn't a
  // supported account shape, but nav visibility shouldn't assume it can't happen.
  const allNavLinks =
    user?.isSuperAdmin && user.role !== "DATA_ENTRY_INTERNAL" ? [...navLinks, { href: "/admin", label: "Admin Panel" }] : navLinks;

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <header className="border-b border-surface-border bg-surface/60 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-8">
          <Link href={(user && HOME_HREF[user.role]) || "/dashboard"}>
            <Logo />
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
            {allNavLinks.map((link) => {
              const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-surface-raised text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <LiveClock />
          {user?.role !== "VERIFIER" && user?.role !== "DATA_ENTRY_INTERNAL" && <NotificationBell />}
          <span className="hidden text-sm text-muted-foreground sm:inline">{user?.email}</span>
          <Button variant="secondary" size="sm" onClick={handleLogout}>
            <LogOut className="h-3.5 w-3.5" />
            Log out
          </Button>
        </div>
      </div>
    </header>
  );
}
