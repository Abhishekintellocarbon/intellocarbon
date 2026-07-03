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
    priceInr: 4999,
    priceLabel: "₹4,999/facility/mo",
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
    priceInr: 9999,
    priceLabel: "₹9,999/facility/mo",
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
    priceInr: 19999,
    priceLabel: "₹19,999/facility/mo",
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
};

export const getPlan = (tier: SubscriptionTier): PlanDefinition => PLANS[tier];
