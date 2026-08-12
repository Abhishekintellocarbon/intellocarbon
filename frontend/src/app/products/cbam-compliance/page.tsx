import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import {
  MockChrome,
  ProductPage,
  ProductSection,
  demoMailto,
} from "@/components/marketing/product-page";

export const metadata: Metadata = {
  title: "CBAM Compliance — Intellocarbon",
  description:
    "Precision emissions accounting, verified quarterly reporting, and regulatory relief mechanisms for Indian industrial exporters under the EU Carbon Border Adjustment Mechanism and the UK mechanism starting 2027.",
};

const QUARTERS = [
  {
    date: "1 January",
    period: "Q4 window (Oct — Dec)",
    detail: "Shipment-level embedded emissions consolidated for the closing quarter.",
  },
  {
    date: "1 April",
    period: "Q1 window (Jan — Mar)",
    detail: "Facility data reconciled against production routes and precursor inputs.",
  },
  {
    date: "1 July",
    period: "Q2 window (Apr — Jun)",
    detail: "Verified figures assembled into the importer communication package.",
  },
  {
    date: "1 October",
    period: "Q3 window (Jul — Sep)",
    detail: "Position carried forward against the annual declaration obligation.",
  },
];

function ComplianceCalendar() {
  return (
    <ProductSection
      title="Compliance Calendar"
      subtitle="CBAM is not an annual filing. Four reporting windows a year, each demanding shipment-level embedded emissions. The platform holds your position continuously between windows, and the regulatory ruleset is updated automatically as the Commission issues changes."
    >
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {QUARTERS.map((quarter) => (
          <Card key={quarter.date} className="rounded-[12px] p-6">
            <div className="flex items-center gap-2.5">
              <span className="h-2 w-2 shrink-0 rounded-full bg-teal-500" />
              <p className="text-sm font-semibold text-[#E8F0F7]">{quarter.date}</p>
            </div>
            <div className="mt-4 h-px w-full bg-surface-border" />
            <p className="mt-4 text-xs font-medium uppercase tracking-wide text-teal-500">
              {quarter.period}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-[#8AA0B4]">{quarter.detail}</p>
          </Card>
        ))}
      </div>

      <p className="mt-6 text-sm text-[#8AA0B4]">
        Between windows, the engine monitors regulatory changes, emission factor revisions and
        certificate pricing so your reported position stays current rather than reconstructed at
        deadline.
      </p>
    </ProductSection>
  );
}

/**
 * The UK mechanism, presented as its own section rather than folded into the
 * EU copy above: it is a separate regime on a separate calendar, and a reader
 * deciding whether they need it has to be able to tell the two apart. Kept to
 * what an exporter needs to act on — when it starts, what it costs them here,
 * and how it differs in shape from the EU regime. The scope mechanics belong
 * in the platform, not on a marketing page.
 */
function UkCbamSection() {
  return (
    <ProductSection
      title="The UK mechanism, from 2027"
      subtitle="The United Kingdom introduces its own carbon border adjustment mechanism on 1 January 2027, a year behind the EU. It is a separate regime with its own registration, its own calendar and its own rate — not an extension of the EU one — and exporters selling into both markets will carry both obligations at once."
    >
      <div className="grid gap-5 sm:grid-cols-3">
        <Card className="rounded-[12px] p-6">
          <p className="text-xs font-medium uppercase tracking-wide text-teal-500">Starts</p>
          <p className="mt-3 text-sm font-semibold text-[#E8F0F7]">1 January 2027</p>
          <p className="mt-2 text-sm leading-relaxed text-[#8AA0B4]">
            The first accounting period runs the full calendar year, with the return due by 31 May 2028.
            Reporting moves to a quarterly rhythm after that.
          </p>
        </Card>
        <Card className="rounded-[12px] p-6">
          <p className="text-xs font-medium uppercase tracking-wide text-teal-500">Covers</p>
          <p className="mt-3 text-sm font-semibold text-[#E8F0F7]">A narrower set of goods</p>
          <p className="mt-2 text-sm leading-relaxed text-[#8AA0B4]">
            Aluminium, cement, fertilisers, hydrogen and iron &amp; steel. Electricity, which the EU
            mechanism covers, is outside the UK&apos;s scope — so an EU position does not simply carry across.
          </p>
        </Card>
        <Card className="rounded-[12px] p-6">
          <p className="text-xs font-medium uppercase tracking-wide text-teal-500">Costs you</p>
          <p className="mt-3 text-sm font-semibold text-[#E8F0F7]">Nothing further</p>
          <p className="mt-2 text-sm leading-relaxed text-[#8AA0B4]">
            UK CBAM is included in the same CBAM Compliance plan as the EU mechanism. No separate
            subscription, no second data entry — the platform reports both from the figures you already keep.
          </p>
        </Card>
      </div>

      <p className="mt-6 text-sm text-[#8AA0B4]">
        The two regimes price a different set of emissions and settle at different rates, so the same
        shipment can carry a different liability in each market. The platform holds both positions
        separately rather than presenting one number for two obligations, and the UK rate is applied only
        once HMRC has published it.
      </p>
    </ProductSection>
  );
}

function ProofMockup() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="overflow-hidden rounded-[12px] border border-surface-border bg-surface shadow-card">
        <MockChrome label="CBAM Communication Package.pdf — sample (redacted)" />
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Installation
              </p>
              <p className="mt-1 h-3 w-40 rounded bg-surface-raised" />
            </div>
            <span className="shrink-0 rounded-full border border-teal-500/30 bg-teal-500/10 px-2.5 py-1 text-[10px] font-semibold text-teal-500">
              Verified
            </span>
          </div>

          <div className="mt-5 space-y-2">
            <div className="flex items-center justify-between rounded-lg bg-surface-raised px-3 py-2 text-xs">
              <span className="text-muted-foreground">Direct emissions</span>
              <span className="font-medium text-[#E8F0F7]">1,254 tCO2e</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-surface-raised px-3 py-2 text-xs">
              <span className="text-muted-foreground">Indirect emissions</span>
              <span className="font-medium text-[#E8F0F7]">342 tCO2e</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-surface-raised px-3 py-2 text-xs">
              <span className="text-muted-foreground">Precursor emissions</span>
              <span className="font-medium text-[#E8F0F7]">89 tCO2e</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-teal-500/30 bg-teal-500/10 px-3 py-2 text-xs">
              <span className="font-semibold text-teal-500">Specific Embedded Emissions</span>
              <span className="font-semibold text-teal-500">1.16 tCO2e/t</span>
            </div>
          </div>

          <div className="mt-5 space-y-2">
            <div className="h-2.5 w-full rounded bg-surface-raised" />
            <div className="h-2.5 w-11/12 rounded bg-surface-raised" />
            <div className="h-2.5 w-8/12 rounded bg-surface-raised" />
          </div>

          <p className="mt-5 text-center text-[11px] text-muted-foreground">
            Sample page — figures illustrative, identifying details redacted
          </p>
        </div>
      </div>

      <Card className="flex flex-col justify-center rounded-[12px] p-8">
        <h3 className="text-lg font-semibold text-[#E8F0F7]">What the package contains</h3>
        <ul className="mt-4 space-y-3 text-sm leading-relaxed text-[#8AA0B4]">
          <li>Installation and production route identification, traceable to source records.</li>
          <li>
            Direct, indirect and precursor emissions resolved separately, each citing the emission
            factor applied.
          </li>
          <li>
            Specific Embedded Emissions per tonne of goods, benchmarked against the applicable EU
            default value.
          </li>
          <li>Verifier attestation and the supporting Annex VI evidence trail.</li>
        </ul>
      </Card>
    </div>
  );
}

export default function CbamCompliancePage() {
  return (
    <ProductPage
      eyebrow="EU & UK CBAM"
      headline="Know your CBAM liability before it lands."
      subhead="Sophisticated Scope 1 & 2 emissions intelligence, verified reporting, and regulatory relief mechanisms — engineered specifically for Indian industrial exporters."
      primaryCta={{ label: "See your CBAM exposure", href: "/intellocalc/border" }}
      secondaryCta={{
        label: "Request a demo",
        href: demoMailto("Demo request — CBAM compliance"),
      }}
      trustChips={[
        "EU CBAM Regulation 2023/956",
        "Updated automatically as rules change",
        "Data hosted securely in India",
      ]}
      challengeSubtitle="What carbon border adjustment — the EU mechanism now, the UK's from 2027 — actually creates for Indian exporters."
      challenges={[
        "Emissions data sits scattered across mills and facilities — in spreadsheets, invoices and plant logs that were never built to produce a regulatory figure.",
        "There is no standardised methodology Indian exporters can rely on, so two competent teams working from the same plant data can arrive at different declared emissions.",
        "Quarterly reporting is handled manually, which makes it error-prone and difficult to reproduce when an importer or verifier questions a number.",
        "EU default values frequently overstate real liability, and without a defensible facility-specific figure there is no way to prove otherwise.",
      ]}
      capabilities={[
        {
          title: "Precision emissions accounting",
          description:
            "Combustion, process and indirect sources are each modelled against their own methodology, at facility and production-route level, with every emission factor cited back to published regulation.",
        },
        {
          title: "Proprietary comparison engine",
          description:
            "Your verified footprint is measured against the applicable EU benchmark, quantifying the gap between actual embedded emissions and the default values that would otherwise be applied to your goods.",
        },
        {
          title: "Cross-framework relief",
          description:
            "For exporters also facing EU carbon obligations, our engine identifies where domestic carbon costs already reduce international exposure — calculated with a precision built specifically for dual-framework compliance.",
        },
        {
          title: "Verifier portal, built in",
          description:
            "An accredited verifier works inside the platform against the Annex VI checklist, with the evidence trail attached to each figure rather than exchanged over email.",
        },
      ]}
      featureSection={
        <>
          <ComplianceCalendar />
          <UkCbamSection />
        </>
      }
      proofTitle="Proof"
      proofSubtitle="A redacted page from a CBAM Communication Package generated by the platform."
      proof={<ProofMockup />}
      closeHeadline="See what your real CBAM position looks like."
      closeSubhead="Walk through the platform with our team using your own production and export data."
      demoSubject="Demo request — CBAM compliance"
      crossLinks={[
        { label: "See CCTS", href: "/products/ccts-carbon-markets" },
        { label: "See ESG", href: "/esg" },
      ]}
    />
  );
}
