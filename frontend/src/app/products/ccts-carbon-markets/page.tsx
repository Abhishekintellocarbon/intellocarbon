import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import {
  MockChrome,
  ProductPage,
  ProductSection,
  demoMailto,
} from "@/components/marketing/product-page";

export const metadata: Metadata = {
  title: "CCTS & Carbon Markets — Intellocarbon",
  description:
    "Precision GHG intensity tracking, entity-specific target monitoring and Carbon Credit Certificate positioning for India's Carbon Credit Trading Scheme.",
};

const CYCLE = [
  {
    date: "1 April",
    period: "Compliance year opens",
    detail:
      "Facility boundaries, production units and the notified target for the entity are established for the year ahead.",
  },
  {
    date: "Through the year",
    period: "Continuous intensity tracking",
    detail:
      "Fuel, process and electricity data resolve into a running GHG intensity measured against the notified target.",
  },
  {
    date: "31 March",
    period: "Compliance year closes",
    detail:
      "The Indian financial year ends and the year's verified intensity position is locked for reporting.",
  },
  {
    date: "Post-year",
    period: "Verification and settlement",
    detail:
      "ACVA verification runs against the submitted data, followed by certificate issuance or surrender on the registry.",
  },
];

function ComplianceCalendar() {
  return (
    <ProductSection
      title="Compliance Calendar"
      subtitle="CCTS runs on the Indian financial year — 1 April to 31 March. Your intensity position is not something to reconstruct in March; the platform tracks it across the whole cycle and updates the ruleset automatically as BEE notifies new targets and sectors."
    >
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {CYCLE.map((stage) => (
          <Card key={stage.date} className="rounded-[12px] p-6">
            <div className="flex items-center gap-2.5">
              <span className="h-2 w-2 shrink-0 rounded-full bg-teal-500" />
              <p className="text-sm font-semibold text-[#E8F0F7]">{stage.date}</p>
            </div>
            <div className="mt-4 h-px w-full bg-surface-border" />
            <p className="mt-4 text-xs font-medium uppercase tracking-wide text-teal-500">
              {stage.period}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-[#8AA0B4]">{stage.detail}</p>
          </Card>
        ))}
      </div>

      <div className="mt-6 overflow-hidden rounded-[12px] border border-surface-border bg-surface p-6 shadow-card">
        <div className="flex items-center justify-between text-xs text-[#8AA0B4]">
          <span>1 April</span>
          <span>Compliance year</span>
          <span>31 March</span>
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-surface-raised">
          <div className="h-full w-[62%] rounded-full bg-gradient-teal-blue" />
        </div>
        <p className="mt-3 text-sm text-[#8AA0B4]">
          Position monitored continuously through the year, not assembled at the deadline.
        </p>
      </div>
    </ProductSection>
  );
}

function ProofMockup() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="overflow-hidden rounded-[12px] border border-surface-border bg-surface shadow-card">
        <MockChrome label="CCTS GHG Intensity Report.pdf — sample (redacted)" />
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Obligated entity
              </p>
              <p className="mt-1 h-3 w-40 rounded bg-surface-raised" />
            </div>
            <span className="shrink-0 rounded-full border border-teal-500/30 bg-teal-500/10 px-2.5 py-1 text-[10px] font-semibold text-teal-500">
              FY 2025-26
            </span>
          </div>

          <p className="mt-5 text-[11px] text-muted-foreground">Actual vs. notified target</p>
          <div className="mt-2 h-5 overflow-hidden rounded-full bg-surface-raised">
            <div className="h-full w-[68%] rounded-full bg-teal-500" />
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>1.16 tCO2e/t actual</span>
            <span>1.90 tCO2e/t target</span>
          </div>

          <div className="mt-5 rounded-lg border border-teal-500/30 bg-teal-500/10 p-3 text-center">
            <p className="text-[10px] text-muted-foreground">Certificate position</p>
            <p className="mt-1 text-lg font-semibold text-teal-500">Surplus of 1,530 tCO2e</p>
          </div>

          <div className="mt-5 space-y-2">
            <div className="h-2.5 w-full rounded bg-surface-raised" />
            <div className="h-2.5 w-10/12 rounded bg-surface-raised" />
          </div>

          <p className="mt-5 text-center text-[11px] text-muted-foreground">
            Sample page — figures illustrative, identifying details redacted
          </p>
        </div>
      </div>

      <Card className="flex flex-col justify-center rounded-[12px] p-8">
        <h3 className="text-lg font-semibold text-[#E8F0F7]">What the report contains</h3>
        <ul className="mt-4 space-y-3 text-sm leading-relaxed text-[#8AA0B4]">
          <li>
            Entity and facility identification mapped to the notified obligated-entity record.
          </li>
          <li>
            GHG intensity per unit of product, derived from fuel, process and electricity data with
            every factor cited.
          </li>
          <li>
            Surplus or deficit position against the entity&apos;s own notified target for the
            compliance year.
          </li>
          <li>Verification trail structured for the ACVA review that follows the year-end.</li>
        </ul>
      </Card>
    </div>
  );
}

export default function CctsCarbonMarketsPage() {
  return (
    <ProductPage
      eyebrow="India CCTS"
      headline="Your position in India's carbon market, always current."
      subhead="Precision GHG intensity tracking, target monitoring, and certificate positioning — built for India's Carbon Credit Trading Scheme."
      primaryCta={{ label: "Check your CCTS position", href: "/intellocalc/india" }}
      secondaryCta={{
        label: "Request a demo",
        href: demoMailto("Demo request — CCTS compliance"),
      }}
      trustChips={[
        "BEE S.O. 2825(E)",
        "Updated automatically as targets are notified",
        "Data hosted securely in India",
      ]}
      challengeSubtitle="What the Carbon Credit Trading Scheme actually creates for obligated Indian entities."
      challenges={[
        "Intensity targets are entity-specific rather than sector-wide, and most tools get this wrong by applying a single sector benchmark to every company in it.",
        "There is no unified way to track a surplus or deficit position against a notified target as the compliance year progresses.",
        "Certificate banking and trading decisions are taken without real visibility into where the year-end position will actually land.",
        "The sector-by-sector rollout means obligations shift as new notifications land, changing who is covered and on what basis.",
      ]}
      capabilities={[
        {
          title: "Facility-specific intensity calculation",
          description:
            "GHG intensity is computed at facility and product level and matched to the company's own registered target — not to a sector average that was never assigned to you.",
        },
        {
          title: "Real-time surplus and deficit positioning",
          description:
            "Your certificate position updates as operational data lands, so the year-end outcome is visible while there is still time to act on it.",
        },
        {
          title: "Cross-framework relief",
          description:
            "For companies also facing international carbon obligations, our engine identifies where domestic carbon costs already reduce overseas exposure — calculated with a precision built specifically for dual-framework compliance.",
        },
        {
          title: "Verification workflow, built in",
          description:
            "The evidence trail is assembled inside the platform against BEE's ACVA process, so verification runs on structured records rather than reassembled spreadsheets.",
        },
      ]}
      featureSection={<ComplianceCalendar />}
      proofTitle="Proof"
      proofSubtitle="A redacted page from a CCTS GHG Intensity Report generated by the platform."
      proof={<ProofMockup />}
      closeHeadline="See where your CCTS position actually stands."
      closeSubhead="Walk through the platform with our team using your own facility and production data."
      demoSubject="Demo request — CCTS compliance"
      crossLinks={[
        { label: "See CBAM", href: "/products/cbam-compliance" },
        { label: "See BRSR / ESG", href: "/products/esg-brsr" },
      ]}
    />
  );
}
