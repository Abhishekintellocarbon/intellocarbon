import type { SubscriptionTier } from "@prisma/client";

export interface PlanDefinition {
  tier: SubscriptionTier;
  name: string;
  /** Who this plan is for — the one-line description shown under the plan name. */
  forWhom: string;
  // Historical field — actual facility capacity is now tracked per
  // Subscription row (Subscription.facilitiesIncluded, see schema.prisma),
  // not per plan, since two companies on the same tier can cover different
  // facility counts. Kept null on every plan below and unused by
  // requireCapacityForNewFacility; reserved for a future flat-limit plan
  // (e.g. an enterprise tier with a hard cap regardless of facilities paid
  // for) rather than removed outright.
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
    forWhom: "Indian companies with a domestic CCTS obligation only — not exporting to the EU or the UK.",
    facilityLimit: null,
    priceInr: 14999,
    priceLabel: "₹14,999/facility/mo",
    description: "India's Carbon Credit Trading Scheme — GHG intensity monitoring and BEE-format reporting.",
    features: [
      "GHG intensity monitoring",
      "CCTS BEE format reports (Forms 1-A, 1-B, 1-C, 1-D)",
      "GEI trend charted against your own notified target",
      "CCC surplus/deficit position — credits to sell, or the shortfall to cover",
      "Multi-year target trajectory — your entity's own notified targets, year by year",
      "CCC market price tracking — shown as not yet open until IEX trading begins in October 2026",
      "Annual compliance cycle countdown",
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
    forWhom: "Indian companies exporting to the EU or the UK.",
    facilityLimit: null,
    priceInr: 19999,
    priceLabel: "₹19,999/facility/mo",
    description: "EU Carbon Border Adjustment Mechanism — Communication Package reporting and financial impact.",
    features: [
      // UK CBAM is included in this tier rather than sold separately — see
      // TIER_GRANTS in reportGeneration.service.ts, which grants the UK return
      // on exactly the same tiers as the EU package. Change both together.
      "EU & UK CBAM coverage",
      "CBAM Communication Package (14-page PDF)",
      "Specific Embedded Emissions calculation",
      "CBAM certificates required",
      "Financial liability in Euros",
      "EU default value comparison",
      "Certificate price trend — every published quarter, charted",
      "SEE benchmark strip — your facility against the EU default",
      "One-click board summary PDF",
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
    forWhom: "Indian companies that export to the EU or the UK and also have a domestic CCTS obligation.",
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
  // single subscription per company.
  //
  // Formerly "BRSR Core Reporting" at ₹14,999/facility/mo with ISSB bundled
  // in free as a beta scaffold. Repriced to ₹19,999/facility/mo as the "ESG
  // Disclosure Bundle" now that ISSB (Scope 1/2 reuse + Scope 3 calculation
  // engine, see scope3Calculation.service.ts) and BRSR Core are both a real,
  // supported feature set. GRI Standards 2021 has since shipped into this same
  // bundle at no extra cost, with CSRD/CDP the natural next additions, per
  // COMBINATION_RULES' comment below. The
  // SubscriptionTier enum value stays BRSR_CORE_REPORTING (renaming it would
  // touch every existing Subscription row's FK-like enum reference) — only
  // this plan's marketing name/price/copy changed, which is exactly what a
  // subscriber and the pricing page see.
  //
  // IMPORTANT — this does not retroactively reprice any existing active
  // subscriber: Razorpay bills against the specific Plan object a
  // subscription was created against (looked up via razorpayPlanIdEnvVar at
  // *checkout* time only), not against this file. To actually charge new
  // subscribers ₹19,999, create a new ₹19,999/mo Plan in the Razorpay
  // dashboard and point RAZORPAY_PLAN_ID_BRSR_CORE at it — existing
  // subscribers keep billing at their originally-agreed price on the old
  // Plan object, untouched, until they're migrated deliberately.
  BRSR_CORE_REPORTING: {
    tier: "BRSR_CORE_REPORTING",
    name: "ESG Disclosure Bundle",
    forWhom: "Listed companies and their value chain partners required to disclose BRSR Core, ISSB IFRS S1/S2 and/or GRI.",
    facilityLimit: null,
    priceInr: 19999,
    priceLabel: "₹19,999/facility/mo",
    description: "BRSR Core + ISSB IFRS S1/S2 + GRI Standards 2021 — reusing your existing GHG calculation data, with CSRD/CDP planned next.",
    features: [
      "All 9 BRSR Core attributes (GHG, water, waste, energy, workforce, diversity, inclusion, openness, fairness)",
      "ISSB IFRS S1 & S2 disclosure — Governance, Strategy, Risk Management, Metrics & Targets",
      "GRI Standards 2021 — Universal Standards, a GRI 3 materiality assessment that determines which Topic Standards apply, and the required GRI content index",
      "Scope 3 calculation engine — 5 GHG Protocol value-chain categories (Purchased goods & services, Upstream transport & distribution, Business travel, Employee commuting, Use of sold products), spend-based or activity-based",
      "Water Footprint tracking (ISO 14046) — withdrawal, discharge and consumption per source",
      "Voluntary offsets tracking — registry, serial, vintage and category, logged against residual emissions",
      "GHG footprint reused automatically from your CBAM/CCTS activity data — no double entry",
      "BRSR Core PDF report matching SEBI HO/CFD/CFD-SEC-2/P/CIR/2023/122 format",
      "Reasonable-assurance verification workflow",
      "Standalone or bundled with any CBAM/CCTS plan",
      "7-year document retention",
      "CSRD and CDP disclosures planned as future additions to this bundle",
    ],
    razorpayPlanIdEnvVar: "RAZORPAY_PLAN_ID_BRSR_CORE",
  },
};

export const getPlan = (tier: SubscriptionTier): PlanDefinition => PLANS[tier];

/**
 * One-time compliance onboarding fee: ₹25,000 for the first facility plus
 * ₹10,000 for each additional one, i.e.
 * 25000 + 10000 * (facilityCount - 1).
 *
 * Only the per-additional-facility half is collected in-flow today, as a
 * Razorpay add-on raised by addFacilityCapacity. The first-facility ₹25,000
 * (and any extra facilities bought in the initial checkout) is still invoiced
 * manually — nothing in the checkout path raises it. Mirrored for display in
 * frontend/src/lib/constants.ts; keep the two in step until the fee is served
 * with the plans payload.
 */
export const ONBOARDING_FEE_FIRST_FACILITY_INR = 25000;
export const ONBOARDING_FEE_ADDITIONAL_FACILITY_INR = 10000;

export const onboardingFeeInr = (facilityCount: number): number =>
  ONBOARDING_FEE_FIRST_FACILITY_INR + ONBOARDING_FEE_ADDITIONAL_FACILITY_INR * Math.max(0, facilityCount - 1);

export interface PlanCombinationRule {
  /** Every tier here, held active simultaneously, merges into `combinedTier`. */
  tiers: SubscriptionTier[];
  combinedTier: SubscriptionTier;
}

// Extensible on purpose: the only combined tier that exists today is
// CBAM_PLUS_CCTS. ISSB is already folded into the ESG Disclosure Bundle
// (BRSR_CORE_REPORTING tier — see its plan definition above) rather than
// needing its own combination rule, as is GRI; a future CSRD/CDP addition that
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
