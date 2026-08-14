/**
 * Reference data for India's Carbon Credit Trading Scheme (CCTS) compliance
 * mechanism — the counterpart to `cbamReferenceData.ts` / `ukCbamReferenceData.ts`
 * for the Indian regime, and subject to the same rules: real published figures
 * only, an explicit source citation on every value, and no invented
 * placeholder where nothing has been published yet.
 *
 * Nothing in this file feeds the CCTS *calculation* engine — GHG intensity and
 * the CCC delta are computed exactly where they always were (see
 * emissionCalculation.service.ts and cctsPosition in
 * cbamFinancialImpact.service.ts). This file only supplies the market-side
 * facts needed to put a *price* on a CCC position that has already been
 * calculated, plus the calendar fact of when that market opens at all.
 */

/**
 * `name` of the EmissionFactor row holding the CCC market price. The row is
 * superseded (never overwritten) on each update, so selecting on this name
 * returns the full price history — the same arrangement as
 * CBAM_CERTIFICATE_PRICE_FACTOR_NAME, and read back by
 * listCccMarketPriceHistory() in certificatePriceHistory.service.ts.
 */
export const CCC_MARKET_PRICE_FACTOR_NAME = "CCC Market Price";

/**
 * When Carbon Credit Certificates first become tradable.
 *
 * CCC trading opens on the Indian Energy Exchange in October 2026 — before
 * that date there is no market, so there is no price to be pending on and no
 * amount of Super Admin configuration would produce one. This is why the
 * pending state below is two states rather than one: "the market has not
 * opened yet" is a different fact from "the market is open and we have not
 * recorded today's price", and collapsing them would tell a user in August
 * 2026 that a figure is merely missing when in reality it cannot exist.
 *
 * Source: Bureau of Energy Efficiency / Grid Controller of India — CCTS
 * compliance mechanism trading on IEX from October 2026.
 */
export const CCC_TRADING_OPENS_DATE = new Date(Date.UTC(2026, 9, 1, 0, 0, 0));
export const CCC_TRADING_OPENS_LABEL = "October 2026";
export const CCC_TRADING_VENUE = "Indian Energy Exchange (IEX)";

/**
 * A CCTS entity that misses its notified intensity target and does not
 * surrender the shortfall in CCCs pays an environmental compensation set at
 * twice the average CCC trading price for the compliance year — so a deficit
 * carries a priced consequence, not just an obligation to buy.
 *
 * Source: Ministry of Environment, Forest and Climate Change — Environment
 * (Protection) Amendment Rules notifying the CCTS compliance mechanism;
 * environmental compensation at twice the average CCC market price.
 */
export const CCTS_NON_COMPLIANCE_PENALTY_MULTIPLIER = 2;
export const CCTS_NON_COMPLIANCE_PENALTY_SOURCE =
  "MoEFCC — Environment (Protection) Amendment Rules, CCTS compliance mechanism: environmental compensation equal to twice the average CCC market price for the compliance year.";

export interface CccMarketPriceReference {
  pricePerCreditInr: number;
  /** Date the recorded price is as of, ISO yyyy-mm-dd. */
  asOfDate: string;
  source: string;
}

/**
 * The CCC market price.
 *
 * Null until configured, and deliberately with no code default to fall back
 * to — unlike the EU certificate price, which has a published Commission
 * figure to seed from, no CCC has ever traded. Populated at runtime from the
 * Emission Factor Manager's "CCC Market Price" row exactly as the EU price and
 * the UK CBAM rate are (see updateCccMarketPrice() in
 * services/emissionFactor.service.ts and hydrateEmissionFactorCache(), which
 * loads it at server startup). Every caller must handle null.
 */
let currentCccMarketPrice: CccMarketPriceReference | null = null;

export const getCccMarketPrice = (): CccMarketPriceReference | null => currentCccMarketPrice;

/** A non-positive value means "no price recorded" and clears the price rather than storing a zero. */
export const setCccMarketPrice = (value: number, source: string, validFrom: Date): void => {
  currentCccMarketPrice =
    value > 0
      ? {
          pricePerCreditInr: value,
          asOfDate: validFrom.toISOString().slice(0, 10),
          source,
        }
      : null;
};

/** Whether the CCC market has opened as at `now`. */
export const isCccMarketOpen = (now: Date): boolean => now >= CCC_TRADING_OPENS_DATE;
