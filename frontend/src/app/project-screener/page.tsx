import type { Metadata } from "next";
import { MarketingHeader } from "@/components/intellocalc/marketing-header";
import { ToolFooter } from "@/components/intellocalc/tool-footer";
import { ScreenerExplainer } from "@/components/project-screener/screener-explainer";
import { ScreenerDisclaimer } from "@/components/project-screener/screener-disclaimer";
import { ProjectScreenerTool } from "@/components/project-screener/project-screener-tool";

export const metadata: Metadata = {
  title: "Project Eligibility Screener — Carbon Project Screening | Intellocarbon",
  description:
    "Free indicative screening for voluntary carbon market projects. See which registry track — India's ICM or international — and which market category your project is likely to fall into. No account needed.",
};

/**
 * A standalone public page, deliberately not an IntelloCalc tool.
 *
 * The IntelloCalc tools screen an entity's own compliance position (CBAM,
 * CCTS, EPR). This screens a project that would generate credits in the
 * voluntary market — a different subject, a different audience, and a
 * different set of registries — so it carries its own top-level nav entry and
 * is absent from the IntelloCalc tools panel and the /intellocalc hub.
 *
 * The page shell (grid background, radial glow, header, lg:pr-[240px] for the
 * site-wide tools panel, ToolFooter) matches every other marketing page; that
 * offset is the site layout, not an IntelloCalc marker.
 */
export default function ProjectScreenerPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background lg:pr-[240px]">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-gradient-radial-glow" />

      <MarketingHeader />

      <section className="relative z-10 mx-auto max-w-4xl px-6 pb-12 pt-10 text-center">
        <span className="inline-flex items-center rounded-full border border-teal-500/30 bg-teal-500/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-teal-500">
          Free · No account needed
        </span>
        <h1 className="mt-4 text-[36px] font-semibold leading-tight text-[#E8F0F7] text-balance sm:text-[48px]">
          Project Eligibility Screener
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-balance text-[#8AA0B4] sm:text-lg">
          An indicative read on which carbon registry track your project is likely to fit, and which of the
          voluntary market&apos;s four categories it falls into.
        </p>
      </section>

      <main className="relative z-10 mx-auto max-w-6xl px-6 pb-24">
        <ScreenerExplainer />

        {/* Before the questionnaire — and again beside the results. */}
        <div className="mt-8">
          <ScreenerDisclaimer />
        </div>

        <div className="mt-8">
          <ProjectScreenerTool />
        </div>

        <ToolFooter />
      </main>
    </div>
  );
}
