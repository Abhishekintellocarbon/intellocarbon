"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/companies", label: "Companies" },
  { href: "/admin/revenue", label: "Revenue" },
  { href: "/admin/leads", label: "Leads" },
  { href: "/admin/approvals", label: "Pending Approvals" },
  { href: "/admin/internal-operators", label: "Internal Operators" },
  { href: "/admin/emission-factors", label: "Emission Factors" },
  { href: "/admin/ghg-runner", label: "GHG Runner" },
];

export function AdminTabs() {
  const pathname = usePathname();

  return (
    <div className="flex gap-1 rounded-xl border border-surface-border bg-surface p-1">
      {TABS.map((tab) => {
        // "/admin" would prefix-match every other tab's route too, so it only
        // counts as active on an exact match — the rest still match sub-routes
        // (e.g. /admin/companies/[id] keeps "Companies" highlighted).
        const active = tab.href === "/admin" ? pathname === "/admin" : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
              active ? "bg-surface-raised text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
