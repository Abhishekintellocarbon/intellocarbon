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
  // Straight to the functional flow (not the public /esg marketing hub) — a
  // logged-in user clicking this from inside the app wants their own numbers,
  // not a page about frameworks they're already a customer of. The unified
  // overview is the landing view; the per-framework pages (/esg/brsr,
  // /esg/issb) are drill-downs from its completeness cards.
  // activeFor keeps the tab lit on the drill-downs too, which sit under /esg
  // rather than under the overview's own path.
  { href: "/esg/overview", label: "ESG", activeFor: "/esg" },
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
      {/* px-4 below sm. At 390px the row has 342px of content width, and the
          lockup alone measured 268px against a 208px actions group — 476px
          into 342px, which is where the page-wide horizontal scroll came from.
          Nothing here could shrink: flex children default to min-width:auto
          and the row has no wrap. The four changes below (padding, logo size,
          clock, gap) each give width back rather than clipping the overflow,
          so the row genuinely fits instead of being hidden. */}
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center gap-8">
          {/* A responsive pair rather than one instance. size="lg" is shared
              with the public marketing header, where it is tuned against a
              36px hamburger; this header carries a notification bell and a
              log-out button instead, so the same lockup does not fit here at
              phone widths. Changing SIZE_STYLES.lg to suit this header would
              retune the marketing header too, so the breakpoint lives here.
              Both stay `dimensional`, so the mark and its gradient are the
              same on a phone as on a desktop — only the scale changes.

              Rendering both and hiding one is the pattern Logo is built for:
              it scopes its gradient and mask ids per instance with useId for
              exactly this case, so the display:none copy cannot win the
              url(#id) lookup and blank the visible mark. See logo.tsx. */}
          <Link href={(user && HOME_HREF[user.role]) || "/dashboard"} className="shrink-0">
            <Logo size="md" dimensional className="sm:hidden" />
            <Logo size="lg" dimensional className="hidden sm:flex" />
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
            {allNavLinks.map((link) => {
              const activePrefix = ("activeFor" in link && link.activeFor) || link.href;
              const active = pathname === activePrefix || pathname.startsWith(`${activePrefix}/`);
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
        <div className="flex items-center gap-2.5 sm:gap-4">
          {/* Hidden below sm, matching the breakpoint reference in
              marketing-header: "< 640px — Logo + hamburger. No clock." The
              clock is the one item here with no action attached to it, so it
              is the right thing to drop when the row is tightest; the bell and
              log-out both stay, at every width. */}
          <div className="hidden sm:block">
            <LiveClock />
          </div>
          {user?.role !== "VERIFIER" && user?.role !== "DATA_ENTRY_INTERNAL" && <NotificationBell />}
          <span className="hidden text-sm text-muted-foreground sm:inline">{user?.email}</span>
          {/* Icon-only below sm. The label is 58px of the actions group, and
              dropping it is what brings the row inside a 360px viewport —
              the door-out-of-a-box icon carries the meaning on its own at
              phone width. aria-label is unconditional so the button keeps its
              accessible name in the icon-only state; the visible text is
              redundant with it from sm up, which is why the label is a span
              rather than a second aria-label. */}
          <Button variant="secondary" size="sm" onClick={handleLogout} aria-label="Log out">
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Log out</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
