"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ADMIN_NAV_SECTIONS, isAdminSectionActive } from "./admin-nav-sections";

export function AdminMobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const close = () => setOpen(false);

  const activeSection = ADMIN_NAV_SECTIONS.find((section) => isAdminSectionActive(section.href, pathname));

  return (
    <div className="border-b border-surface-border px-6 py-3 lg:hidden">
      <button
        type="button"
        aria-label="Open admin section menu"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-sm font-medium text-foreground transition-colors hover:text-teal-500"
      >
        <Menu className="h-5 w-5" />
        {activeSection?.label ?? "Admin menu"}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 animate-fade-in"
            onClick={close}
            aria-hidden="true"
          />
          <div className="fixed inset-y-0 right-0 z-50 flex w-[85%] max-w-sm animate-slide-in-right flex-col overflow-y-auto border-l border-surface-border bg-background p-6">
            <div className="flex items-center justify-between">
              <span className="text-xl font-bold text-foreground">Admin Panel</span>
              <button
                type="button"
                aria-label="Close menu"
                onClick={close}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-foreground transition-colors hover:text-teal-500"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <nav className="mt-6 flex flex-1 flex-col gap-1">
              {ADMIN_NAV_SECTIONS.map((section) => {
                const active = isAdminSectionActive(section.href, pathname);
                return (
                  <Link
                    key={section.href}
                    href={section.href}
                    onClick={close}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border-l-2 px-3 py-3 text-sm font-medium transition-colors",
                      active
                        ? "border-teal-500 bg-teal-500/10 text-teal-500"
                        : "border-transparent text-muted-foreground hover:text-teal-500",
                    )}
                  >
                    <section.icon className="h-4 w-4 shrink-0" />
                    {section.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </>
      )}
    </div>
  );
}
