import type { SubscriptionTier } from "@prisma/client";

export interface PlanDefinition {
  tier: SubscriptionTier;
  name: string;
  /** Who this plan is for — the one-line description shown under the plan name. */
  forWhom: string;
  /** Facilities allowed under this plan — null means no plan-enforced cap (billed per facility, see the facility calculator). */
  facilityLimit: number | null;
  /** Price per facility per month, in INR. Null means no self-serve price (contact sales). */
  priceInr: number | null;
  priceLabel: string;
  description: string;
  features: string[];
  /** Highlighted as the flagship/"Most Popular" plan on the pricing page. */
  highlight?: boolean;
  /** Set via env once a real Razorpay Plan is created in the dashboard (or the create-plan API). */
  razorpayPlanIdEnvVar?: string;
}

export const PLANS: Record<SubscriptionTier, PlanDefinition> = {
  CCTS_COMPLIANCE: {
    tier: "CCTS_COMPLIANCE",
    name: "CCTS Compliance",
    forWhom: "Indian companies with a domestic CCTS obligation only — not exporting to the EU.",
    facilityLimit: null,
    priceInr: 14999,
    priceLabel: "₹14,999/facility/mo",
    description: "India's Carbon Credit Trading Scheme — GHG intensity monitoring and BEE-format reporting.",
    features: [
      "GHG intensity monitoring",
      "CCTS BEE format reports (Forms 1-A, 1-B, 1-C, 1-D)",
      "CCC surplus/deficit tracking",
      "ACVA verification workflow",
      "Quarterly deadline alerts",
      "7-year document retention",
      "India domestic compliance only",
    ],
    razorpayPlanIdEnvVar: "RAZORPAY_PLAN_ID_CCTS_COMPLIANCE",
  },
  CBAM_COMPLIANCE: {
    tier: "CBAM_COMPLIANCE",
    name: "CBAM Compliance",
    forWhom: "Indian companies exporting to the EU.",
    facilityLimit: null,
    priceInr: 19999,
    priceLabel: "₹19,999/facility/mo",
    description: "EU Carbon Border Adjustment Mechanism — Communication Package reporting and financial impact.",
    features: [
      "CBAM Communication Package (14-page PDF)",
      "Specific Embedded Emissions calculation",
      "CBAM certificates required",
      "Financial liability in Euros",
      "EU default value comparison",
      "Article 9 deduction",
      "Verification portal",
      "O3CI submission ready",
      "Quarterly deadline alerts",
      "7-year document retention",
      "EU export compliance",
    ],
    razorpayPlanIdEnvVar: "RAZORPAY_PLAN_ID_CBAM_COMPLIANCE",
  },
  CBAM_PLUS_CCTS: {
    tier: "CBAM_PLUS_CCTS",
    name: "CBAM + CCTS",
    forWhom: "Indian companies that both export to the EU and have a domestic CCTS obligation.",
    facilityLimit: null,
    priceInr: 29999,
    priceLabel: "₹29,999/facility/mo",
    description: "Complete India + EU compliance — both reports generated from a single data entry.",
    features: [
      "Everything in CCTS Compliance",
      "Everything in CBAM Compliance",
      "Article 9 deduction calculated automatically",
      "Both reports generated from a single data entry",
      "Dual GWP tables — AR5 for CBAM, AR2/BUR3 for CCTS",
      "Complete India + EU compliance in one platform",
    ],
    highlight: true,
    razorpayPlanIdEnvVar: "RAZORPAY_PLAN_ID_CBAM_PLUS_CCTS",
  },
  // Standalone add-on — purchasable on its own or alongside any CBAM/CCTS tier,
  // since Subscription now allows one row per (company, tier) rather than a
  // single subscription per company. Priced at ₹14,999/facility/mo = 1499900 paise,
  // the amount to use when creating the corresponding plan in the Razorpay dashboard.
  BRSR_CORE_REPORTING: {
    tier: "BRSR_CORE_REPORTING",
    name: "BRSR Core Reporting",
    forWhom: "Listed companies and their value chain partners required to disclose the 9 BRSR Core ESG attributes.",
    facilityLimit: null,
    priceInr: 14999,
    priceLabel: "₹14,999/facility/mo",
    description: "SEBI BRSR Core — the 9 mandated ESG attributes, reusing your existing GHG calculation data.",
    features: [
      "All 9 BRSR Core attributes (GHG, water, waste, energy, workforce, diversity, inclusion, openness, fairness)",
      "GHG footprint reused automatically from your CBAM/CCTS activity data — no double entry",
      "BRSR Core PDF report matching SEBI HO/CFD/CFD-SEC-2/P/CIR/2023/122 format",
      "Reasonable-assurance verification workflow",
      "Standalone or bundled with any CBAM/CCTS plan",
      "7-year document retention",
    ],
    razorpayPlanIdEnvVar: "RAZORPAY_PLAN_ID_BRSR_CORE",
  },
};

export const getPlan = (tier: SubscriptionTier): PlanDefinition => PLANS[tier];

export interface PlanCombinationRule {
  /** Every tier here, held active simultaneously, merges into `combinedTier`. */
  tiers: SubscriptionTier[];
  combinedTier: SubscriptionTier;
}

// Extensible on purpose: the only combined tier that exists today is
// CBAM_PLUS_CCTS, but a future ESG framework addition (GRI, ISSB, CDP) that
// ships its own combined tier just adds another entry here — nothing else
// in the merge-detection logic (see billing.service.ts) needs to change.
// Do not add speculative rules for frameworks/tiers that don't exist yet.
export const COMBINATION_RULES: PlanCombinationRule[] = [
  { tiers: ["CCTS_COMPLIANCE", "CBAM_COMPLIANCE"], combinedTier: "CBAM_PLUS_CCTS" },
];

/**
 * Given a company's currently active tiers and a tier it's about to
 * subscribe to, returns the combination rule that applies (if any) and
 * which of the active tiers become obsolete once the combined tier takes
 * over. Handles both directions:
 *  - requestedTier is a constituent tier and every other constituent is
 *    already active (e.g. requesting CBAM while CCTS is active), and
 *  - requestedTier is already the combined tier itself and at least one
 *    constituent is active as a standalone subscription (e.g. the frontend
 *    already offered the upgrade and the user accepted it directly).
 */
export const findMergeCandidate = (
  activeTiers: SubscriptionTier[],
  requestedTier: SubscriptionTier,
): { rule: PlanCombinationRule; obsoleteTiers: SubscriptionTier[] } | null => {
  for (const rule of COMBINATION_RULES) {
    if (rule.tiers.includes(requestedTier)) {
      const others = rule.tiers.filter((t) => t !== requestedTier);
      if (others.length > 0 && others.every((t) => activeTiers.includes(t))) {
        return { rule, obsoleteTiers: others };
      }
    }
    if (requestedTier === rule.combinedTier) {
      const activeConstituents = rule.tiers.filter((t) => activeTiers.includes(t));
      if (activeConstituents.length > 0) {
        return { rule, obsoleteTiers: activeConstituents };
      }
    }
  }
  return null;
};
