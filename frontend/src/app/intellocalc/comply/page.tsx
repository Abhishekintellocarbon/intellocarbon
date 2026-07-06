import type { Metadata } from "next";
import { AnnouncementBar } from "@/components/intellocalc/announcement-bar";
import { MarketingHeader } from "@/components/intellocalc/marketing-header";
import { ToolHero } from "@/components/intellocalc/tool-hero";
import { ToolFooter } from "@/components/intellocalc/tool-footer";
import { ComplyTool } from "@/components/intellocalc/comply-tool";

export const metadata: Metadata = {
  title: "IntelloCalc Comply — Find Which Carbon Compliance Frameworks Apply to You | Intellocarbon",
  description:
    "Answer 5 questions. Know exactly which carbon compliance frameworks — CBAM, CCTS, and EPR — apply to your business. Free, no account needed.",
};

export default function ComplyPage() {
  return (
    <div className="min-h-screen bg-background lg:pr-[240px]">
      <AnnouncementBar />
      <MarketingHeader />
      <ToolHero
        eyebrow="IntelloCalc Comply"
        title="IntelloCalc Comply"
        tagline="Measure once. Comply everywhere."
        heroText="Answer 5 questions. Know exactly which frameworks you must comply with."
      />
      <main className="mx-auto max-w-6xl px-6 py-12">
        <ComplyTool />
      </main>
      <ToolFooter />
    </div>
  );
}
