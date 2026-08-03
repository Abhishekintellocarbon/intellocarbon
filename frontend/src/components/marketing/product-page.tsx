import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MarketingHeader } from "@/components/intellocalc/marketing-header";
import { ToolFooter } from "@/components/intellocalc/tool-footer";

export const CONTACT_EMAIL = "abhishek@intellocarbon.com";

export function demoMailto(subject: string) {
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}

export interface CtaLink {
  label: string;
  href: string;
}

function isExternalHref(href: string) {
  return href.startsWith("mailto:") || href.startsWith("http") || href.startsWith("#");
}

/** Renders a Next Link for in-app routes and a plain anchor for mailto/external targets. */
function SmartLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  if (isExternalHref(href)) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

/** Browser/document chrome used by the sample-output mockups. */
export function MockChrome({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-1.5 border-b border-surface-border px-4 py-2.5">
      <span className="h-2 w-2 rounded-full bg-[#FF5C6C]/60" />
      <span className="h-2 w-2 rounded-full bg-[#F5A623]/60" />
      <span className="h-2 w-2 rounded-full bg-teal-500/60" />
      <span className="ml-2 truncate text-[11px] text-muted-foreground">{label}</span>
    </div>
  );
}

export function ProductSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="relative z-10 mx-auto max-w-6xl px-6 pb-20">
      <h2 className="text-[28px] font-semibold text-[#E8F0F7] sm:text-[32px]">{title}</h2>
      {subtitle && <p className="mt-2 max-w-2xl text-[#8AA0B4]">{subtitle}</p>}
      <div className="mt-8">{children}</div>
    </section>
  );
}

export interface Capability {
  title: string;
  description: string;
}

export interface ProductPageProps {
  eyebrow: string;
  headline: string;
  subhead: string;
  primaryCta: CtaLink;
  secondaryCta: CtaLink;
  trustChips: string[];
  challengeSubtitle: string;
  challenges: string[];
  capabilities: Capability[];
  /** Section 4 — compliance calendar or forward-looking roadmap. */
  featureSection: ReactNode;
  /** Section 5 — sample output mockup. */
  proofTitle: string;
  proofSubtitle: string;
  proof: ReactNode;
  closeHeadline: string;
  closeSubhead: string;
  demoSubject: string;
  crossLinks: CtaLink[];
}

export function ProductPage({
  eyebrow,
  headline,
  subhead,
  primaryCta,
  secondaryCta,
  trustChips,
  challengeSubtitle,
  challenges,
  capabilities,
  featureSection,
  proofTitle,
  proofSubtitle,
  proof,
  closeHeadline,
  closeSubhead,
  demoSubject,
  crossLinks,
}: ProductPageProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background lg:pr-[240px]">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-gradient-radial-glow" />
      <div className="pointer-events-none absolute -left-40 top-20 h-96 w-96 rounded-full bg-teal-500/10 blur-[120px]" />

      <MarketingHeader />

      {/* Section 1 — Hero */}
      <section className="relative z-10 mx-auto max-w-4xl px-6 pb-16 pt-10 text-center sm:pt-14">
        <span className="inline-flex items-center gap-2.5 rounded-full border border-surface-border bg-surface px-5 py-2.5 text-sm font-medium text-[#8AA0B4]">
          <span className="h-2 w-2 shrink-0 rounded-full bg-teal-500" />
          {eyebrow}
        </span>

        <h1 className="mt-6 text-[36px] font-semibold leading-tight text-[#E8F0F7] text-balance sm:text-[52px]">
          {headline}
        </h1>

        <p className="mx-auto mt-5 max-w-2xl text-balance text-lg text-[#8AA0B4]">{subhead}</p>

        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <SmartLink href={primaryCta.href}>
            <Button size="lg" className="w-full rounded-[8px] sm:w-auto">
              {primaryCta.label}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </SmartLink>
          <SmartLink href={secondaryCta.href}>
            <Button variant="secondary" size="lg" className="w-full rounded-[8px] sm:w-auto">
              {secondaryCta.label}
            </Button>
          </SmartLink>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
          {trustChips.map((chip) => (
            <span
              key={chip}
              className="rounded-full border border-surface-border bg-surface px-3.5 py-1.5 text-xs font-medium text-[#8AA0B4]"
            >
              {chip}
            </span>
          ))}
        </div>
      </section>

      {/* Section 2 — The Challenge */}
      <ProductSection title="The Challenge" subtitle={challengeSubtitle}>
        <div className="grid gap-5 sm:grid-cols-2">
          {challenges.map((challenge, index) => (
            <Card key={challenge} className="flex gap-4 rounded-[12px] p-6">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-surface-border bg-surface-raised text-xs font-semibold text-teal-500">
                {String(index + 1).padStart(2, "0")}
              </span>
              <p className="text-sm leading-relaxed text-[#8AA0B4]">{challenge}</p>
            </Card>
          ))}
        </div>
      </ProductSection>

      {/* Section 3 — What Intellocarbon Does */}
      <ProductSection
        title="What Intellocarbon Does"
        subtitle="Engineered for regulatory precision, not generic carbon accounting."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          {capabilities.map((capability) => (
            <Card
              key={capability.title}
              className="group flex flex-col rounded-[12px] p-7 transition-all duration-300 hover:-translate-y-1 hover:border-teal-500/40 hover:shadow-glow"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-surface-border bg-[radial-gradient(circle,rgba(0,212,170,0.18)_0%,rgba(0,212,170,0)_70%)] transition-colors group-hover:border-teal-500/40">
                <Check className="h-4 w-4 text-teal-500" />
              </span>
              <h3 className="mt-4 text-base font-semibold text-[#E8F0F7]">{capability.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#8AA0B4]">{capability.description}</p>
            </Card>
          ))}
        </div>
      </ProductSection>

      {/* Section 4 — Calendar / roadmap */}
      {featureSection}

      {/* Section 5 — Proof */}
      <ProductSection title={proofTitle} subtitle={proofSubtitle}>
        {proof}
      </ProductSection>

      {/* Section 6 — Close */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-24">
        <Card className="rounded-[12px] p-10 text-center">
          <h2 className="text-[28px] font-semibold text-[#E8F0F7] text-balance sm:text-[32px]">
            {closeHeadline}
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-balance text-[#8AA0B4]">{closeSubhead}</p>

          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a href={demoMailto(demoSubject)}>
              <Button size="lg" className="w-full rounded-[8px] sm:w-auto">
                Request a demo
                <ArrowRight className="h-4 w-4" />
              </Button>
            </a>
            <a href={demoMailto(`Intellocarbon — ${eyebrow} enquiry`)}>
              <Button variant="secondary" size="lg" className="w-full rounded-[8px] sm:w-auto">
                Talk to us
              </Button>
            </a>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 border-t border-surface-border pt-8">
            {crossLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-500 hover:text-teal-400"
              >
                {link.label}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ))}
          </div>
        </Card>
      </section>

      <div className="relative z-10">
        <ToolFooter />
      </div>
    </div>
  );
}
