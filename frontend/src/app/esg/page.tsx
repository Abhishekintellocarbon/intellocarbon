import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Check, Clock, Droplets, FileBarChart, Globe2, Landmark, Leaf, Network, ScrollText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MarketingHeader } from "@/components/intellocalc/marketing-header";
import { ToolFooter } from "@/components/intellocalc/tool-footer";
import { NotifyMeCapture } from "@/components/esg/notify-me-capture";
import type { EsgWaitlistFramework } from "@/lib/api";

export const metadata: Metadata = {
  title: "ESG Disclosure Bundle — BRSR Core, ISSB, Scope 3, GRI, CSRD, CDP | Intellocarbon",
  description:
    "One subscription for BRSR Core, ISSB IFRS S1/S2, and Scope 3 emissions — live today. GRI, CSRD, and CDP are in active development.",
};

interface BundleItem {
  icon: React.ComponentType<{ className?: string }>;
  name: string;
  status: "live" | "soon";
  waitlistTool?: EsgWaitlistFramework;
}

// No price figure on this page — pricing lives on /billing, which is behind
// auth by design: logged-out visitors don't see figures anywhere on this site.
// Do not reintroduce a hardcoded price label here.

const BUNDLE_ITEMS: BundleItem[] = [
  { icon: FileBarChart, name: "BRSR Core", status: "live" },
  { icon: BadgeCheck, name: "ISSB IFRS S1/S2", status: "live" },
  { icon: Network, name: "Scope 3 Value Chain", status: "live" },
  { icon: Droplets, name: "Water Footprint (ISO 14046)", status: "live" },
  { icon: Leaf, name: "Voluntary Offsets Tracking", status: "live" },
  { icon: Globe2, name: "GRI", status: "soon", waitlistTool: "ESG_GRI" },
  { icon: Landmark, name: "CSRD", status: "soon", waitlistTool: "ESG_CSRD" },
  { icon: ScrollText, name: "CDP", status: "soon", waitlistTool: "ESG_CDP" },
];

interface MarketRow {
  market: string;
  framework: string;
  status: "live" | "soon";
}

// Illustrative, not exhaustive — the goal is orienting a company to "which
// framework does my market actually require," not a complete legal survey.
const MARKET_ROWS: MarketRow[] = [
  { market: "India", framework: "BRSR Core (SEBI)", status: "live" },
  { market: "Global investors / IFRS jurisdictions", framework: "ISSB IFRS S1/S2", status: "live" },
  { market: "European Union", framework: "CSRD", status: "soon" },
  { market: "United States (SEC / state climate rules)", framework: "Climate disclosure rules", status: "soon" },
  { market: "Global supply chains (buyer-driven)", framework: "CDP", status: "soon" },
];

function StatusChip({ status }: { status: "live" | "soon" }) {
  return status === "live" ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-teal-500/30 bg-teal-500/10 px-2.5 py-1 text-[11px] font-semibold text-teal-500">
      <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
      Live
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full border border-surface-border bg-surface-raised px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
      <Clock className="h-3 w-3" />
      Coming Soon
    </span>
  );
}

export default function EsgHub() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background lg:pr-[240px]">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-gradient-radial-glow" />

      <MarketingHeader />

      <main className="relative z-10 mx-auto max-w-5xl px-6 pb-24 pt-10 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-surface-border bg-surface px-3.5 py-1.5 text-xs font-medium text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
          One subscription. Every ESG framework.
        </span>

        <h1 className="mt-6 text-[36px] font-semibold leading-tight text-balance sm:text-[48px]">
          <span className="text-gradient">ESG</span> reporting on Intellocarbon
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-balance text-muted-foreground sm:text-lg">
          BRSR Core, ISSB IFRS S1/S2, and Scope 3 emissions are live today, in one bundled subscription. GRI, CSRD,
          and CDP are in active development.
        </p>

        {/* Unified ESG Disclosure Bundle */}
        <Card className="mx-auto mt-14 max-w-2xl p-8 text-left">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xl font-semibold">ESG Disclosure Bundle</h2>
            <Link href="/billing" className="text-sm font-semibold text-teal-500 hover:underline">
              See pricing
            </Link>
          </div>

          <p className="mt-3 text-sm text-muted-foreground">
            Priced above CBAM and CCTS because it covers more ground: Scope 3 value-chain emissions on top of Scope
            1/2, several disclosure frameworks rather than one, and a single data entry that feeds all of them — no
            re-entering the same activity data per framework.
          </p>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {BUNDLE_ITEMS.map((item) => (
              <div
                key={item.name}
                className="flex items-center justify-between gap-3 rounded-xl border border-surface-border bg-surface-raised/60 px-4 py-3"
              >
                <div className="flex items-center gap-2.5">
                  <item.icon className="h-4 w-4 shrink-0 text-teal-500" />
                  <span className="text-sm font-medium">{item.name}</span>
                </div>
                <StatusChip status={item.status} />
              </div>
            ))}
          </div>

          <Link href="/signup" className="mt-7 block">
            <Button size="lg" className="w-full">
              Get Started
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <p className="mt-2.5 text-center text-xs text-muted-foreground">
            Create an account or{" "}
            <Link href="/login" className="font-medium text-teal-500 hover:underline">
              log in
            </Link>{" "}
            to see pricing and start with BRSR Core — ISSB IFRS S1/S2 and Scope 3 are available from the same facility
            dashboard.
          </p>

          <div className="mt-8 border-t border-surface-border pt-6">
            <p className="text-sm font-medium">Want GRI, CSRD, or CDP first?</p>
            <p className="mt-1 text-xs text-muted-foreground">Join the waitlist for whichever one you need.</p>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {BUNDLE_ITEMS.filter((i) => i.waitlistTool).map((item) => (
                <div key={item.name}>
                  <p className="text-xs font-semibold text-muted-foreground">{item.name}</p>
                  <NotifyMeCapture framework={item.waitlistTool!} />
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Lightweight global mandate comparison */}
        <div className="mx-auto mt-16 max-w-2xl text-left">
          <h2 className="text-center text-lg font-semibold">Which framework does your market actually require?</h2>
          <p className="mt-1.5 text-center text-sm text-muted-foreground">
            A quick orientation, not a complete legal survey — check with counsel for your specific obligations.
          </p>
          <div className="mt-6 space-y-2.5">
            {MARKET_ROWS.map((row) => (
              <div
                key={row.market}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-surface-border bg-surface px-4 py-3"
              >
                <span className="text-sm font-medium">{row.market}</span>
                <div className="flex items-center gap-2.5">
                  <span className="text-sm text-muted-foreground">{row.framework}</span>
                  <StatusChip status={row.status} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <Card className="mx-auto mt-16 max-w-xl p-8">
          <h2 className="text-lg font-semibold">Already tracking CBAM or CCTS with us?</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            The ESG Disclosure Bundle reuses the same activity data you&apos;ve already submitted — no double entry.
          </p>
          <Link href="/esg/brsr" className="mt-5 inline-block">
            <Button>
              <Check className="h-4 w-4" />
              Start your ESG disclosure
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </Card>
      </main>

      <div className="relative z-10">
        <ToolFooter />
      </div>
    </div>
  );
}
