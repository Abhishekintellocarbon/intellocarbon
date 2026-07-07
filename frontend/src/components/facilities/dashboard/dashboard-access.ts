import type { Subscription } from "@/lib/types";

export interface DashboardAccess {
  hasCbam: boolean;
  hasCcts: boolean;
  hasBrsr: boolean;
}

/**
 * A company can hold several active subscriptions at once (e.g. CBAM_COMPLIANCE
 * bought separately from BRSR_CORE_REPORTING), and CBAM_PLUS_CCTS bundles both
 * CBAM and CCTS access into one tier — so each flag checks every tier that
 * grants it, not just its "own" tier.
 */
export const computeDashboardAccess = (subscriptions: Subscription[]): DashboardAccess => {
  const activeTiers = new Set(subscriptions.filter((s) => s.status === "ACTIVE").map((s) => s.tier));
  return {
    hasCbam: activeTiers.has("CBAM_COMPLIANCE") || activeTiers.has("CBAM_PLUS_CCTS"),
    hasCcts: activeTiers.has("CCTS_COMPLIANCE") || activeTiers.has("CBAM_PLUS_CCTS"),
    hasBrsr: activeTiers.has("BRSR_CORE_REPORTING"),
  };
};
