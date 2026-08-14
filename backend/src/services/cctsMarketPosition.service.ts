import type { CctsCccPosition, CctsCccPositionResolved } from "./cbamFinancialImpact.service";
import {
  getCccMarketPrice,
  isCccMarketOpen,
  CCC_TRADING_OPENS_LABEL,
  CCC_TRADING_VENUE,
  CCTS_NON_COMPLIANCE_PENALTY_MULTIPLIER,
  CCTS_NON_COMPLIANCE_PENALTY_SOURCE,
} from "../data/cctsReferenceData";
import { round } from "./dashboardShared.helpers";

/**
 * The CCC surplus/deficit position, priced.
 *
 * This computes **no** compliance arithmetic of its own. The whole
 * (target intensity − achieved intensity) × production formula already lives
 * in computeCbamFinancialImpact's `cctsPosition` and stays there; this
 * function takes that computed position and answers the two further questions
 * a dashboard needs — which side of the line the facility is on, and what the
 * position is worth — and it can only answer the second once a real CCC price
 * exists.
 *
 * The status union is the point of the return type, exactly as it is for
 * UkCbamFinancialImpact: a caller must not be able to render a rupee figure
 * without having handled "no target notified", "the market hasn't opened" and
 * "the market is open but no price is recorded". The tonnes are real in all
 * three pending states — it's only the valuation that is withheld.
 */
export type CctsCccMarketPosition =
  | CctsPositionTargetPending
  | CctsPositionMarketNotOpen
  | CctsPositionPricePending
  | CctsPositionValued;

/** Shared by every state in which the CCC delta itself is known. */
interface CctsPositionBase {
  /** Positive delta — the facility beat its target and can sell CCCs. */
  isSurplus: boolean;
  /** Size of the position in CCCs (1 CCC = 1 tCO2e), always non-negative; read `isSurplus` for direction. */
  cccCredits: number;
  targetIntensity: number;
  actualIntensity: number;
}

/** No BEE-notified target has been entered for this facility, so there is no position to take. */
export interface CctsPositionTargetPending {
  status: "TARGET_PENDING";
  reason: string;
}

/** Position is known; CCC trading has not started yet, so no price can exist. */
export interface CctsPositionMarketNotOpen extends CctsPositionBase {
  status: "MARKET_NOT_OPEN";
  opensLabel: string;
  venue: string;
  reason: string;
}

/** Position is known and the market is trading, but no price has been recorded here yet. */
export interface CctsPositionPricePending extends CctsPositionBase {
  status: "PRICE_PENDING";
  venue: string;
  reason: string;
}

export interface CctsPositionValued extends CctsPositionBase {
  status: "VALUED";
  pricePerCreditInr: number;
  priceAsOfDate: string;
  priceSource: string;
  /** Sale value of a surplus, or purchase cost of covering a deficit. */
  positionValueInr: number;
  /** Deficit only — environmental compensation at twice the market price if the shortfall isn't surrendered. */
  penaltyExposureInr: number | null;
  penaltyMultiplier: number;
  penaltySource: string;
}

const TARGET_PENDING_REASON =
  "No BEE-notified GHG emission intensity target has been entered for this facility. CCTS targets are notified per obligated entity, not per sector, so the position can only be stated once the facility's own registered target is on file.";

export const computeCctsCccMarketPosition = (
  position: CctsCccPosition | CctsCccPositionResolved,
  now: Date,
): CctsCccMarketPosition => {
  if (position.pending) {
    return { status: "TARGET_PENDING", reason: TARGET_PENDING_REASON };
  }

  const base: CctsPositionBase = {
    isSurplus: position.isSurplus,
    cccCredits: round(Math.abs(position.deltaTco2e), 2),
    targetIntensity: round(position.targetIntensity, 4),
    actualIntensity: round(position.actualIntensity, 4),
  };

  if (!isCccMarketOpen(now)) {
    return {
      ...base,
      status: "MARKET_NOT_OPEN",
      opensLabel: CCC_TRADING_OPENS_LABEL,
      venue: CCC_TRADING_VENUE,
      reason: `Carbon Credit Certificates are not tradable yet — the CCTS compliance market opens on the ${CCC_TRADING_VENUE} in ${CCC_TRADING_OPENS_LABEL}. The position below is in credits; it can be valued once trading begins and a price is recorded.`,
    };
  }

  // Market is open but nothing has been entered. Distinct from the state
  // above: this one a Super Admin can actually clear.
  const price = getCccMarketPrice();
  if (!price) {
    return {
      ...base,
      status: "PRICE_PENDING",
      venue: CCC_TRADING_VENUE,
      reason: `No CCC market price has been recorded yet. The position below is in credits; it can be valued once the ${CCC_TRADING_VENUE} price is entered in the Emission Factor Manager.`,
    };
  }

  const positionValueInr = base.cccCredits * price.pricePerCreditInr;

  return {
    ...base,
    status: "VALUED",
    pricePerCreditInr: price.pricePerCreditInr,
    priceAsOfDate: price.asOfDate,
    priceSource: price.source,
    positionValueInr: round(positionValueInr, 2),
    // A surplus can be sold; it carries no penalty exposure. Only an
    // unsurrendered deficit attracts environmental compensation.
    penaltyExposureInr: base.isSurplus ? null : round(positionValueInr * CCTS_NON_COMPLIANCE_PENALTY_MULTIPLIER, 2),
    penaltyMultiplier: CCTS_NON_COMPLIANCE_PENALTY_MULTIPLIER,
    penaltySource: CCTS_NON_COMPLIANCE_PENALTY_SOURCE,
  };
};

/**
 * The market-price tracker card, independent of any one facility's position —
 * the CCC counterpart of the CBAM certificate price shown on the dashboard.
 * Kept beside the position logic so "not open" and "no price" are worded once.
 */
export type CccMarketPriceStatus =
  | { status: "MARKET_NOT_OPEN"; opensLabel: string; venue: string; reason: string }
  | { status: "PRICE_PENDING"; venue: string; reason: string }
  | { status: "AVAILABLE"; venue: string; pricePerCreditInr: number; asOfDate: string; source: string };

export const getCccMarketPriceStatus = (now: Date): CccMarketPriceStatus => {
  if (!isCccMarketOpen(now)) {
    return {
      status: "MARKET_NOT_OPEN",
      opensLabel: CCC_TRADING_OPENS_LABEL,
      venue: CCC_TRADING_VENUE,
      reason: `CCC trading opens on the ${CCC_TRADING_VENUE} in ${CCC_TRADING_OPENS_LABEL}. No market price exists before then.`,
    };
  }
  const price = getCccMarketPrice();
  if (!price) {
    return {
      status: "PRICE_PENDING",
      venue: CCC_TRADING_VENUE,
      reason: `Trading is open but no CCC price has been recorded yet. A Super Admin enters it in the Emission Factor Manager, with its source.`,
    };
  }
  return {
    status: "AVAILABLE",
    venue: CCC_TRADING_VENUE,
    pricePerCreditInr: price.pricePerCreditInr,
    asOfDate: price.asOfDate,
    source: price.source,
  };
};
