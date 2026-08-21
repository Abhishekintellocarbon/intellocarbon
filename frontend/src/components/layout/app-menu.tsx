"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AppMenuLink {
  href: string;
  label: string;
  /** Path prefix that should keep this link lit, when it differs from href. */
  activeFor?: string;
}

/**
 * The app header's menu — account at every width, navigation below xl.
 *
 * It exists because the header row genuinely ran out of width. Inside
 * max-w-6xl the row has 1104px to work with, and at desktop the logo, the
 * inline nav, the clock, the bell, the account email and the log-out button
 * came to 1229px. That is why every viewport from 640px to 1280px scrolled
 * sideways, and the arithmetic leaves no version of the old layout that fits:
 * with the nav inline, the email alone had an 82px budget and needed 207px.
 *
 * The account email moved in here because it had nowhere else to go — this
 * header is the only place the app shows which account you are signed into,
 * and it is far too wide to sit beside the nav. Log out deliberately did NOT
 * follow it: signing out should not be behind a menu, so it sits in the row
 * from sm up and is icon-only to pay for itself. Below sm the row is down to
 * the logo, the bell and this button, with no width left for a fourth — so
 * there, and only there, log out appears in this panel instead.
 *
 * Navigation collapses in here below xl and is inline above it, which is what
 * actually reclaims the 640-1280 range. The nav section is xl:hidden rather
 * than duplicated, so a wide viewport never offers the same link twice.
 *
 * Drawer mechanics are AdminMobileNav's, deliberately: overlay, slide-in from
 * the right, the same active-link treatment. Two in-app drawers that behaved
 * differently would be worse than one pattern used twice.
 *
 * It is portalled to document.body, which AdminMobileNav does not need to be.
 * The difference is that this menu lives inside <header>, and the header
 * carries backdrop-blur — a backdrop-filter establishes a containing block for
 * fixed-position descendants, so inset-y-0 resolves against the header's own
 * ~72px box instead of the viewport and the panel renders as a strip across
 * the top. AdminMobileNav sits below the header and never meets this.
 */
export function AppMenu({ links, email, onLogout }: { links: AppMenuLink[]; email?: string; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  // document.body does not exist during the server render, so the portal only
  // mounts on the client — the server and first client pass agree without it.
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const close = () => setOpen(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Route changes close it — navigation from inside the panel is client-side,
  // so without this the drawer would stay open over the page it just left.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Escape closes, matching what clicking the overlay already does.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label="Open menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-surface-border bg-surface-raised text-foreground transition-colors hover:text-teal-500"
      >
        <Menu className="h-4 w-4" />
      </button>

      {open &&
        mounted &&
        createPortal(
          <>
            <div className="fixed inset-0 z-40 animate-fade-in bg-black/60" onClick={close} aria-hidden="true" />
            <div className="fixed inset-y-0 right-0 z-50 flex w-[85%] max-w-sm animate-slide-in-right flex-col overflow-y-auto border-l border-surface-border bg-background p-6">
              <div className="flex items-center justify-between">
                <span className="text-xl font-bold text-foreground">Menu</span>
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={close}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-foreground transition-colors hover:text-teal-500"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* Hidden from xl up, where the same links are already in the row. */}
              <nav className="mt-6 flex flex-col gap-1 xl:hidden">
                {links.map((link) => {
                  const activePrefix = link.activeFor ?? link.href;
                  const active = pathname === activePrefix || pathname.startsWith(`${activePrefix}/`);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={close}
                      className={cn(
                        "rounded-lg border-l-2 px-3 py-3 text-sm font-medium transition-colors",
                        active
                          ? "border-teal-500 bg-teal-500/10 text-teal-500"
                          : "border-transparent text-muted-foreground hover:text-teal-500",
                      )}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </nav>

              {/* mt-auto so the account sits at the foot of the panel at every
                  width — including xl and up, where the nav above is hidden and
                  this is the only section left. */}
              <div className="mt-auto border-t border-surface-border pt-5">
                {email && (
                  <>
                    <p className="text-xs text-muted-foreground">Signed in as</p>
                    {/* break-all, not truncate: this is now the only place the
                        full address is shown, so it wraps rather than hiding
                        its own end behind an ellipsis. */}
                    <p className="mt-0.5 break-all text-sm text-foreground">{email}</p>
                  </>
                )}
                {/* sm:hidden — from sm up the header row carries log out itself,
                    and offering it twice would be two controls for one action. */}
                <button
                  type="button"
                  onClick={() => {
                    close();
                    onLogout();
                  }}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-surface-border bg-surface-raised px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:text-teal-500 sm:hidden"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Log out
                </button>
              </div>
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
