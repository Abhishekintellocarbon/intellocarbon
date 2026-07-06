import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock, Globe2, ListChecks, MapPinned, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MarketingHeader } from "@/components/intellocalc/marketing-header";
import { ToolFooter } from "@/components/intellocalc/tool-footer";

export const metadata: Metadata = {
  title: "IntelloCalc — Free Carbon Compliance Tools for Indian Industry | Intellocarbon",
  description:
    "Free, no-login IntelloCalc tools from Intellocarbon: estimate your EU CBAM exposure, check your India CCTS position, and find which compliance frameworks apply to you.",
};

const TOOLS = [
  {
    href: "/intellocalc/border",
    icon: Globe2,
    name: "IntelloCalc Border",
    description: "Find out your EU carbon border exposure in seconds.",
  },
  {
    href: "/intellocalc/india",
    icon: MapPinned,
    name: "IntelloCalc India",
    description: "Check your India carbon compliance position instantly.",
  },
  {
    href: "/intellocalc/comply",
    icon: ListChecks,
    name: "IntelloCalc Comply",
    description: "Answer 5 questions. Know exactly which frameworks apply.",
  },
];

const WHY_POINTS = [
  { icon: ShieldCheck, text: "No account needed." },
  { icon: Clock, text: "Results in 60 seconds." },
  { icon: CheckCircle2, text: "Based on actual EU and India regulations." },
];

export default function IntelloCalcHub() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background lg:pr-[240px]">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-gradient-radial-glow" />

      <MarketingHeader />

      <main className="relative z-10 mx-auto max-w-5xl px-6 pb-24 pt-10 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-surface-border bg-surface px-3.5 py-1.5 text-xs font-medium text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
          Measure once. Comply everywhere.
        </span>

        <h1 className="mt-6 text-[36px] font-semibold leading-tight text-balance sm:text-[48px]">
          <span className="text-gradient">IntelloCalc</span> by Intellocarbon
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-balance text-muted-foreground sm:text-lg">
          Free compliance estimation tools for Indian industry.
        </p>

        <div className="mt-14 grid gap-5 text-left sm:grid-cols-3">
          {TOOLS.map((tool) => (
            <Card key={tool.href} className="flex flex-col p-6">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-surface-border bg-surface-raised">
                <tool.icon className="h-5 w-5 text-teal-500" />
              </span>
              <h3 className="mt-4 font-semibold">{tool.name}</h3>
              <p className="mt-1.5 flex-1 text-sm text-muted-foreground">{tool.description}</p>
              <Link href={tool.href} className="mt-5">
                <Button size="sm" className="w-full">
                  Try Free
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </Card>
          ))}
        </div>

        <div className="mt-20">
          <h2 className="text-xl font-semibold">Why IntelloCalc?</h2>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {WHY_POINTS.map((point) => (
              <span key={point.text} className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <point.icon className="h-4 w-4 text-teal-500" />
                {point.text}
              </span>
            ))}
          </div>
        </div>

        <Card className="mx-auto mt-20 max-w-xl p-8">
          <h2 className="text-lg font-semibold">Ready for verified compliance reports?</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Sign up on Intellocarbon for verified CBAM reports, CCTS filings, BRSR disclosures, and ongoing
            compliance tracking.
          </p>
          <Link href="/signup" className="mt-5 inline-block">
            <Button>
              Sign up on Intellocarbon
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
