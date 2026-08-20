import type { Metadata } from "next";
import { MarketingHeader } from "@/components/intellocalc/marketing-header";
import { ToolFooter } from "@/components/intellocalc/tool-footer";
import { FaqAccordion } from "@/components/faq/faq-accordion";
import { formatLongDeadline, getNextCctsDeadline } from "@/lib/compliance-deadlines";

// Answers quoting a deadline are computed at render time; revalidate hourly so
// a statically rendered page cannot serve a date that has already passed.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "FAQ — Intellocarbon",
  description:
    "Answers to common questions about CCTS thresholds and deadlines, CBAM reporting and carbon price already paid in India, and how the Intellocarbon platform works.",
};

// The compliance-deadline answer is computed from the shared calendar rather
// than written as a literal, which went stale the day the date passed.
const nextCcts = getNextCctsDeadline();

const CCTS_FAQS = [
  {
    question: "What is the CCTS threshold for my sector?",
    answer:
      "For Iron & Steel, the CCTS threshold is 30,000 TPA of installed capacity. Thresholds vary by sector — check your sector-specific notification under S.O. 2825(E) 2023 for the exact figure that applies to you.",
  },
  {
    question: "What is my compliance deadline?",
    answer: `${formatLongDeadline(nextCcts.date)}, for submission of verified emissions intensity data for ${nextCcts.fyLabel}.`,
  },
  {
    question: "What happens if I miss the deadline or don't meet my target?",
    answer:
      "A penalty of 2x the market Carbon Credit Certificate (CCC) price is levied on your shortfall tonnage.",
  },
  {
    question: "What is my baseline year?",
    answer: "FY 2023-24 — fixed for all obligated entities under CCTS.",
  },
  {
    question: "How often is CCTS verified?",
    answer: "Once per year, by a BEE-accredited Accredited Carbon Verification Agency (ACVA).",
  },
  {
    question: "What does the CCTS dashboard actually show between compliance deadlines?",
    answer:
      "Your position against your own notified target, kept live rather than reconstructed at the deadline. GHG emissions intensity is charted period by period against the target your entity registered — CCTS targets are notified per obligated entity, so it is your target on the chart, never a sector average inferred on your behalf. Your CCC position follows from it in credits: a surplus you could sell, or a shortfall you would need to cover. Your targets across compliance years are drawn as your own multi-year trajectory, with any year you hold no notified target for left as a gap rather than filled in. And the annual cycle counts down to 31 July, naming the financial year that date settles. On price: Carbon Credit Certificates only become tradable on the Indian Energy Exchange in October 2026, so until then the dashboard states that the market is not yet open and your position stays in credits. It will not put a rupee value on a certificate that has never traded.",
  },
];

const CBAM_FAQS = [
  {
    question: "What is the CBAM threshold?",
    answer:
      "50 tonnes per year of covered goods exported to the EU — there is no minimum production capacity requirement.",
  },
  {
    question: "Does CBAM apply to my whole production?",
    answer: "No — only the quantity you export to the EU is in scope. Domestic and non-EU export volumes are excluded.",
  },
  {
    question: "What is SEE?",
    answer:
      "Specific Embedded Emissions — tCO2e per tonne of product. It's compared against a fixed EU default value, not against your own historical baseline.",
  },
  {
    question: "How often is CBAM reported?",
    answer:
      "Quarterly, to the EU CBAM registry. The underlying Communication Package that supports those figures is verified once a year.",
  },
  {
    question: "Can carbon price paid in India reduce my CBAM liability?",
    answer:
      "Yes — Intellocarbon automatically accounts for carbon price already paid in India when calculating your CBAM liability.",
  },
  {
    question: "Does Intellocarbon support UK CBAM as well as EU CBAM?",
    answer:
      "Yes. Both are covered by the CBAM Compliance plan at no additional charge — there is no separate UK subscription and no second data entry. If you export to both markets, the platform holds each position separately, because the two mechanisms price a different set of emissions and settle at different rates.",
  },
  {
    question: "What is the difference between UK CBAM and EU CBAM?",
    answer:
      "Three differences matter in practice. The UK mechanism starts on 1 January 2027, a year after the EU's. It covers a narrower set of goods — aluminium, cement, fertilisers, hydrogen and iron & steel — and excludes electricity, which the EU mechanism covers. And in its opening years it prices a narrower set of emissions than the EU does: the electricity-related emissions of your goods, which already count towards your EU position, are deferred in the UK until 2029 at the earliest. The same shipment can therefore carry a different liability in each market.",
  },
  {
    question: "What does the CBAM dashboard actually show between reporting windows?",
    answer:
      "Your current position, kept live rather than reconstructed at deadline. The certificate reference price is charted quarter by quarter as the European Commission publishes it, so you can see the direction of travel rather than only today's figure. Your facility's Specific Embedded Emissions are shown against the EU default value that would otherwise be applied to your goods, with the gap quantified. And a board-ready summary of the current position — emissions, liability and the price it was calculated at — exports as a PDF in one click, without waiting for a reporting window to open.",
  },
  {
    question: "When do I need to start UK CBAM compliance?",
    answer:
      "The mechanism takes effect on 1 January 2027. The first accounting period runs that full calendar year, with the return due by 31 May 2028; reporting moves to a quarterly rhythm from 2028. In practice the work starts earlier — the return is built from a full year of production data, so the figures need to be accumulating from January 2027 rather than reconstructed in 2028.",
  },
  {
    question: "Does Intellocarbon support the Green Steel Taxonomy?",
    answer:
      "Yes, for steel-sector clients, and it is included in the CBAM Compliance plan at no extra cost — there is no separate Green Steel subscription. The Ministry of Steel's Taxonomy of Green Steel (Gazette Notification 763(E), December 2024) becomes enforceable from FY2026-27 and rates steel by emissions intensity: below 1.6 tCO2e per tonne of finished steel is five-star, 1.6 to 2.0 is four-star, 2.0 to 2.2 is three-star, and steel at or above 2.2 is not rated. The platform calculates your intensity from the activity data you already enter for CBAM, so the band sits alongside your CBAM liability rather than needing a separate exercise. Two limits worth being clear about: this applies to steel only — it has no bearing on cement, aluminium, fertiliser or hydrogen facilities — and Intellocarbon does not certify. Certification is issued by NISST, the National Institute of Secondary Steel Technology, through its own verification process. What you get here is the calculation and a working summary of how it was derived, to carry into that submission.",
  },
];

const ESG_FAQS = [
  {
    question: "What is BRSR Core and do I need it?",
    answer:
      "BRSR Core is SEBI's mandatory subset of Business Responsibility and Sustainability Reporting — 9 ESG attributes covering GHG footprint, water, waste, energy, workforce, diversity, inclusion, openness of business, and customer fairness. Intellocarbon's BRSR Core module reuses your existing CBAM/CCTS GHG data automatically and only asks you to fill in the other 8 attributes.",
  },
  {
    question: "Is BRSR mandatory for my company?",
    answer:
      "Only the top 1,000 listed companies by market capitalisation are directly mandated to file BRSR. However, MSME suppliers to those companies increasingly receive BRSR data requests from their buyers under SEBI's value-chain disclosure rules — so even if you're not directly mandated, you may need this data to keep a large customer.",
  },
  {
    question: "Do you track water footprint?",
    answer:
      "Yes — water is part of the ESG Disclosure Bundle, inventoried to ISO 14046. You record withdrawal and discharge per source, and consumption follows as the difference between them; freshwater abstraction is separated from water you have already reclaimed on site. It runs off the same facility-level data entry you already use for emissions, so a reporting period gives you both without keeping a second set of records.",
  },
  {
    question: "Can I track voluntary carbon credits I have purchased?",
    answer:
      "Yes, as a record of purchases made elsewhere. You log each credit against the facility it relates to — registry, serial number, tonnage, vintage year, and whether it is an avoidance or removal credit — and the platform shows those retirements against the emissions that remain after your reduction work. Intellocarbon does not issue, verify, rate or endorse carbon credits, and buying them through us is not possible: this is a tracking tool for credits you have sourced yourself, so that the claim and the footprint it refers to are recorded in one place.",
  },
  {
    question: "What ESG frameworks do you cover?",
    answer:
      "BRSR Core, ISSB IFRS S1/S2, GRI Standards 2021, CSRD/ESRS, CDP Climate Change, Scope 3 value-chain emissions, water footprint to ISO 14046, and voluntary offset tracking — all in one ESG Disclosure Bundle, at one price per facility, generated from the same activity data you already enter.",
  },
  {
    question: "What ESG metrics can I track beyond BRSR and GRI?",
    answer:
      "The bundle carries a set of trackers that read the emissions, energy, waste and governance data you have already entered, so none of them ask for a second round of data collection. Waste and circularity gives you the share diverted against total generated, trended rather than a single figure. Energy mix shows renewable share over time. Reduction targets records the target you have stated and measures progress against your submitted emissions. There is a renewable energy certificate ledger with coverage against grid electricity, a governance view built from the GRI 2 and BRSR answers already on file, a per-supplier ESG scorecard that goes beyond the aggregate percentages GRI 308 and 414 ask for, sector benchmarking against published reference values, a net-zero trajectory chart, and an indicative product carbon footprint per SKU. All of it is included in the ESG Disclosure Bundle at the same per-facility price. Two of these deserve a plain caveat: reduction targets are self-reported and Intellocarbon neither validates them nor has any relationship with the Science Based Targets initiative, and the per-SKU footprint is an allocation of facility emissions by production share, not a life cycle assessment. Where no reliable public benchmark exists for a sector, the benchmarking view says so rather than showing a number.",
  },
  {
    question: "What is EcoVadis readiness?",
    answer:
      "It maps the data you already hold in the platform against the four themes an EcoVadis assessment covers — Environment, Labour and Human Rights, Ethics, and Sustainable Procurement — and reports how complete you are in each, so you can see where the gaps are before you start a submission. It is a readiness indicator and nothing more. It is not a predicted EcoVadis score, it does not forecast a medal, and it carries no standing with EcoVadis: only EcoVadis scores an EcoVadis submission, against its own methodology and its own evidence requirements. The value is in knowing which theme is thin while there is still time to fix it, rather than discovering it mid-assessment. It is included in the ESG Disclosure Bundle.",
  },
  {
    question: "Does Intellocarbon support GRI reporting?",
    answer:
      "Yes — the full GRI Standards 2021, not a subset. You start with a GRI 3 materiality assessment: you record the actual and potential impacts your operations have, and that assessment determines which Topic Standards your report covers, so you disclose what is material to your facility rather than working through every topic. The report includes the GRI 2 General Disclosures, a management approach for each material topic, and the GRI content index required alongside it — with a stated reason recorded against anything not reported. Emissions, energy and water figures are reused from data you have already entered.",
  },
  {
    question: "Can a GRI report claim to be 'in accordance' with the Standards?",
    answer:
      "Only when it genuinely qualifies. GRI allows the stronger 'in accordance' claim only if every one of its reporting requirements is met; otherwise a report may claim 'with reference to' the Standards. The platform checks this for you and shows exactly what is outstanding while you work, and the generated report carries whichever claim your disclosure actually supports — it will not assert full compliance on an incomplete report.",
  },
  {
    question: "When will CSRD and CDP be available?",
    answer: "These are in active development — join the waitlist on the ESG page to be notified per framework.",
  },
];

const GENERAL_FAQS = [
  {
    question: "Why is the subscription monthly if reports are annual/quarterly?",
    answer:
      "The report is just the output. All year round, the platform manages your continuous data entry, gives you a live compliance-position dashboard, sends deadline alerts, and keeps emission factors and certificate prices updated automatically.",
  },
  {
    question: "Do you have a list of verifiers?",
    answer:
      "Verification happens inside the platform's verifier portal. Intellocarbon is onboarding BEE-accredited ACVAs and EU-accredited CBAM verifiers as partners.",
  },
  {
    question: "Is the verification fee included in the subscription?",
    answer:
      "No — it's kept separate. Your platform fee covers data entry, calculation, and reporting; the verifier's fee is paid directly to the ACVA.",
  },
];

function FaqSection({ title, items }: { title: string; items: typeof CCTS_FAQS }) {
  return (
    <section className="border-t border-surface-border py-14">
      <h2 className="text-2xl font-semibold text-[#E8F0F7]">{title}</h2>
      <div className="mt-6">
        <FaqAccordion items={items} />
      </div>
    </section>
  );
}

export default function FaqPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background lg:pr-[240px]">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-gradient-radial-glow" />

      <MarketingHeader />

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-4xl px-6 pb-16 pt-10 text-center">
        <h1 className="text-[36px] font-semibold leading-tight text-[#E8F0F7] text-balance sm:text-[48px]">
          Frequently asked questions
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-balance text-[#8AA0B4] sm:text-lg">
          CCTS thresholds and deadlines, CBAM reporting and deductions, BRSR Core and ESG, and how the platform
          works.
        </p>
      </section>

      <main className="relative z-10 mx-auto max-w-3xl px-6 pb-24">
        <FaqSection title="CCTS" items={CCTS_FAQS} />
        <FaqSection title="CBAM" items={CBAM_FAQS} />
        <FaqSection title="ESG & BRSR" items={ESG_FAQS} />
        <FaqSection title="General / Platform" items={GENERAL_FAQS} />
      </main>

      <div className="relative z-10">
        <ToolFooter />
      </div>
    </div>
  );
}
