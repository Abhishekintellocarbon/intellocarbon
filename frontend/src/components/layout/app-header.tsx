"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "@/components/ui/logo";
import { LiveClock } from "@/components/layout/live-clock";
import { AppMenu } from "@/components/layout/app-menu";
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
            <Logo
              size="md"
              dimensional
              /* Below 360px the wordmark goes too and the mark stands alone: at 320
                 the row was still 22px over, and the wordmark is 186 of the 228 the
                 lockup takes. Same arbitrary-variant idiom SIZE_STYLES already uses
                 to resize the mark responsively — see markResponsive3d in logo.tsx. */
              className="sm:hidden max-[359px]:[&>span]:hidden"
            />
            <Logo size="lg" dimensional className="hidden sm:flex" />
          </Link>
          {/* xl and up only. Below that the same links live in AppMenu — see the
              width arithmetic in that file for why this cannot be sm. */}
          <nav className="hidden items-center gap-1 xl:flex">
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
          {/* md and up. marketing-header's reference drops the clock below sm;
              this header carries a menu button the marketing one does not, so
              it needs the width back one breakpoint earlier. The clock is
              still the right thing to drop first — it is the only item here
              with no action attached to it. */}
          <div className="hidden md:block">
            <LiveClock />
          </div>
          {user?.role !== "VERIFIER" && user?.role !== "DATA_ENTRY_INTERNAL" && <NotificationBell />}
          {/* The account email and the log-out button used to sit inline here.
              Both moved into AppMenu because the row could not hold them: with
              the nav inline the email had an 82px budget against a 207px need,
              which is what made every width from 640px to 1280px scroll. */}
          <AppMenu links={allNavLinks} email={user?.email} onLogout={handleLogout} />
        </div>
      </div>
    </header>
  );
}
