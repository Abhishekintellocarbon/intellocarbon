import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  ShieldCheck,
  Sparkles,
  PenLine,
  Calculator,
  FileText,
  ChevronRight,
  Factory,
  Building2,
  Layers,
  Sprout,
  Atom,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MarketingHeader } from "@/components/intellocalc/marketing-header";

const pillars = [
  {
    icon: ShieldCheck,
    title: "CBAM Compliance",
    description:
      "Calculate and report Specific Embedded Emissions for EU Carbon Border Adjustment Mechanism. Steel, cement, aluminium, fertilizers, hydrogen, electricity.",
  },
  {
    icon: BarChart3,
    title: "CCTS & Carbon Markets",
    description:
      "Track GHG intensity, earn Carbon Credit Certificates under India's Carbon Credit Trading Scheme. Article 9 deduction calculated automatically.",
  },
  {
    icon: Sparkles,
    title: "ESG & Scope 1, 2, 3",
    description:
      "Unified Scope 1, 2 and 3 emissions dashboard built for Indian regulatory frameworks — BRSR, GHG Protocol, ISO 14064.",
  },
];

const STATS = [
  { value: "30,000 TPA", label: "CCTS threshold — Iron & Steel" },
  { value: "50 tonnes", label: "CBAM threshold — EU exports/year" },
  { value: "31 Jul 2026", label: "MRV deadline — FY 2025-26" },
];

const STEPS = [
  { icon: PenLine, label: "Enter data" },
  { icon: Calculator, label: "Calculate" },
  { icon: ShieldCheck, label: "Verify" },
  { icon: FileText, label: "Report" },
];

const SECTORS = [
  { icon: Factory, label: "Steel" },
  { icon: Building2, label: "Cement" },
  { icon: Layers, label: "Aluminium" },
  { icon: Sprout, label: "Fertilizers" },
  { icon: Atom, label: "Hydrogen" },
  { icon: Zap, label: "Electricity" },
];

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-gradient-radial-glow" />

      <MarketingHeader />

      <main className="relative z-10 mx-auto max-w-4xl px-6 pb-24 pt-10 text-center sm:pt-14">
        <span className="mx-auto flex w-full max-w-md items-center justify-center gap-2.5 rounded-full border border-surface-border bg-surface px-6 py-3 text-center text-sm font-medium leading-snug text-muted-foreground sm:max-w-xl sm:px-8 sm:py-3.5 sm:text-base md:max-w-2xl md:text-lg">
          <span className="h-2 w-2 shrink-0 rounded-full bg-teal-500" />
          CBAM &middot; CCTS &middot; EPR &middot; ESG &mdash; one platform.
        </span>

        <h1 className="mt-5 text-[44px] font-semibold leading-tight text-balance sm:text-[60px]">
          Environmental compliance and{" "}
          <span className="text-gradient">climate intelligence</span>, unified
        </h1>

        <p className="mx-auto mt-5 max-w-2xl text-balance text-muted-foreground sm:text-lg">
          Intellocarbon brings regulatory compliance, emissions tracking, and climate risk
          intelligence into a single platform built for Indian enterprises.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/signup">
            <Button size="lg">
              Start free
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/login">
            <Button variant="secondary" size="lg">
              I already have an account
            </Button>
          </Link>
        </div>

        <div className="mt-20 grid gap-5 text-left sm:grid-cols-3">
          {pillars.map((pillar) => (
            <Card key={pillar.title} className="p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-surface-border bg-surface-raised">
                <pillar.icon className="h-5 w-5 text-teal-500" />
              </span>
              <h3 className="mt-4 font-medium">{pillar.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{pillar.description}</p>
            </Card>
          ))}
        </div>
      </main>

      {/* Stat strip */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 pb-20">
        <div className="grid gap-5 sm:grid-cols-3">
          {STATS.map((stat) => (
            <Card key={stat.label} className="rounded-[12px] p-6 text-center">
              <p className="text-3xl font-semibold text-gradient">{stat.value}</p>
              <p className="mt-1.5 text-sm text-muted-foreground">{stat.label}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 pb-20 text-center">
        <h2 className="text-2xl font-semibold">How it works</h2>
        <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center sm:gap-2">
          {STEPS.map((step, i) => (
            <div key={step.label} className="flex items-center gap-2">
              <div className="flex w-40 flex-col items-center gap-2 rounded-[12px] border border-surface-border bg-surface px-6 py-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-teal-blue">
                  <step.icon className="h-5 w-5 text-[#06120F]" />
                </span>
                <span className="text-sm font-medium">{step.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <ChevronRight className="hidden h-5 w-5 shrink-0 text-muted-foreground/40 sm:block" />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Sector row */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 pb-20 text-center">
        <h2 className="text-2xl font-semibold">Built for every CBAM sector</h2>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          {SECTORS.map((sector) => (
            <div
              key={sector.label}
              className="flex items-center gap-2.5 rounded-[12px] border border-surface-border bg-surface px-5 py-3"
            >
              <sector.icon className="h-4 w-4 text-teal-500" />
              <span className="text-sm font-medium text-foreground/90">{sector.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* IntelloCalc teaser */}
      <section className="relative z-10 mx-auto max-w-4xl px-6 pb-24">
        <Card className="flex flex-col items-center gap-4 rounded-[12px] border-teal-500/20 bg-gradient-radial-glow p-8 text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <p className="text-lg font-semibold text-foreground">
              Free: Check your CBAM exposure in 60 seconds
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              No signup required — try IntelloCalc, our free public estimator.
            </p>
          </div>
          <Link href="/intellocalc" className="shrink-0">
            <Button className="rounded-[8px]">
              Try IntelloCalc
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </Card>
      </section>

      <footer className="relative z-10 border-t border-surface-border px-6 py-6 text-center text-xs text-muted">
        <p>© {new Date().getFullYear()} Intellocarbon Solutions. All rights reserved.</p>
        <p className="mx-auto mt-3 max-w-3xl">
          Intellocarbon provides calculation and reporting tools based on data you provide and applicable
          regulations at the time of use. Final compliance responsibility rests with the client and their
          appointed verifier/auditor. Intellocarbon is not liable for penalties arising from inaccurate
          client-submitted data or regulatory changes not yet reflected in the platform.
        </p>
      </footer>
    </div>
  );
}
