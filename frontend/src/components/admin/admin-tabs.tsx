"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin/leads", label: "IntelloCalc Leads" },
  { href: "/admin/approvals", label: "Pending Approvals" },
];

export function AdminTabs() {
  const pathname = usePathname();

  return (
    <div className="flex gap-1 rounded-xl border border-surface-border bg-surface p-1">
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
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
