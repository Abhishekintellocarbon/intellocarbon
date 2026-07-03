import type { Metadata } from "next";
import { AnnouncementBar } from "@/components/intellocalc/announcement-bar";
import { MarketingHeader } from "@/components/intellocalc/marketing-header";
import { ToolHero } from "@/components/intellocalc/tool-hero";
import { ToolFooter } from "@/components/intellocalc/tool-footer";
import { BorderTool } from "@/components/intellocalc/border-tool";

export const metadata: Metadata = {
  title: "IntelloCalc Border — Free CBAM Exposure Estimator India 2026 | Intellocarbon",
  description:
    "Find out your EU carbon border exposure in seconds. Free CBAM liability estimator for Indian exporters — no account needed.",
};

export default function BorderPage() {
  return (
    <div className="min-h-screen bg-background">
      <AnnouncementBar />
      <MarketingHeader />
      <ToolHero
        eyebrow="IntelloCalc Border"
        title="IntelloCalc Border"
        tagline="Measure once. Comply everywhere."
        heroText="Find out your EU carbon border exposure in seconds. No account needed."
      />
      <main className="mx-auto max-w-6xl px-6 py-12">
        <BorderTool />
      </main>
      <ToolFooter />
    </div>
  );
}
