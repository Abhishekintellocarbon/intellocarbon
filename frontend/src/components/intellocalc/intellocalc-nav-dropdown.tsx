"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Globe2, MapPinned, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";

const TOOLS = [
  {
    href: "/intellocalc/border",
    icon: Globe2,
    name: "IntelloCalc Border",
    description: "CBAM Exposure Estimator",
  },
  {
    href: "/intellocalc/india",
    icon: MapPinned,
    name: "IntelloCalc India",
    description: "CCTS Intensity Checker",
  },
  {
    href: "/intellocalc/comply",
    icon: ListChecks,
    name: "IntelloCalc Comply",
    description: "Compliance Eligibility Checker",
  },
];

export function IntelloCalcNavDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex items-center gap-1 rounded-[6px] border border-teal-500 bg-teal-500/15 px-[10px] py-1 text-sm font-semibold text-teal-500 shadow-[0_0_8px_rgba(0,212,170,0.4)] transition-colors",
          open && "bg-teal-500/25",
        )}
      >
        IntelloCalc
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl border border-surface-border bg-surface p-2 shadow-card animate-fade-in sm:left-1/2 sm:right-auto sm:w-80 sm:-translate-x-1/2">
          {TOOLS.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              onClick={() => setOpen(false)}
              className="flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-surface-raised"
            >
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-surface-border bg-surface-raised">
                <tool.icon className="h-4 w-4 text-teal-500" />
              </span>
              <span>
                <span className="block text-sm font-medium text-foreground">{tool.name}</span>
                <span className="block text-xs text-muted-foreground">{tool.description}</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
