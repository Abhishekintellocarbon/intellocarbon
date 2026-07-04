import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Globe2, ShieldCheck, Wallet, MapPinned } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MarketingHeader } from "@/components/intellocalc/marketing-header";
import { ToolFooter } from "@/components/intellocalc/tool-footer";

export const metadata: Metadata = {
  title: "About Us — Intellocarbon",
  description:
    "Intellocarbon is compliance infrastructure for Indian industrial exporters — built in Raipur, Chhattisgarh, by an ISO 14064 Lead Verifier and Validator.",
};

const CREDENTIALS = [
  "ISO 14064 Lead Verifier and Validator — SGS certified",
  "MA Public Policy — University of York, United Kingdom",
  "Masters in Government — MIT World Peace University, Pune",
  "B.E. Mechanical Engineering — CSVTU",
  "PRINCE2 Foundation certified",
  "GHG Protocol certified",
];

const WHY_CARDS = [
  {
    icon: Globe2,
    title: "CBAM + CCTS in one platform",
    description:
      "The only platform that combines EU carbon border compliance and India domestic carbon market compliance from a single data entry point.",
  },
  {
    icon: ShieldCheck,
    title: "Built-in verification",
    description: "Accredited verifiers review and sign off your data inside the platform. No email chains. No spreadsheets.",
  },
  {
    icon: Wallet,
    title: "MSME-first pricing",
    description:
      "Starting at ₹14,999 per month per facility. Built for Indian industrial MSMEs — not multinational corporations.",
  },
  {
    icon: MapPinned,
    title: "Central India first",
    description:
      "Based in Raipur. Built for the steel and cement belt of Chhattisgarh, Jharkhand, Odisha and Madhya Pradesh. We understand your operations.",
  },
];

const REGULATIONS = [
  "EU 2023/956",
  "EU 2025/2547",
  "EU 2023/1773",
  "EU 2025/2546",
  "S.O. 2825(E) CCTS 2023",
  "CEA Grid Emission Factor FY2025-26",
  "ISO 14064-1",
  "ISO 14064-3",
];

export default function AboutPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-gradient-radial-glow" />

      <MarketingHeader />

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-4xl px-6 pb-16 pt-10 text-center">
        <h1 className="text-[36px] font-semibold leading-tight text-[#E8F0F7] text-balance sm:text-[48px]">
          Built for Indian Industry
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-balance text-[#8AA0B4] sm:text-lg">
          We are building the compliance infrastructure India&apos;s industrial sector needs to compete in a
          carbon-priced world.
        </p>
      </section>

      <main className="relative z-10 mx-auto max-w-5xl px-6 pb-24">
        {/* Section 1 — Our Mission */}
        <section className="grid gap-8 border-t border-surface-border py-14 sm:grid-cols-2">
          <h2 className="text-2xl font-semibold text-[#E8F0F7]">Our Mission</h2>
          <p className="text-[#8AA0B4]">
            India&apos;s industrial exporters face mandatory carbon compliance obligations on two fronts
            simultaneously — EU CBAM from 2026 and India CCTS from Q3 2026. Most compliance tools available are
            either too expensive for MSMEs, too focused on large corporations, or only serve one framework at a
            time. Intellocarbon was built to change this. One platform. One data entry. Every compliance output —
            CBAM Communication Package, CCTS BEE Forms, ESG reports — generated automatically.
          </p>
        </section>

        {/* Section 2 — The Founder */}
        <section className="grid gap-8 border-t border-surface-border py-14 sm:grid-cols-2">
          <Card className="rounded-[12px] border-teal-500 p-6">
            <h3 className="text-lg font-semibold text-[#E8F0F7]">Abhishek Dwivedi</h3>
            <p className="mt-1 text-sm text-teal-500">
              Founder and CEO, Intellocarbon Solutions Private Limited
            </p>
            <ul className="mt-5 space-y-2.5">
              {CREDENTIALS.map((credential) => (
                <li key={credential} className="flex items-start gap-2 text-sm text-[#8AA0B4]">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500" />
                  {credential}
                </li>
              ))}
            </ul>
          </Card>
          <p className="text-[#8AA0B4]">
            Abhishek Dwivedi is an ISO 14064 Lead Verifier and Validator — one of the few professionals in India
            certified to both design and verify GHG inventories under the international standard. With a
            background spanning mechanical engineering, public policy, and program management across government
            and development organisations, he identified a critical gap in India&apos;s carbon compliance market —
            and built Intellocarbon to fill it. Based in Raipur, Chhattisgarh, Intellocarbon is built from the
            heartland of Indian steel and cement production — not from a metro co-working space.
          </p>
        </section>

        {/* Section 3 — Why Intellocarbon */}
        <section className="border-t border-surface-border py-14">
          <h2 className="text-2xl font-semibold text-[#E8F0F7]">Why Intellocarbon</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {WHY_CARDS.map((card) => (
              <Card key={card.title} className="rounded-[12px] p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-surface-border bg-surface-raised">
                  <card.icon className="h-5 w-5 text-teal-500" />
                </span>
                <h3 className="mt-4 font-semibold text-[#E8F0F7]">{card.title}</h3>
                <p className="mt-1.5 text-sm text-[#8AA0B4]">{card.description}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* Section 4 — Regulatory Basis */}
        <section className="border-t border-surface-border py-14">
          <Card className="rounded-[12px] border-teal-500 p-8">
            <h2 className="text-xl font-semibold text-[#E8F0F7]">Our Regulatory Foundation</h2>
            <p className="mt-3 text-[#8AA0B4]">
              Every calculation, every report, and every workflow in Intellocarbon is built on primary source
              regulations — not assumptions.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {REGULATIONS.map((reg) => (
                <span
                  key={reg}
                  className="rounded-full border border-teal-500/40 bg-teal-500/10 px-3 py-1 text-xs font-medium text-teal-500"
                >
                  {reg}
                </span>
              ))}
            </div>
          </Card>
        </section>

        {/* Section 5 — Contact */}
        <section className="border-t border-surface-border py-14 text-center">
          <h2 className="text-2xl font-semibold text-[#E8F0F7]">Get in touch</h2>
          <div className="mt-4 space-y-1.5 text-[#8AA0B4]">
            <p>abhishek@intellocarbon.com</p>
            <p>intellocarbon.com</p>
            <p>Raipur, Chhattisgarh, India</p>
          </div>
          <Link href="/signup" className="mt-6 inline-block">
            <Button>
              Get Started on Intellocarbon
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </section>
      </main>

      <div className="relative z-10">
        <ToolFooter />
      </div>
    </div>
  );
}
