import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { MarketingHeader } from "@/components/intellocalc/marketing-header";
import { ToolFooter } from "@/components/intellocalc/tool-footer";
import { INSIGHTS, getInsight } from "@/lib/insights";

interface InsightPageProps {
  params: { slug: string };
}

export function generateStaticParams() {
  return INSIGHTS.map((insight) => ({ slug: insight.slug }));
}

export function generateMetadata({ params }: InsightPageProps): Metadata {
  const insight = getInsight(params.slug);

  if (!insight) {
    return { title: "Insight not found — Intellocarbon" };
  }

  return {
    title: `${insight.title} | Intellocarbon`,
    description: insight.excerpt,
  };
}

export default function InsightPage({ params }: InsightPageProps) {
  const insight = getInsight(params.slug);

  if (!insight) {
    notFound();
  }

  const related = INSIGHTS.filter((item) => item.slug !== insight.slug);

  return (
    <div className="relative min-h-screen overflow-hidden bg-background lg:pr-[240px]">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-gradient-radial-glow" />

      <MarketingHeader />

      <main className="relative z-10 mx-auto max-w-3xl px-6 pb-24 pt-6">
        <Link
          href="/#insights"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#8AA0B4] transition-colors hover:text-teal-500"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Insights and regulatory updates
        </Link>

        <article className="mt-8">
          <div className="flex items-center gap-2 text-xs">
            <span className="rounded-full border border-teal-500/30 bg-teal-500/10 px-2.5 py-1 font-semibold text-teal-500">
              {insight.tag}
            </span>
            <span className="text-muted-foreground">{insight.date}</span>
          </div>

          <h1 className="mt-4 text-[32px] font-semibold leading-tight text-[#E8F0F7] text-balance sm:text-[40px]">
            {insight.title}
          </h1>

          <p className="mt-5 text-lg leading-relaxed text-[#8AA0B4]">{insight.standfirst}</p>

          <div className="mt-8 border-t border-surface-border pt-8">
            {insight.sections.map((section) => (
              <section key={section.heading ?? section.paragraphs[0]} className="mb-8 last:mb-0">
                {section.heading && (
                  <h2 className="mb-3 text-xl font-semibold text-[#E8F0F7]">{section.heading}</h2>
                )}
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph} className="mb-4 leading-relaxed text-[#8AA0B4] last:mb-0">
                    {paragraph}
                  </p>
                ))}
              </section>
            ))}
          </div>
        </article>

        <div className="mt-12 border-t border-surface-border pt-10">
          <h2 className="text-lg font-semibold text-[#E8F0F7]">More insights</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            {related.map((item) => (
              <Link key={item.slug} href={`/insights/${item.slug}`} className="group">
                <Card className="flex h-full flex-col rounded-[12px] p-6 transition-all duration-300 group-hover:-translate-y-1 group-hover:border-teal-500/40 group-hover:shadow-glow">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="rounded-full border border-teal-500/30 bg-teal-500/10 px-2.5 py-1 font-semibold text-teal-500">
                      {item.tag}
                    </span>
                    <span className="text-muted-foreground">{item.date}</span>
                  </div>
                  <h3 className="mt-3 font-semibold leading-snug text-[#E8F0F7]">{item.title}</h3>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-teal-500">
                    Read more
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </main>

      <div className="relative z-10">
        <ToolFooter />
      </div>
    </div>
  );
}
