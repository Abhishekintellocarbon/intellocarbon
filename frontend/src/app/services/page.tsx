import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Globe2, MapPinned, Leaf, Calculator } from "lucide-react";
import { Card } from "@/components/ui/card";
import { MarketingHeader } from "@/components/intellocalc/marketing-header";
import { ToolFooter } from "@/components/intellocalc/tool-footer";

export const metadata: Metadata = {
  title: "Services — Intellocarbon",
  description:
    "CBAM compliance, CCTS compliance, BRSR Core / ESG reporting, and free IntelloCalc calculators — all from one Intellocarbon platform.",
};

const SERVICES = [
  {
    icon: Globe2,
    title: "CBAM Compliance",
    description:
      "Calculate Specific Embedded Emissions, generate CBAM Communication Packages, and claim Article 9 deductions for carbon price already paid in India — for every EU export shipment, every quarter.",
    href: "/#pillars",
    cta: "Explore CBAM",
  },
  {
    icon: MapPinned,
    title: "CCTS Compliance",
    description:
      "Track GHG intensity against BEE targets, manage your Carbon Credit Certificate surplus or deficit position, and generate BEE-format reports for India's Carbon Credit Trading Scheme.",
    href: "/#pillars",
    cta: "Explore CCTS",
  },
  {
    icon: Leaf,
    title: "BRSR Core / ESG Reporting",
    description:
      "SEBI's mandatory Business Responsibility and Sustainability Reporting, built to reuse the GHG data you've already entered for CBAM and CCTS — only 8 additional ESG attributes to complete.",
    href: "/esg",
    cta: "Explore ESG",
  },
  {
    icon: Calculator,
    title: "IntelloCalc (free tools)",
    description:
      "Three free calculators — check your CBAM exposure, your CCTS GHG intensity, and your overall compliance eligibility. No signup required.",
    href: "/intellocalc",
    cta: "Try IntelloCalc",
  },
];

export default function ServicesPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background lg:pr-[240px]">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-gradient-radial-glow" />

      <MarketingHeader />

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-4xl px-6 pb-16 pt-10 text-center">
        <h1 className="text-[36px] font-semibold leading-tight text-[#E8F0F7] text-balance sm:text-[48px]">
          Everything you need, one platform
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-balance text-[#8AA0B4] sm:text-lg">
          CBAM, CCTS, BRSR Core and free calculators — from a single data entry point, built for Indian industry.
        </p>
      </section>

      <main className="relative z-10 mx-auto max-w-5xl px-6 pb-24">
        <section className="border-t border-surface-border py-14">
          <div className="grid gap-6 sm:grid-cols-2">
            {SERVICES.map((service) => (
              <Card
                key={service.title}
                className="group relative flex flex-col rounded-[12px] p-7 transition-all duration-300 hover:-translate-y-1 hover:border-teal-500/40 hover:shadow-glow"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-surface-border bg-[radial-gradient(circle,rgba(0,212,170,0.18)_0%,rgba(0,212,170,0)_70%)] transition-colors group-hover:border-teal-500/40">
                  <service.icon className="h-5 w-5 text-teal-500" />
                </span>
                <h2 className="mt-4 text-lg font-semibold text-[#E8F0F7]">{service.title}</h2>
                <p className="mt-1.5 text-sm text-[#8AA0B4]">{service.description}</p>
                <Link
                  href={service.href}
                  className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-teal-500 hover:text-teal-400"
                >
                  {service.cta}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <div className="relative z-10">
        <ToolFooter />
      </div>
    </div>
  );
}
