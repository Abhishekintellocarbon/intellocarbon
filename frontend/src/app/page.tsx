import Link from "next/link";
import { ArrowRight, BarChart3, ShieldCheck, Sparkles } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

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

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-gradient-radial-glow" />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Logo size="lg" />
        <nav className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost" size="sm">
              Log in
            </Button>
          </Link>
          <Link href="/signup">
            <Button size="sm">Get started</Button>
          </Link>
        </nav>
      </header>

      <main className="relative z-10 mx-auto max-w-4xl px-6 pb-24 pt-16 text-center sm:pt-24">
        <span className="inline-flex items-center gap-2 rounded-full border border-surface-border bg-surface px-3.5 py-1.5 text-xs font-medium text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
          India&apos;s first unified environmental compliance platform
        </span>

        <h1 className="mt-6 text-[44px] font-semibold leading-tight text-balance sm:text-[60px]">
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

      <footer className="relative z-10 border-t border-surface-border py-6 text-center text-xs text-muted">
        © {new Date().getFullYear()} Intellocarbon Solutions. All rights reserved.
      </footer>
    </div>
  );
}
