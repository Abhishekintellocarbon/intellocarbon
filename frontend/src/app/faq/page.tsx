import type { Metadata } from "next";
import { MarketingHeader } from "@/components/intellocalc/marketing-header";
import { ToolFooter } from "@/components/intellocalc/tool-footer";
import { FaqAccordion } from "@/components/faq/faq-accordion";

export const metadata: Metadata = {
  title: "FAQ — Intellocarbon",
  description:
    "Answers to common questions about CCTS thresholds and deadlines, CBAM reporting and Article 9 deduction, and how the Intellocarbon platform works.",
};

const CCTS_FAQS = [
  {
    question: "What is the CCTS threshold for my sector?",
    answer:
      "For Iron & Steel, the CCTS threshold is 30,000 TPA of installed capacity. Thresholds vary by sector — check your sector-specific notification under S.O. 2825(E) 2023 for the exact figure that applies to you.",
  },
  {
    question: "What is my compliance deadline?",
    answer: "31 July 2026, for submission of verified emissions intensity data for FY 2025-26.",
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
      "Yes — this is the Article 9 deduction. Intellocarbon calculates it automatically from the carbon price you've already paid in India.",
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
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-gradient-radial-glow" />

      <MarketingHeader />

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-4xl px-6 pb-16 pt-10 text-center">
        <h1 className="text-[36px] font-semibold leading-tight text-[#E8F0F7] text-balance sm:text-[48px]">
          Frequently asked questions
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-balance text-[#8AA0B4] sm:text-lg">
          CCTS thresholds and deadlines, CBAM reporting and deductions, and how the platform works.
        </p>
      </section>

      <main className="relative z-10 mx-auto max-w-3xl px-6 pb-24">
        <FaqSection title="CCTS" items={CCTS_FAQS} />
        <FaqSection title="CBAM" items={CBAM_FAQS} />
        <FaqSection title="General / Platform" items={GENERAL_FAQS} />
      </main>

      <div className="relative z-10">
        <ToolFooter />
      </div>
    </div>
  );
}
