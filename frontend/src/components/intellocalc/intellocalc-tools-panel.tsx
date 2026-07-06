"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Globe2, MapPinned, ListChecks, Calculator, X } from "lucide-react";

// Matches the id on the homepage-only inline "Try IntelloCalc" card
// (components/marketing/intellocalc-floating-cta.tsx) — the mobile FAB below hides
// while that card is in view so the two floating CTAs never visually stack.
// Harmless no-op on every other page, which doesn't render that id.
const MOBILE_CTA_CARD_ID = "mobile-intellocalc-cta";

const TOOLS = [
  {
    href: "/intellocalc/border",
    icon: Globe2,
    name: "IntelloCalc Border",
    blurb: "Check CBAM exposure",
  },
  {
    href: "/intellocalc/india",
    icon: MapPinned,
    name: "IntelloCalc India",
    blurb: "Check CCTS intensity",
  },
  {
    href: "/intellocalc/comply",
    icon: ListChecks,
    name: "IntelloCalc Comply",
    blurb: "Am I compliant?",
  },
];

/**
 * Site-wide "Free Tools" access point for the three IntelloCalc calculators —
 * replaces the old top-nav dropdown. Desktop gets a permanent fixed sidebar;
 * below 1024px that's replaced by a floating button + bottom sheet, since a
 * fixed sidebar has no room to breathe next to real content on small screens.
 */
export function IntelloCalcToolsPanel() {
  const [open, setOpen] = useState(false);
  const [hideFab, setHideFab] = useState(false);

  useEffect(() => {
    const target = document.getElementById(MOBILE_CTA_CARD_ID);
    if (!target) return;
    const observer = new IntersectionObserver(([entry]) => setHideFab(entry.isIntersecting));
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      {/* Desktop — permanent fixed right sidebar */}
      <div className="fixed right-4 top-[40%] z-40 hidden w-[212px] -translate-y-1/2 lg:block">
        <div className="rounded-[12px] border border-surface-border bg-surface p-4 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#8AA0B4]">Free Tools</p>
          <div className="mt-3 flex flex-col gap-2">
            {TOOLS.map((tool) => (
              <Link
                key={tool.href}
                href={tool.href}
                className="group flex items-start gap-2.5 rounded-[12px] border-l-2 border-teal-500 bg-[#162230] px-3 py-2.5 transition-all duration-300 hover:shadow-glow"
              >
                <tool.icon className="mt-0.5 h-4 w-4 shrink-0 text-teal-500" />
                <span>
                  <span className="block text-xs font-semibold text-foreground">{tool.name}</span>
                  <span className="block text-[11px] text-muted-foreground">{tool.blurb}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile / tablet — floating button + bottom sheet */}
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-[#00D4AA] px-5 py-3 text-sm font-bold text-[#0F1923] shadow-glow transition-all duration-300 hover:scale-105 ${
            hideFab ? "pointer-events-none translate-y-4 opacity-0" : "opacity-100"
          }`}
        >
          <Calculator className="h-4 w-4" />
          Free Tools
        </button>

        {open && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/60 animate-fade-in"
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />
            <div className="fixed inset-x-0 bottom-0 z-50 animate-fade-in rounded-t-[12px] border-t border-surface-border bg-background p-6">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold uppercase tracking-wide text-[#8AA0B4]">Free Tools</span>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => setOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-[#E8F0F7] transition-colors hover:text-teal-500"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-4 flex flex-col gap-2 pb-2">
                {TOOLS.map((tool) => (
                  <Link
                    key={tool.href}
                    href={tool.href}
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-2.5 rounded-[12px] border-l-2 border-teal-500 bg-[#162230] px-4 py-3"
                  >
                    <tool.icon className="mt-0.5 h-4 w-4 shrink-0 text-teal-500" />
                    <span>
                      <span className="block text-sm font-semibold text-foreground">{tool.name}</span>
                      <span className="block text-xs text-muted-foreground">{tool.blurb}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
