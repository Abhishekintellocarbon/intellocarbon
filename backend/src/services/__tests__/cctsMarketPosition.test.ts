import { describe, it, expect, beforeEach } from "vitest";
import { computeCctsCccMarketPosition, getCccMarketPriceStatus } from "../cctsMarketPosition.service";
import { setCccMarketPrice, CCC_TRADING_OPENS_DATE, isCccMarketOpen } from "../../data/cctsReferenceData";
import { nextCctsComplianceCycle } from "../../data/complianceDeadlines";
import type { CctsCccPositionResolved } from "../cbamFinancialImpact.service";

/**
 * The rule these pin: a CCC position may be stated in credits at any time,
 * but may never be given a rupee value until a real traded price exists. No
 * Carbon Credit Certificate has traded — the market opens on IEX in October
 * 2026 — so the pending states are the normal case, not an edge case.
 */

const BEFORE_MARKET_OPENS = new Date(Date.UTC(2026, 7, 14));
const AFTER_MARKET_OPENS = new Date(Date.UTC(2026, 10, 15));

const surplus: CctsCccPositionResolved = {
  pending: false,
  targetIntensity: 2.1,
  actualIntensity: 1.9,
  deltaTco2e: 4000,
  isSurplus: true,
};

const deficit: CctsCccPositionResolved = {
  pending: false,
  targetIntensity: 2.1,
  actualIntensity: 2.3,
  deltaTco2e: -4000,
  isSurplus: false,
};

// The module-level price cache is shared, exactly as it is in production —
// clear it so a test that sets a price can't leak into one that must not have one.
const clearPrice = () => setCccMarketPrice(0, "cleared for test", new Date(Date.UTC(2026, 9, 1)));

beforeEach(clearPrice);

describe("CCC market opening", () => {
  it("opens October 2026, not before", () => {
    expect(CCC_TRADING_OPENS_DATE.toISOString().slice(0, 10)).toBe("2026-10-01");
    expect(isCccMarketOpen(BEFORE_MARKET_OPENS)).toBe(false);
    expect(isCccMarketOpen(AFTER_MARKET_OPENS)).toBe(true);
  });

  it("reports market-not-open rather than a missing price before trading starts", () => {
    const status = getCccMarketPriceStatus(BEFORE_MARKET_OPENS);
    expect(status.status).toBe("MARKET_NOT_OPEN");
    expect(status).not.toHaveProperty("pricePerCreditInr");
  });

  it("reports price-pending once trading is open but nothing has been recorded", () => {
    expect(getCccMarketPriceStatus(AFTER_MARKET_OPENS).status).toBe("PRICE_PENDING");
  });

  it("treats a non-positive stored value as no price at all, never as zero", () => {
    setCccMarketPrice(0, "seed row — market not yet open", new Date(Date.UTC(2026, 9, 1)));
    expect(getCccMarketPriceStatus(AFTER_MARKET_OPENS).status).toBe("PRICE_PENDING");
  });
});

describe("CCC position", () => {
  it("has no position at all without a notified target", () => {
    const position = computeCctsCccMarketPosition({ pending: true }, AFTER_MARKET_OPENS);
    expect(position.status).toBe("TARGET_PENDING");
  });

  it("states the credits but withholds any value before the market opens", () => {
    const position = computeCctsCccMarketPosition(surplus, BEFORE_MARKET_OPENS);
    expect(position.status).toBe("MARKET_NOT_OPEN");
    if (position.status !== "MARKET_NOT_OPEN") throw new Error("unreachable");
    expect(position.isSurplus).toBe(true);
    expect(position.cccCredits).toBe(4000);
    expect(position).not.toHaveProperty("positionValueInr");
  });

  it("reads the credits off the calculation output rather than recomputing them", () => {
    const position = computeCctsCccMarketPosition(deficit, BEFORE_MARKET_OPENS);
    if (position.status === "TARGET_PENDING") throw new Error("unreachable");
    // Magnitude of the engine's deltaTco2e, with direction carried by isSurplus.
    expect(position.cccCredits).toBe(4000);
    expect(position.isSurplus).toBe(false);
  });

  it("values a surplus at the recorded price with no penalty exposure", () => {
    setCccMarketPrice(1500, "IEX — CCC compliance market close", new Date(Date.UTC(2026, 10, 10)));
    const position = computeCctsCccMarketPosition(surplus, AFTER_MARKET_OPENS);
    if (position.status !== "VALUED") throw new Error("expected VALUED");
    expect(position.positionValueInr).toBe(6_000_000);
    expect(position.penaltyExposureInr).toBeNull();
  });

  it("prices a deficit's non-compliance exposure at twice the market price", () => {
    setCccMarketPrice(1500, "IEX — CCC compliance market close", new Date(Date.UTC(2026, 10, 10)));
    const position = computeCctsCccMarketPosition(deficit, AFTER_MARKET_OPENS);
    if (position.status !== "VALUED") throw new Error("expected VALUED");
    expect(position.positionValueInr).toBe(6_000_000);
    expect(position.penaltyExposureInr).toBe(12_000_000);
    expect(position.penaltyMultiplier).toBe(2);
  });
});

describe("CCTS compliance cycle", () => {
  it("settles the financial year that closed the preceding 31 March", () => {
    // 31 Jul 2026 is the compliance date for FY2025-26.
    const cycle = nextCctsComplianceCycle(new Date(Date.UTC(2026, 7, 14)));
    expect(cycle.deadline.toISOString().slice(0, 10)).toBe("2027-07-31");
    expect(cycle.complianceYear).toBe("FY2026-27");

    const beforeDeadline = nextCctsComplianceCycle(new Date(Date.UTC(2026, 5, 1)));
    expect(beforeDeadline.deadline.toISOString().slice(0, 10)).toBe("2026-07-31");
    expect(beforeDeadline.complianceYear).toBe("FY2025-26");
  });
});
