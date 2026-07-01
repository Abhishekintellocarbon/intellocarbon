import type { SubscriptionTier } from "@prisma/client";

export interface PlanDefinition {
  tier: SubscriptionTier;
  name: string;
  facilityLimit: number | null;
  priceInr: number | null;
  priceLabel: string;
  description: string;
  features: string[];
  /** Set via env once a real Razorpay Plan is created in the dashboard (or the create-plan API). */
  razorpayPlanIdEnvVar?: string;
}

export const PLANS: Record<SubscriptionTier, PlanDefinition> = {
  STARTER: {
    tier: "STARTER",
    name: "Starter",
    facilityLimit: 1,
    priceInr: 4999,
    priceLabel: "₹4,999/mo",
    description: "For a single plant getting started with CBAM/CCTS compliance.",
    features: [
      "1 facility",
      "Unlimited activity data entries",
      "CBAM + CCTS emission calculations",
      "PDF report generation",
      "Email support",
    ],
    razorpayPlanIdEnvVar: "RAZORPAY_PLAN_ID_STARTER",
  },
  GROWTH: {
    tier: "GROWTH",
    name: "Growth",
    facilityLimit: 5,
    priceInr: 14999,
    priceLabel: "₹14,999/mo",
    description: "For multi-plant operators managing several facilities.",
    features: [
      "Up to 5 facilities",
      "Unlimited activity data entries",
      "CBAM + CCTS emission calculations",
      "PDF report generation",
      "Third-party verification workflow",
      "Priority email support",
    ],
    razorpayPlanIdEnvVar: "RAZORPAY_PLAN_ID_GROWTH",
  },
  ENTERPRISE: {
    tier: "ENTERPRISE",
    name: "Enterprise",
    facilityLimit: null,
    priceInr: null,
    priceLabel: "Contact sales",
    description: "For large industrial groups with unlimited facilities and dedicated support.",
    features: [
      "Unlimited facilities",
      "Unlimited activity data entries",
      "CBAM + CCTS emission calculations",
      "PDF report generation",
      "Third-party verification workflow",
      "Dedicated account manager",
    ],
  },
};

export const getPlan = (tier: SubscriptionTier): PlanDefinition => PLANS[tier];
