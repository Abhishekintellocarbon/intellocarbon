export interface InsightSection {
  heading?: string;
  paragraphs: string[];
}

export interface Insight {
  slug: string;
  tag: string;
  date: string;
  title: string;
  excerpt: string;
  /** Deck shown under the article title. */
  standfirst: string;
  sections: InsightSection[];
}

export const INSIGHTS: Insight[] = [
  {
    slug: "cbam-2026-changes-indian-steel-exporters",
    tag: "CBAM",
    date: "July 2026",
    title: "What Indian steel exporters need to know about CBAM in 2026",
    excerpt:
      "The EU Carbon Border Adjustment Mechanism is now fully operational. Here is what changes for Indian manufacturers this year.",
    standfirst:
      "CBAM has left its transitional phase behind. For Indian steel exporters, reporting is no longer an information-gathering exercise — it carries a financial consequence.",
    sections: [
      {
        heading: "The transitional phase is over",
        paragraphs: [
          "From January 2026, CBAM operates in its definitive phase. During the transitional period, quarterly reports were largely an information-gathering exercise: importers filed embedded emissions data, and errors carried limited consequence. That is no longer the case. Quarterly reporting and the annual declaration are now mandatory obligations rather than informational filings, and the figures submitted eventually determine what an EU importer pays.",
          "For an Indian exporter, the practical shift is that your emissions data now sits inside your customer's financial exposure. An importer who cannot obtain credible, shipment-level figures from you will fall back on default values — and will price that outcome into the commercial relationship.",
        ],
      },
      {
        heading: "The certificate surrender date moved",
        paragraphs: [
          "Financial certificate surrender for the 2026 reporting year begins on 31 May 2027. That date is later than originally legislated: it was pushed back through the EU's 2025 Omnibus simplification package, which reworked several CBAM timelines and administrative thresholds at the same time.",
          "That extension is worth understanding correctly. It delays the moment money changes hands; it does not delay the moment your data has to be right. The emissions being surrendered against in 2027 are the emissions from goods you are shipping now, in 2026. Data quality problems discovered in 2027 cannot be fixed retroactively for shipments that have already left the port.",
        ],
      },
      {
        heading: "The de minimis threshold",
        paragraphs: [
          "Not every exporter is drawn in. A de minimis threshold of 50 tonnes per year of covered goods exempts very small exporters from the obligation entirely. Below that volume, the compliance burden does not apply.",
          "Most Indian steel exporters selling into the EU clear this threshold comfortably, and it is worth checking the calculation at the level of covered goods rather than total tonnage shipped, since the threshold applies to CBAM-covered categories specifically.",
        ],
      },
      {
        heading: "Defaults are no longer a safe fallback",
        paragraphs: [
          "The most consequential change is methodological. Specific Embedded Emissions must be calculated per shipment, traceable to the installation and production route that actually made the goods. A flat default applied across a year of exports no longer satisfies the requirement.",
          "This cuts both ways, and for most Indian producers it cuts favourably. EU default values are set conservatively, which means they frequently overstate the real emissions intensity of a well-run Indian mill. An exporter who can demonstrate a verified actual figure below the applicable default reduces the certificate liability attached to their goods — sometimes materially. An exporter who cannot demonstrate it absorbs the default, and the gap between the two is a real commercial cost.",
        ],
      },
      {
        heading: "What this means in practice",
        paragraphs: [
          "The requirement facing Indian steel exporters in 2026 is not a reporting requirement in the familiar sense. It is a data requirement: shipment-level, auditable emissions figures, traceable back to plant records, produced on a quarterly rhythm and capable of surviving a verifier's review.",
          "Spreadsheets assembled at deadline can produce a number. They struggle to produce a number that holds up when an importer, a verifier, or a customs authority asks how it was derived. The exporters who will be least disrupted are those who put that system in place while the first definitive-phase reports are being filed — not after the first surrender date arrives.",
        ],
      },
    ],
  },
  {
    slug: "ccts-phase-2-iron-steel-live",
    tag: "CCTS",
    date: "July 2026",
    title: "India's Carbon Credit Trading Scheme — Phase 2 is live for steel",
    excerpt:
      "Iron and Steel is moving through CCTS target-setting. Here is how the intensity targets, CCCs, and compliance calendar work.",
    standfirst:
      "India's compliance carbon market is expanding sector by sector. Iron and Steel is now working its way through the target-setting process — and the baseline year is already in the past.",
    sections: [
      {
        heading: "Where the rollout stands",
        paragraphs: [
          "CCTS Phase 1 reached its conclusion in October 2025, when targets were finalised for Aluminium, Cement, Chlor-Alkali, and Pulp & Paper. Those four sectors now operate under notified intensity targets with defined compliance obligations.",
          "Phase 2 sectors, Iron & Steel among them, are in the target-setting process now. It is important to be precise about the status: as of mid-2026, Iron & Steel targets are progressing through notification rather than being fully finalised, with the sector at a draft and public-comment stage. A substantial number of individual units have already been named in draft form, which tells you the shape of the obligation is largely settled even though the final notification has not landed.",
          "For a steel producer, that is a narrow and closing window — the direction is clear enough to plan against, but the numbers are not yet fixed.",
        ],
      },
      {
        heading: "How the mechanism works",
        paragraphs: [
          "CCTS sets intensity-based targets, not absolute emissions caps. The obligation is expressed as greenhouse gas emissions per unit of output, which means growing production is not itself a compliance failure — increasing emissions per tonne produced is.",
          "Targets are set against a baseline year of FY 2023-24. Entities that outperform their target earn Carbon Credit Certificates for the difference. Entities that fall short must acquire CCCs to close the gap, either from over-performers or through the market mechanism.",
          "Two features of the certificate rules matter for planning. Surplus CCCs can be banked indefinitely, so over-performance in a strong year retains its value rather than expiring. Borrowing against future performance is not permitted — a deficit cannot be settled with a promise to do better next year. The asymmetry rewards early over-performance and penalises deferral.",
        ],
      },
      {
        heading: "Verification",
        paragraphs: [
          "Reported figures are not taken at face value. Verification runs through BEE-accredited carbon verification agencies, and the evidence trail behind each figure has to withstand that review. An intensity number that cannot be traced back to metered fuel consumption, production records, and documented emission factors is a liability during verification rather than an asset.",
        ],
      },
      {
        heading: "Why baseline work cannot wait",
        paragraphs: [
          "The most common mistake available to steel producers right now is waiting for the final notification before beginning work. The reasoning sounds prudent — why reconstruct data against targets that might shift? — but it misreads the timeline.",
          "The baseline is FY 2023-24. That year is already historical, and it will be further in the past by the time targets are confirmed. Reconstructing it means retrieving fuel logs, production records, electricity bills, and process data from a year that operational staff have moved on from, in a form a verifier will accept. That work takes months and it does not get easier with time.",
          "Producers who begin baseline reconstruction now arrive at final notification already knowing their position. Those who wait begin the work at the moment the obligation becomes binding, against a baseline that is by then two years cold.",
        ],
      },
    ],
  },
  {
    slug: "brsr-core-value-chain-what-suppliers-need-to-know",
    tag: "BRSR",
    date: "July 2026",
    title: "BRSR Core — what Indian manufacturers supplying listed companies must know",
    excerpt:
      "SEBI is expanding BRSR Core value-chain disclosures. If you supply to a listed company, your emissions data is now their compliance requirement.",
    standfirst:
      "You do not have to be listed to be pulled into BRSR Core. Increasingly, supplying a listed company is enough.",
    sections: [
      {
        heading: "What BRSR Core requires",
        paragraphs: [
          "SEBI's BRSR Core framework requires India's largest listed companies to report against nine key ESG attributes, with a phased move toward reasonable assurance rather than the lighter limited assurance that applied initially. The phasing matters: as the assurance requirement tightens, the standard of evidence behind each reported number rises with it.",
          "Reasonable assurance is a materially higher bar than a management representation. It means an assurer testing the underlying records, not reviewing a summary — and it applies to figures that, in many cases, originate outside the listed company itself.",
        ],
      },
      {
        heading: "The value-chain angle",
        paragraphs: [
          "This is where unlisted manufacturers enter the picture. Listed companies are increasingly expected to collect and report ESG data covering their significant suppliers, not only their own operations. A listed customer cannot assure a value-chain figure it does not hold.",
          "The practical consequence is that unlisted manufacturers are being drawn into disclosure requirements indirectly. You are not the reporting entity, and SEBI has not made you one. But your customer's obligation becomes a request landing on your desk — for emissions figures, water and waste data, workforce numbers — with a deadline set by their reporting calendar rather than yours.",
          "For suppliers to India's largest listed manufacturers, this has moved from occasional questionnaire to recurring requirement within a couple of reporting cycles.",
        ],
      },
      {
        heading: "The nine attributes, at a high level",
        paragraphs: [
          "BRSR Core covers nine attributes: greenhouse gas footprint, water footprint, waste management, energy footprint, employee wellbeing and safety, gender diversity, inclusive development, openness of business, and fairness in dealing with customers.",
          "The set is broader than carbon alone, which surprises suppliers who expect an emissions questionnaire. It spans environmental performance, workforce and social measures, and conduct in the market — meaning the data sits across operations, HR, procurement, and finance rather than in a single function.",
        ],
      },
      {
        heading: "Why this is becoming a commercial question",
        paragraphs: [
          "It is tempting to treat these requests as a compliance formality — assemble something adequate, send it, move on. That reading is becoming outdated.",
          "When a listed company has to assure value-chain data, the quality of what suppliers provide becomes a procurement consideration. A supplier who hands over clean, structured, consistent BRSR Core data reduces their customer's assurance risk. A supplier who returns inconsistent figures, or different numbers each cycle, creates work and exposure for the customer's reporting team.",
          "Suppliers in the first category are lower-risk vendors to work with, and that is starting to show up in vendor selection rather than only in compliance paperwork. The data request that arrives from a listed customer is worth treating as what it increasingly is: part of the commercial relationship, not an administrative side task.",
        ],
      },
    ],
  },
];

export function getInsight(slug: string): Insight | undefined {
  return INSIGHTS.find((insight) => insight.slug === slug);
}
