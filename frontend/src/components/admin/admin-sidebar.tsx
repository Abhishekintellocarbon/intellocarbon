"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ADMIN_NAV_SECTIONS, isAdminSectionActive } from "./admin-nav-sections";

const COLLAPSE_STORAGE_KEY = "intellocarbon:admin-sidebar-collapsed";

export function AdminSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1");
    setHydrated(true);
  }, []);

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  };

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-surface-border bg-surface lg:flex",
        hydrated ? "transition-[width] duration-200" : null,
        collapsed ? "w-[68px]" : "w-60",
      )}
    >
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {ADMIN_NAV_SECTIONS.map((section) => {
          const active = isAdminSectionActive(section.href, pathname);
          return (
            <Link
              key={section.href}
              href={section.href}
              title={collapsed ? section.label : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg border-l-2 px-3 py-2.5 text-sm font-medium transition-colors",
                collapsed && "justify-center px-0",
                active
                  ? "border-teal-500 bg-teal-500/10 text-teal-500"
                  : "border-transparent text-muted-foreground hover:bg-surface-raised hover:text-foreground",
              )}
            >
              <section.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate">{section.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-surface-border p-3">
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground",
            collapsed && "justify-center px-0",
          )}
        >
          {collapsed ? <ChevronsRight className="h-4 w-4 shrink-0" /> : <ChevronsLeft className="h-4 w-4 shrink-0" />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
