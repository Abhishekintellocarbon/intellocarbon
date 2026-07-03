import type { Metadata } from "next";
import { AnnouncementBar } from "@/components/intellocalc/announcement-bar";
import { MarketingHeader } from "@/components/intellocalc/marketing-header";
import { ToolHero } from "@/components/intellocalc/tool-hero";
import { ToolFooter } from "@/components/intellocalc/tool-footer";
import { IndiaTool } from "@/components/intellocalc/india-tool";

export const metadata: Metadata = {
  title: "IntelloCalc India — Free CCTS GHG Intensity Checker | Intellocarbon",
  description:
    "Check your India carbon compliance position instantly. Know if you earn or buy credits under India's Carbon Credit Trading Scheme — free, no account needed.",
};

export default function IndiaPage() {
  return (
    <div className="min-h-screen bg-background">
      <AnnouncementBar />
      <MarketingHeader />
      <ToolHero
        eyebrow="IntelloCalc India"
        title="IntelloCalc India"
        tagline="Measure once. Comply everywhere."
        heroText="Check your India carbon compliance position instantly. Know if you earn or buy credits."
      />
      <main className="mx-auto max-w-6xl px-6 py-12">
        <IndiaTool />
      </main>
      <ToolFooter />
    </div>
  );
}
