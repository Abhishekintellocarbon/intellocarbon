import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import {
  MockChrome,
  ProductPage,
  ProductSection,
  demoMailto,
} from "@/components/marketing/product-page";

export const metadata: Metadata = {
  title: "ESG & BRSR Reporting — Intellocarbon",
  description:
    "BRSR Core, ISSB IFRS S1/S2 and full Scope 1-2-3 accounting engineered from a single data foundation, built to scale as global disclosure standards evolve.",
};

const HORIZON = [
  {
    name: "GRI",
    detail:
      "Universal and topic-specific disclosures mapped onto the same underlying data foundation, reusing the emissions and social metrics already captured.",
  },
  {
    name: "CSRD",
    detail:
      "European Sustainability Reporting Standards structures being engineered in for Indian suppliers drawn into their customers' reporting boundary.",
  },
  {
    name: "CDP",
    detail:
      "Questionnaire responses derived from the verified figures already held in the platform, rather than compiled separately each cycle.",
  },
];

function BuiltForWhatsComing() {
  return (
    <ProductSection
      title="Built for What's Coming"
      subtitle="Disclosure obligations are converging, not settling. GRI, CSRD and CDP are being engineered into the same data foundation that already powers BRSR Core and ISSB S1/S2 — so an expanding requirement becomes an extension of your existing data, not a new system."
    >
      <div className="grid gap-5 sm:grid-cols-3">
        {HORIZON.map((framework) => (
          <Card key={framework.name} className="rounded-[12px] p-6">
            <div className="flex items-center justify-between gap-3">
              <p className="text-base font-semibold text-[#E8F0F7]">{framework.name}</p>
              <span className="shrink-0 rounded-full border border-surface-border bg-surface-raised px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#8AA0B4]">
                In engineering
              </span>
            </div>
            <div className="mt-4 h-px w-full bg-surface-border" />
            <p className="mt-4 text-sm leading-relaxed text-[#8AA0B4]">{framework.detail}</p>
          </Card>
        ))}
      </div>

      <p className="mt-6 text-sm text-[#8AA0B4]">
        The data foundation is designed so that a new framework is a mapping exercise over records
        you already hold — not a second round of data collection.
      </p>
    </ProductSection>
  );
}

const CHART_BARS = [
  { label: "S1", height: 72, color: "#00D4AA" },
  { label: "S2", height: 44, color: "#4A9EFF" },
  { label: "C1", height: 90, color: "#00D4AA" },
  { label: "C4", height: 58, color: "#4A9EFF" },
  { label: "C6", height: 30, color: "#00D4AA" },
  { label: "C11", height: 66, color: "#4A9EFF" },
];

function ProofMockup() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="overflow-hidden rounded-[12px] border border-surface-border bg-surface shadow-card">
        <MockChrome label="BRSR Core Report.pdf — sample (redacted)" />
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Listed entity
              </p>
              <p className="mt-1 h-3 w-40 rounded bg-surface-raised" />
            </div>
            <span className="shrink-0 rounded-full border border-teal-500/30 bg-teal-500/10 px-2.5 py-1 text-[10px] font-semibold text-teal-500">
              Assurance ready
            </span>
          </div>

          <p className="mt-5 text-[11px] text-muted-foreground">
            Emissions by scope and Scope 3 category (tCO2e)
          </p>
          <div className="mt-3 flex h-28 items-end gap-2">
            {CHART_BARS.map((bar) => (
              <div key={bar.label} className="flex flex-1 flex-col items-center gap-1.5">
                <div
                  className="w-full rounded-t-md"
                  style={{ height: `${bar.height}%`, backgroundColor: bar.color }}
                />
                <span className="text-[9px] text-muted-foreground">{bar.label}</span>
              </div>
            ))}
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-surface-border bg-surface-raised p-2.5 text-center">
              <p className="text-[10px] text-muted-foreground">Scope 1</p>
              <p className="mt-0.5 text-xs font-semibold text-[#E8F0F7]">1,254 t</p>
            </div>
            <div className="rounded-lg border border-surface-border bg-surface-raised p-2.5 text-center">
              <p className="text-[10px] text-muted-foreground">Scope 2</p>
              <p className="mt-0.5 text-xs font-semibold text-[#E8F0F7]">342 t</p>
            </div>
            <div className="rounded-lg border border-surface-border bg-surface-raised p-2.5 text-center">
              <p className="text-[10px] text-muted-foreground">Scope 3</p>
              <p className="mt-0.5 text-xs font-semibold text-teal-500">8,910 t</p>
            </div>
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
            The nine BRSR Core attributes, each traced back to the underlying operational record.
          </li>
          <li>
            ISSB IFRS S1/S2 disclosures drawn from the same figures, with governance and risk
            narrative attached.
          </li>
          <li>
            Full Scope 1, 2 and 3 accounting, with Scope 3 resolved by category rather than as a
            single estimated total.
          </li>
          <li>
            An evidence structure built for SEBI&apos;s phased reasonable-assurance requirements.
          </li>
        </ul>
      </Card>
    </div>
  );
}

export default function EsgBrsrPage() {
  return (
    <ProductPage
      eyebrow="ESG & Sustainability Disclosure"
      headline="One disclosure engine. Every framework investors and buyers ask for."
      subhead="BRSR Core, ISSB IFRS S1/S2, and Scope 3 — engineered from a single data foundation, built to scale as global standards evolve."
      primaryCta={{
        label: "Request a demo",
        href: demoMailto("Demo request — ESG & BRSR reporting"),
      }}
      secondaryCta={{ label: "Explore the ESG suite", href: "/esg" }}
      trustChips={[
        "SEBI BRSR Framework",
        "ISSB IFRS S1/S2",
        "GHG Protocol",
        "Data hosted securely in India",
      ]}
      challengeSubtitle="What expanding sustainability disclosure actually creates for Indian companies and their suppliers."
      challenges={[
        "Listed companies and their suppliers face mandatory, expanding disclosure obligations, with assurance requirements arriving in phases rather than all at once.",
        "Most tools force a separate system per framework, which duplicates data entry and multiplies the risk of two disclosures disagreeing on the same figure.",
        "Scope 3 — the hardest category, and the largest for most industrial value chains — is usually bolted on afterwards rather than built into the data model.",
        "Assurance requirements are tightening faster than most platforms keep pace with, leaving reported figures without the evidence trail an assurer will ask for.",
      ]}
      capabilities={[
        {
          title: "A single data foundation",
          description:
            "One set of operational records powers BRSR Core's nine attributes, ISSB S1/S2 disclosures and full Scope 1-2-3 accounting — entered once, reconciled across every framework.",
        },
        {
          title: "Genuine Scope 3 modelling",
          description:
            "Value-chain emissions are modelled across the categories most relevant to Indian value chains, with methodology and factors cited per category — not a checkbox estimate.",
        },
        {
          title: "Assurance-ready structure",
          description:
            "Every disclosed figure carries its calculation basis and supporting evidence, structured for SEBI's phased reasonable-assurance timeline.",
        },
        {
          title: "The most comprehensive tier",
          description:
            "The widest scope the platform offers, spanning full value-chain emissions alongside the governance and social disclosures investors and buyers now require.",
        },
      ]}
      featureSection={<BuiltForWhatsComing />}
      proofTitle="Proof"
      proofSubtitle="A redacted page from a BRSR Core Report generated by the platform."
      proof={<ProofMockup />}
      closeHeadline="See every framework running off one data foundation."
      closeSubhead="Walk through the platform with our team using your own disclosure requirements."
      demoSubject="Demo request — ESG & BRSR reporting"
      crossLinks={[
        { label: "See CBAM", href: "/products/cbam-compliance" },
        { label: "See CCTS", href: "/products/ccts-carbon-markets" },
      ]}
    />
  );
}
