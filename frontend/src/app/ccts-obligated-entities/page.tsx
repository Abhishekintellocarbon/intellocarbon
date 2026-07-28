import type { Metadata } from "next";
import { MarketingHeader } from "@/components/intellocalc/marketing-header";
import { ToolFooter } from "@/components/intellocalc/tool-footer";
import { CctsObligatedEntitiesExplorer } from "@/components/ccts/ccts-obligated-entities-explorer";

export const metadata: Metadata = {
  title: "CCTS Obligated Entities Tracker | Intellocarbon",
  description:
    "Check which companies and plants BEE has named as obligated under India's Carbon Credit Trading Scheme (CCTS), sourced from published gazette notifications.",
};

export default function CctsObligatedEntitiesPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background lg:pr-[240px]">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-gradient-radial-glow" />

      <MarketingHeader />

      <section className="relative z-10 mx-auto max-w-4xl px-6 pb-10 pt-10 text-center">
        <h1 className="text-[32px] font-semibold leading-tight text-[#E8F0F7] text-balance sm:text-[42px]">
          CCTS Obligated Entities Tracker
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-balance text-[#8AA0B4] sm:text-lg">
          Check which companies and plants BEE has named as obligated under India&apos;s Carbon Credit Trading
          Scheme, sourced from published gazette notifications.
        </p>
      </section>

      <main className="relative z-10 mx-auto max-w-6xl px-6 pb-24">
        <CctsObligatedEntitiesExplorer />
      </main>

      <div className="relative z-10">
        <ToolFooter />
      </div>
    </div>
  );
}
