import type { Metadata } from "next";
import { MarketingHeader } from "@/components/intellocalc/marketing-header";
import { ToolFooter } from "@/components/intellocalc/tool-footer";

export const metadata: Metadata = {
  title: "Privacy Policy — Intellocarbon",
  description:
    "How Intellocarbon Solutions Private Limited collects, uses, stores, and protects information on the Intellocarbon platform.",
};

type Block = { type: "p"; text: string } | { type: "list"; items: string[] };

const SECTIONS: { heading: string; blocks: Block[] }[] = [
  {
    heading: "1. Information We Collect",
    blocks: [
      {
        type: "p",
        text: "1.1 Account Information: Name, email address, phone number, designation, and company details provided at signup and during company/facility onboarding.",
      },
      {
        type: "p",
        text: "1.2 Company and Facility Data: Company name, GSTIN, CIN, sector, CN codes, EU importer details, facility addresses, GPS coordinates, production capacity, and related business information you enter.",
      },
      {
        type: "p",
        text: "1.3 Activity and Emissions Data: Fuel consumption, electricity usage, process material quantities, precursor data, production output, and other operational data you submit for emissions calculation and report generation.",
      },
      {
        type: "p",
        text: "1.4 Billing Information: Subscription plan, billing cycle, and payment records. Card and payment method details are collected and processed directly by a PCI-DSS compliant third-party payment processor; Intellocarbon does not store full payment card details on its own servers.",
      },
      {
        type: "p",
        text: "1.5 Usage Data: Log data, IP address, browser type, and platform interaction data collected automatically for security, audit, and service-improvement purposes.",
      },
      {
        type: "p",
        text: "1.6 Communications: Records of correspondence with our support team, and notifications sent to you regarding compliance deadlines, account activity, or platform updates.",
      },
    ],
  },
  {
    heading: "2. How We Use Your Information",
    blocks: [
      { type: "p", text: "We use the information we collect to:" },
      {
        type: "list",
        items: [
          "Provide, operate, and maintain the Platform, including emissions calculation and report generation",
          "Process subscription payments and manage billing",
          "Send compliance deadline alerts and account-related notifications",
          "Facilitate the verification workflow between Customer and assigned third-party verifiers",
          "Maintain audit logs and security records as required for regulatory and platform integrity purposes",
          "Improve and troubleshoot the Platform",
          "Comply with applicable legal and regulatory obligations, including data retention requirements under CBAM and related frameworks",
        ],
      },
    ],
  },
  {
    heading: "3. Data Hosting and Third-Party Processors",
    blocks: [
      { type: "p", text: "3.1 Platform data is hosted on secure cloud infrastructure located in India." },
      {
        type: "p",
        text: "3.2 We engage reputable third-party service providers to operate the Platform, each of which processes limited data strictly for the purpose described:",
      },
      {
        type: "list",
        items: [
          "A payment processor, for payment processing and billing",
          "An email delivery provider, for transactional email delivery (account notifications, compliance alerts, deadline reminders)",
          "Cloud hosting providers, for frontend and backend application hosting",
          "An analytics provider (Plausible), for aggregate, cookieless page-view statistics on public pages — used only with your consent, as described in Section 8",
          "An error and performance monitoring provider (Sentry), for diagnostic reports when a page or request fails — used in your browser only with your consent, as described in Section 8",
        ],
      },
      {
        type: "p",
        text: "3.3 These providers are contractually and/or technically restricted to using data only for providing services to Intellocarbon, and are not permitted to use Customer Data for their own independent purposes.",
      },
    ],
  },
  {
    heading: "4. Data Sharing",
    blocks: [
      { type: "p", text: "4.1 We do not sell Customer Data to third parties." },
      {
        type: "p",
        text: "4.2 Data may be shared with a verifier you or your company engages through the Platform's verification workflow, solely for the purpose of that verification.",
      },
      {
        type: "p",
        text: "4.3 We may disclose information where required by law, regulation, court order, or valid governmental request.",
      },
      {
        type: "p",
        text: "4.4 In the event of a merger, acquisition, or sale of assets, Customer Data may be transferred as part of that transaction, subject to equivalent privacy protections.",
      },
    ],
  },
  {
    heading: "5. Data Retention",
    blocks: [
      {
        type: "p",
        text: "5.1 We retain Customer Data for as long as your account remains active, and thereafter for the period required to comply with applicable regulatory obligations.",
      },
      {
        type: "p",
        text: "5.2 CBAM-related records are retained for a minimum of 7 years, consistent with retention requirements under EU 2024/3210 Article 23.",
      },
      {
        type: "p",
        text: "5.3 Upon account closure, data not subject to a mandatory retention period will be deleted or anonymised within a reasonable period, unless retention is required for legal, audit, or dispute-resolution purposes.",
      },
    ],
  },
  {
    heading: "6. Data Security",
    blocks: [
      {
        type: "p",
        text: "We apply reasonable technical and organisational measures to protect Customer Data, including access controls restricting internal data access by role (Company Admin, Data Entry Operator, Verifier, Super Admin), encrypted data transmission, rate limiting on authentication endpoints, and regular dependency and security monitoring. No method of transmission or storage is completely secure, and we cannot guarantee absolute security.",
      },
    ],
  },
  {
    heading: "7. Your Rights",
    blocks: [
      {
        type: "p",
        text: "Subject to applicable law, you may request access to, correction of, or deletion of your personal information, by contacting us at support@intellocarbon.com. Certain data may be retained notwithstanding a deletion request where required for regulatory compliance, as described in Section 5.",
      },
      {
        type: "p",
        text: "Enterprise customers or partners requiring a signed Data Processing Agreement (DPA) may request one by contacting support@intellocarbon.com.",
      },
    ],
  },
  {
    heading: "8. Cookies, Analytics and Consent",
    blocks: [
      {
        type: "p",
        text: "8.1 We group the technologies we use into three categories. Only the first runs automatically; the other two run solely if you have given consent for that category.",
      },
      {
        type: "list",
        items: [
          "Essential — strictly necessary for the Platform to function: authenticating you and keeping you signed in, maintaining session security, and remembering the cookie choice described below. These cannot be switched off, as the Platform cannot be provided without them.",
          "Analytics — Plausible Analytics, which produces aggregate page-view statistics for our public pages. It is cookieless, collects no personal data, and does not track individual users across sites. It is loaded only on public marketing pages, and never on authenticated Platform routes or billing pages.",
          "Performance — Sentry, which reports diagnostic information when a page fails or performs poorly, so that we can identify and fix faults. Reports cover error details, page addresses (with sensitive query parameters removed) and load timings; we configure Sentry not to attach personally identifying request data.",
        ],
      },
      {
        type: "p",
        text: "8.2 Consent is requested by a banner shown on our public pages on your first visit. Until you make a choice, and if you decline, neither the Analytics nor the Performance scripts are loaded or initialised at all — nothing is requested from those providers and no data is sent to them. Declining does not affect your ability to use any part of the Platform.",
      },
      {
        type: "p",
        text: "8.3 Your choice is recorded in your own browser's local storage, as a first-party record containing the categories you selected and the date of your decision. It is not a third-party cookie, is not transmitted to our servers, and is not used to identify you.",
      },
      {
        type: "p",
        text: "8.4 A recorded choice lasts six months, after which the banner reappears so that you can confirm or change it. If we add a new non-essential category, we ask again rather than applying your previous choice to it.",
      },
      {
        type: "p",
        text: "8.5 You can change or withdraw your consent at any time, and as easily as it was given, using the “Cookie settings” link in the site footer. Withdrawing consent stops the relevant data being collected or transmitted immediately. You can also clear your browser's site data, which erases the record and causes the banner to be shown again.",
      },
      {
        type: "p",
        text: "8.6 The Analytics and Performance categories are independent: consenting to one does not enable the other. Where you have consented to the Performance category, Sentry's diagnostic reporting applies across the Platform, including authenticated routes, so that faults you encounter while signed in can be diagnosed.",
      },
      {
        type: "p",
        text: "8.7 Separately from your browser, we operate server-side error monitoring on our own infrastructure. This observes our systems rather than storing information on your device, is necessary to run the Platform securely and reliably, and is therefore not covered by the consent banner.",
      },
    ],
  },
  {
    heading: "9. Children's Privacy",
    blocks: [
      {
        type: "p",
        text: "The Platform is intended for business use by industrial companies and their authorised personnel. It is not directed at, and we do not knowingly collect information from, individuals under the age of 18.",
      },
    ],
  },
  {
    heading: "10. International Data Transfers",
    blocks: [
      {
        type: "p",
        text: "Where any of our third-party service providers process limited data (such as email delivery metadata) outside India, we take reasonable steps to ensure such providers maintain appropriate safeguards for the data processed.",
      },
    ],
  },
  {
    heading: "11. Changes to This Policy",
    blocks: [
      {
        type: "p",
        text: "We may update this Privacy Policy from time to time. Material changes will be notified via email or in-platform notice. Continued use of the Platform after such notice constitutes acceptance of the revised Policy.",
      },
    ],
  },
  {
    heading: "12. Contact",
    blocks: [
      {
        type: "p",
        text: "For questions regarding this Privacy Policy or to exercise your data rights, contact support@intellocarbon.com.",
      },
      {
        type: "p",
        text: "Intellocarbon Solutions Private Limited, Registered Office: Ambikapur, Surguja, Chhattisgarh, India. CIN: U62020CT2026PTC020653.",
      },
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background lg:pr-[240px]">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-gradient-radial-glow" />

      <MarketingHeader />

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-4xl px-6 pb-16 pt-10 text-center">
        <h1 className="text-[36px] font-semibold leading-tight text-[#E8F0F7] text-balance sm:text-[48px]">
          Privacy Policy
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-balance text-[#8AA0B4] sm:text-lg">
          Intellocarbon Solutions Private Limited
        </p>
        <p className="mt-2 text-sm text-[#8AA0B4]">Effective Date: 3 August 2026</p>
      </section>

      <main className="relative z-10 mx-auto max-w-3xl px-6 pb-24">
        <p className="text-[#8AA0B4]">
          This Privacy Policy explains how Intellocarbon Solutions Private Limited (&quot;Intellocarbon&quot;,
          &quot;we&quot;, &quot;us&quot;, &quot;our&quot;) collects, uses, stores, and protects information when
          you use the Intellocarbon platform at intellocarbon.com and related services (the
          &quot;Platform&quot;).
        </p>

        {SECTIONS.map((section) => (
          <section key={section.heading} className="border-t border-surface-border py-10 sm:py-12">
            <h2 className="text-2xl font-semibold text-teal-500">{section.heading}</h2>
            <div className="mt-4 space-y-4 text-[#8AA0B4]">
              {section.blocks.map((block, index) =>
                block.type === "p" ? (
                  <p key={index}>{block.text}</p>
                ) : (
                  <ul key={index} className="space-y-2.5">
                    {block.items.map((item) => (
                      <li key={item} className="flex items-start gap-2.5">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ),
              )}
            </div>
          </section>
        ))}
      </main>

      <div className="relative z-10">
        <ToolFooter />
      </div>
    </div>
  );
}
