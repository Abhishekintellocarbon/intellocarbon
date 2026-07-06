import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Clock, FileBarChart, Globe2, Landmark, ScrollText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MarketingHeader } from "@/components/intellocalc/marketing-header";
import { ToolFooter } from "@/components/intellocalc/tool-footer";
import { NotifyMeCapture } from "@/components/esg/notify-me-capture";
import type { EsgWaitlistFramework } from "@/lib/api";

export const metadata: Metadata = {
  title: "ESG Reporting — BRSR Core, GRI, ISSB, CSRD, CDP | Intellocarbon",
  description:
    "ESG and sustainability reporting frameworks on Intellocarbon: BRSR Core is live today. GRI, ISSB IFRS S1/S2, CSRD, and CDP are in active development.",
};

interface FrameworkCard {
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  name: string;
  status: "live" | "soon";
  description: string;
  waitlistTool?: EsgWaitlistFramework;
}

const FRAMEWORKS: FrameworkCard[] = [
  {
    href: "/esg/brsr",
    icon: FileBarChart,
    name: "BRSR Core",
    status: "live",
    description:
      "SEBI's mandatory Core ESG attributes for India's top listed companies and their value chains — GHG reused automatically from your existing activity data.",
  },
  {
    icon: Globe2,
    name: "GRI",
    status: "soon",
    description:
      "The world's most widely used voluntary sustainability standard, impact materiality.",
    waitlistTool: "ESG_GRI",
  },
  {
    icon: BadgeCheck,
    name: "ISSB IFRS S1/S2",
    status: "soon",
    description:
      "The emerging global investor-facing standard, absorbed TCFD's climate disclosure structure.",
    waitlistTool: "ESG_ISSB",
  },
  {
    icon: Landmark,
    name: "CSRD",
    status: "soon",
    description: "EU's mandatory framework for large EU entities, double materiality.",
    waitlistTool: "ESG_CSRD",
  },
  {
    icon: ScrollText,
    name: "CDP",
    status: "soon",
    description: "Buyer-driven climate disclosure scoring used by multinational supply chains.",
    waitlistTool: "ESG_CDP",
  },
];

export default function EsgHub() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background lg:pr-[240px]">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-gradient-radial-glow" />

      <MarketingHeader />

      <main className="relative z-10 mx-auto max-w-5xl px-6 pb-24 pt-10 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-surface-border bg-surface px-3.5 py-1.5 text-xs font-medium text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
          One data entry. Every ESG framework.
        </span>

        <h1 className="mt-6 text-[36px] font-semibold leading-tight text-balance sm:text-[48px]">
          <span className="text-gradient">ESG</span> reporting on Intellocarbon
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-balance text-muted-foreground sm:text-lg">
          BRSR Core is live today. GRI, ISSB, CSRD, and CDP are in active development — join the waitlist to
          be notified.
        </p>

        <div className="mt-14 grid gap-5 text-left sm:grid-cols-2 lg:grid-cols-3">
          {FRAMEWORKS.map((fw) => (
            <Card
              key={fw.name}
              className="group relative flex flex-col p-6 transition-all duration-300 hover:-translate-y-1 hover:border-teal-500/40 hover:shadow-glow"
            >
              <div className="flex items-start justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-surface-border bg-surface-raised">
                  <fw.icon className="h-5 w-5 text-teal-500" />
                </span>
                {fw.status === "live" ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-teal-500/30 bg-teal-500/10 px-2.5 py-1 text-[11px] font-semibold text-teal-500">
                    <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                    Live
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border border-surface-border bg-surface-raised px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    Coming Soon
                  </span>
                )}
              </div>

              <h3 className="mt-4 font-semibold">{fw.name}</h3>
              <p className="mt-1.5 flex-1 text-sm text-muted-foreground">{fw.description}</p>

              {fw.status === "live" && fw.href ? (
                <Link href={fw.href} className="mt-5">
                  <Button size="sm" className="w-full">
                    Get Started
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              ) : (
                fw.waitlistTool && <NotifyMeCapture framework={fw.waitlistTool} />
              )}
            </Card>
          ))}
        </div>

        <Card className="mx-auto mt-20 max-w-xl p-8">
          <h2 className="text-lg font-semibold">Already tracking CBAM or CCTS with us?</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            BRSR Core reuses the same activity data you&apos;ve already submitted — no double entry.
          </p>
          <Link href="/esg/brsr" className="mt-5 inline-block">
            <Button>
              Start your BRSR Core disclosure
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
