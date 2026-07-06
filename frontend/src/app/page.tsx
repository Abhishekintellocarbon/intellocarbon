import Link from "next/link";
import {
  ArrowRight,
  ShieldCheck,
  BarChart3,
  FileBarChart,
  Calculator,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MarketingHeader } from "@/components/intellocalc/marketing-header";

const STATS = [
  { value: "30,000 TPA", label: "CCTS threshold — Iron & Steel" },
  { value: "50 tonnes", label: "CBAM threshold — EU exports/year" },
  { value: "31 Jul 2026", label: "MRV deadline — FY 2025-26" },
];

const PILLARS = [
  {
    icon: ShieldCheck,
    title: "CBAM Compliance",
    description:
      "Calculate and report Specific Embedded Emissions for EU Carbon Border Adjustment Mechanism. Quarterly reports. Annual declaration. Article 9 deduction automatic.",
    cta: "Start CBAM",
  },
  {
    icon: BarChart3,
    title: "CCTS & Carbon Markets",
    description:
      "Track GHG intensity against BEE targets, earn Carbon Credit Certificates, manage CCTS surplus and deficit position. Full BEE format reports.",
    cta: "Start CCTS",
  },
  {
    icon: FileBarChart,
    title: "BRSR & ESG Reporting",
    description:
      "SEBI BRSR Core disclosures generated from the same emissions data. Reasonable assurance ready. GRI, ISSB, CSRD and CDP on the roadmap.",
    cta: "Start BRSR",
  },
];

const STANDARDS = [
  { label: "EU CBAM Regulation 2023/956", dot: "#00D4AA" },
  { label: "BEE CCTS S.O. 2825(E)", dot: "#4A9EFF" },
  { label: "GHG Protocol", dot: "#F5A623" },
  { label: "SEBI BRSR Framework", dot: "#4A9EFF" },
  { label: "ISO 14064", dot: "#F5A623" },
];

const OFFERINGS = [
  {
    title: "EU CBAM",
    description:
      "Six sectors. Quarterly reporting. Annual certificate surrender. Verified communication package for EU importer.",
  },
  {
    title: "India CCTS",
    description:
      "Nine obligated sectors. BEE format reports. Forms 1A 1B 1C 1D A B C D. Carbon credit surplus tracking.",
  },
  {
    title: "BRSR Core",
    description:
      "Nine SEBI attributes. Reasonable assurance ready. Value-chain disclosure. Reuses your existing emissions data.",
  },
  {
    title: "IntelloCalc Free Tools",
    description:
      "Check CBAM exposure in 60 seconds. Check CCTS GHG intensity. Compliance eligibility wizard. No signup required.",
  },
];

const BLOG_POSTS = [
  {
    tag: "CBAM",
    date: "July 2026",
    title: "What Indian steel exporters need to know about CBAM in 2026",
    excerpt:
      "The EU Carbon Border Adjustment Mechanism is now fully operational. Here is what changes for Indian manufacturers this year.",
  },
  {
    tag: "CCTS",
    date: "July 2026",
    title: "India's Carbon Credit Trading Scheme — Phase 2 is live for steel",
    excerpt:
      "Iron and Steel joined the CCTS in January 2026. Here is how the intensity targets, CCCs, and compliance calendar work.",
  },
  {
    tag: "BRSR",
    date: "July 2026",
    title: "BRSR Core — what Indian manufacturers supplying listed companies must know",
    excerpt:
      "SEBI is expanding BRSR Core value-chain disclosures. If you supply to a listed company, your emissions data is now their compliance requirement.",
  },
];

const FOOTER_LINKS = {
  quickLinks: [
    { label: "Home", href: "/" },
    { label: "Services", href: "#pillars" },
    { label: "About Us", href: "/about" },
    { label: "FAQ", href: "/faq" },
    { label: "Pricing", href: "/billing" },
  ],
  platform: [
    { label: "CBAM", href: "#pillars" },
    { label: "CCTS", href: "#pillars" },
    { label: "BRSR", href: "/esg" },
    { label: "IntelloCalc", href: "/intellocalc" },
  ],
};

function BrowserChrome({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-1.5 border-b border-surface-border px-4 py-2.5">
      <span className="h-2 w-2 rounded-full bg-[#FF5C6C]/60" />
      <span className="h-2 w-2 rounded-full bg-[#F5A623]/60" />
      <span className="h-2 w-2 rounded-full bg-teal-500/60" />
      <span className="ml-2 truncate text-[11px] text-muted-foreground">{label}</span>
    </div>
  );
}

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background lg:pr-[240px]">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-gradient-radial-glow" />
      <div className="pointer-events-none absolute -left-40 top-20 h-96 w-96 rounded-full bg-teal-500/10 blur-[120px]" />
      <div className="pointer-events-none absolute -right-40 top-64 h-96 w-96 rounded-full bg-blue-500/10 blur-[120px]" />

      <MarketingHeader />

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-20 pt-10 sm:pt-14">
        <div className="grid items-center gap-12 lg:grid-cols-[55%_45%]">
          <div>
            <span className="inline-flex items-center gap-2.5 rounded-full border border-surface-border bg-surface px-5 py-2.5 text-sm font-medium text-muted-foreground">
              <span className="h-2 w-2 shrink-0 rounded-full bg-teal-500" />
              CBAM &middot; CCTS &middot; BRSR &middot; ESG &mdash; one platform
            </span>

            <h1 className="mt-6 text-[40px] font-semibold leading-tight text-balance sm:text-[56px]">
              Environmental compliance and{" "}
              <span className="text-gradient">climate intelligence</span>, unified
            </h1>

            <p className="mt-5 max-w-xl text-balance text-lg text-muted-foreground">
              Intellocarbon automates emissions calculation, verification, and reporting for Indian
              industrial exporters — one platform, every framework.
            </p>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
              <Link href="/signup">
                <Button size="lg">
                  Start free
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/login">
                <Button variant="secondary" size="lg">
                  Log in
                </Button>
              </Link>
            </div>
          </div>

          {/* Dashboard mockup */}
          <div className="rounded-2xl border border-surface-border bg-surface p-6 shadow-card">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                CBAM Liability — Q2 2026
              </p>
              <span className="shrink-0 rounded-full border border-[#F5A623]/30 bg-[#F5A623]/10 px-2.5 py-1 text-[10px] font-semibold text-[#F5A623]">
                31 Jul 2026 deadline
              </span>
            </div>
            <p className="mt-3 text-4xl font-bold text-teal-500">&euro; 4,28,320</p>

            <div className="mt-6 flex h-24 items-end gap-2">
              {[40, 65, 50, 80, 60, 90].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t-md"
                  style={{ height: `${h}%`, backgroundColor: i % 2 === 0 ? "#00D4AA" : "#4A9EFF" }}
                />
              ))}
            </div>

            <div className="mt-6 grid grid-cols-3 gap-2">
              <div className="rounded-lg border border-surface-border bg-surface-raised p-2.5 text-center">
                <p className="text-[10px] text-muted-foreground">Actual SEE</p>
                <p className="mt-0.5 text-xs font-semibold text-foreground">1.16 tCO2e/t</p>
              </div>
              <div className="rounded-lg border border-surface-border bg-surface-raised p-2.5 text-center">
                <p className="text-[10px] text-muted-foreground">EU Default</p>
                <p className="mt-0.5 text-xs font-semibold text-foreground">2.28 tCO2e/t</p>
              </div>
              <div className="rounded-lg border border-surface-border bg-surface-raised p-2.5 text-center">
                <p className="text-[10px] text-muted-foreground">Saving</p>
                <p className="mt-0.5 text-xs font-semibold text-teal-500">49%</p>
              </div>
            </div>

            <p className="mt-4 text-center text-[11px] text-muted-foreground">Live dashboard preview</p>
          </div>
        </div>
      </section>

      {/* Stat strip */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-20">
        <div className="grid gap-5 sm:grid-cols-3">
          {STATS.map((stat) => (
            <Card key={stat.label} className="rounded-[12px] p-6 text-center">
              <p className="text-3xl font-semibold text-gradient">{stat.value}</p>
              <p className="mt-1.5 text-sm text-muted-foreground">{stat.label}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Three platform pillars */}
      <section id="pillars" className="relative z-10 mx-auto max-w-6xl px-6 pb-20 text-center">
        <h2 className="text-[32px] font-semibold sm:text-[36px]">Everything your compliance team needs</h2>

        <div className="mt-10 grid gap-6 text-left sm:grid-cols-3">
          {PILLARS.map((pillar) => (
            <Card
              key={pillar.title}
              className="group relative flex flex-col p-7 transition-all duration-300 hover:-translate-y-1 hover:border-t-2 hover:border-t-teal-500 hover:shadow-glow"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-surface-border bg-[radial-gradient(circle,rgba(0,212,170,0.18)_0%,rgba(0,212,170,0)_70%)] transition-colors group-hover:border-teal-500/40">
                <pillar.icon className="h-5 w-5 text-teal-500" />
              </span>
              <h3 className="mt-4 font-medium">{pillar.title}</h3>
              <p className="mt-1.5 flex-1 text-sm text-muted-foreground">{pillar.description}</p>
              <Link
                href="/signup"
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-teal-500 hover:text-teal-400"
              >
                {pillar.cta}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Card>
          ))}
        </div>
      </section>

      {/* Platform in action */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-20">
        <h2 className="text-[32px] font-semibold sm:text-[36px]">See the platform</h2>
        <p className="mt-2 text-muted-foreground">Real calculations. Real reports. No spreadsheets.</p>

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {/* Emissions dashboard mock */}
          <div>
            <div className="h-[280px] overflow-hidden rounded-2xl border border-surface-border bg-surface shadow-card">
              <BrowserChrome label="app.intellocarbon.com/dashboard" />
              <div className="p-5">
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded-lg border border-surface-border bg-surface-raised p-3">
                    <p className="text-[10px] text-muted-foreground">Scope 1</p>
                    <p className="mt-1 text-lg font-semibold text-teal-500">1,254 t</p>
                  </div>
                  <div className="rounded-lg border border-surface-border bg-surface-raised p-3">
                    <p className="text-[10px] text-muted-foreground">Scope 2</p>
                    <p className="mt-1 text-lg font-semibold text-blue-500">342 t</p>
                  </div>
                </div>
                <div className="mt-3 flex h-16 items-end gap-1.5">
                  {[30, 55, 40, 70, 45, 85, 60].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t-sm bg-teal-500/70"
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <p className="mt-3 text-center text-sm text-muted-foreground">Emissions dashboard</p>
          </div>

          {/* CBAM report generator mock */}
          <div>
            <div className="h-[280px] overflow-hidden rounded-2xl border border-surface-border bg-surface shadow-card">
              <BrowserChrome label="CBAM Communication Package.pdf" />
              <div className="p-5">
                <div className="space-y-2">
                  <div className="flex items-center justify-between rounded-lg bg-surface-raised px-3 py-2 text-xs">
                    <span className="text-muted-foreground">Direct emissions</span>
                    <span className="font-medium text-foreground">1,254 tCO2e</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-surface-raised px-3 py-2 text-xs">
                    <span className="text-muted-foreground">Indirect emissions</span>
                    <span className="font-medium text-foreground">342 tCO2e</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-surface-raised px-3 py-2 text-xs">
                    <span className="text-muted-foreground">Precursor emissions</span>
                    <span className="font-medium text-foreground">89 tCO2e</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-teal-500/30 bg-teal-500/10 px-3 py-2 text-xs">
                    <span className="font-semibold text-teal-500">Total SEE</span>
                    <span className="font-semibold text-teal-500">1,685 tCO2e</span>
                  </div>
                </div>
                <div className="mt-3 rounded-lg bg-gradient-teal-blue px-3 py-2 text-center text-xs font-semibold text-[#06120F]">
                  Download PDF
                </div>
              </div>
            </div>
            <p className="mt-3 text-center text-sm text-muted-foreground">CBAM report generator</p>
          </div>

          {/* CCTS compliance tracker mock */}
          <div>
            <div className="h-[280px] overflow-hidden rounded-2xl border border-surface-border bg-surface shadow-card">
              <BrowserChrome label="app.intellocarbon.com/ccts" />
              <div className="p-5">
                <p className="text-[11px] text-muted-foreground">Actual vs. notified target</p>
                <div className="mt-2 h-5 overflow-hidden rounded-full bg-surface-raised">
                  <div className="h-full w-[68%] rounded-full bg-teal-500" />
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>1.16 tCO2e/t actual</span>
                  <span>1.90 tCO2e/t target</span>
                </div>
                <div className="mt-5 rounded-lg border border-teal-500/30 bg-teal-500/10 p-3 text-center">
                  <p className="text-[10px] text-muted-foreground">CCC Position</p>
                  <p className="mt-1 text-lg font-semibold text-teal-500">Surplus of 1,530 tCO2e</p>
                </div>
              </div>
            </div>
            <p className="mt-3 text-center text-sm text-muted-foreground">CCTS compliance tracker</p>
          </div>
        </div>
      </section>

      {/* Standards */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-20 text-center">
        <h2 className="text-[28px] font-semibold sm:text-[32px]">Built on globally recognised standards</h2>
        <p className="mx-auto mt-2 max-w-xl text-muted-foreground">
          Every calculation traces back to published regulation. Every emission factor is cited.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {STANDARDS.map((standard) => (
            <div
              key={standard.label}
              className="flex items-center gap-2 rounded-full border border-surface-border bg-surface px-4 py-2 text-sm font-medium text-foreground/90"
            >
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: standard.dot }} />
              {standard.label}
            </div>
          ))}
        </div>
      </section>

      {/* Key offerings */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-20 text-center">
        <h2 className="text-[32px] font-semibold sm:text-[36px]">What Intellocarbon covers</h2>

        <div className="mt-10 grid gap-6 text-left sm:grid-cols-2">
          {OFFERINGS.map((offering) => (
            <Card key={offering.title} className="p-7">
              <h3 className="font-semibold">{offering.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{offering.description}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Blog / insights */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-20 text-center">
        <h2 className="text-[28px] font-semibold sm:text-[32px]">Insights and regulatory updates</h2>

        <div className="mt-10 grid gap-6 text-left lg:grid-cols-3">
          {BLOG_POSTS.map((post) => (
            <Card key={post.title} className="flex flex-col p-6">
              <div className="flex items-center gap-2 text-xs">
                <span className="rounded-full border border-teal-500/30 bg-teal-500/10 px-2.5 py-1 font-semibold text-teal-500">
                  {post.tag}
                </span>
                <span className="text-muted-foreground">{post.date}</span>
              </div>
              <h3 className="mt-3 font-semibold leading-snug">{post.title}</h3>
              <p className="mt-2 flex-1 text-sm text-muted-foreground">{post.excerpt}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-teal-500">
                Read more
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </Card>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-surface-border bg-background px-6 py-14">
        <div className="mx-auto grid max-w-6xl gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <span className="flex items-center gap-2 text-lg font-bold text-foreground">
              <Calculator className="h-5 w-5 text-teal-500" />
              Intellocarbon
            </span>
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">
              Compliance infrastructure for Indian industrial exporters — CBAM, CCTS and BRSR from one
              platform.
            </p>
            <p className="mt-4 text-xs text-muted">
              &copy; {new Date().getFullYear()} Intellocarbon Solutions. All rights reserved.
            </p>
          </div>

          <div>
            <p className="text-sm font-semibold text-foreground">Quick Links</p>
            <ul className="mt-3 space-y-2.5">
              {FOOTER_LINKS.quickLinks.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-sm text-muted-foreground hover:text-teal-500">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-sm font-semibold text-foreground">Platform</p>
            <ul className="mt-3 space-y-2.5">
              {FOOTER_LINKS.platform.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-sm text-muted-foreground hover:text-teal-500">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-sm font-semibold text-foreground">Legal / Contact</p>
            <ul className="mt-3 space-y-2.5">
              <li>
                <span className="text-sm text-muted-foreground">Terms</span>
              </li>
              <li>
                <span className="text-sm text-muted-foreground">Privacy</span>
              </li>
              <li>
                <span className="text-sm text-muted-foreground">notifications@intellocarbon.com</span>
              </li>
            </ul>
          </div>
        </div>

        <p className="mx-auto mt-10 max-w-3xl text-center text-xs text-muted">
          Intellocarbon provides calculation and reporting tools based on data you provide and applicable
          regulations at the time of use. Final compliance responsibility rests with the client and their
          appointed verifier/auditor. Intellocarbon is not liable for penalties arising from inaccurate
          client-submitted data or regulatory changes not yet reflected in the platform.
        </p>
      </footer>
    </div>
  );
}
