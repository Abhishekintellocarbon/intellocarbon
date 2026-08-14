import { prisma } from "../config/prisma";
import { quarterLabelFor, CBAM_CERTIFICATE_PRICE_FACTOR_NAME } from "../data/cbamReferenceData";
import { CCC_MARKET_PRICE_FACTOR_NAME } from "../data/cctsReferenceData";

/**
 * CBAM certificate reference price history.
 *
 * Not a new data source: every quarterly update made through the Super Admin
 * Emission Factor Manager already supersedes the previous row rather than
 * overwriting it (see supersedeRow in emissionFactor.service.ts — it flips
 * isCurrent to false and stamps validTo, then inserts a new row). That
 * supersession chain *is* the price history; this service just reads it back
 * in order.
 *
 * The quarter label is derived with the same quarterLabelFor the live price
 * uses, so a point on this chart is labelled identically to the price shown
 * everywhere else. Deriving rather than storing it also means a historical row
 * written before labels existed still lands in the right quarter.
 */

export interface CertificatePricePoint {
  /** e.g. "Q2 2026" — the quarter the price applies to, not the publication quarter. */
  quarterLabel: string;
  pricePerTonneEur: number;
  /** Date the Commission's figure took effect, ISO. */
  validFrom: string;
  source: string;
  /** True for the single row still in force — the value the calculator uses. */
  isCurrent: boolean;
}

export const listCbamCertificatePriceHistory = async (): Promise<CertificatePricePoint[]> => {
  const rows = await prisma.emissionFactor.findMany({
    where: { name: CBAM_CERTIFICATE_PRICE_FACTOR_NAME },
    orderBy: { validFrom: "asc" },
    select: { value: true, source: true, validFrom: true, isCurrent: true },
  });

  return rows.map((row) => ({
    quarterLabel: quarterLabelFor(row.validFrom),
    pricePerTonneEur: row.value,
    validFrom: row.validFrom.toISOString(),
    source: row.source,
    isCurrent: row.isCurrent,
  }));
};

export interface CccMarketPricePoint {
  /** Date this price was recorded as of, ISO. */
  asOfDate: string;
  pricePerCreditInr: number;
  source: string;
  /** True for the single row still in force — the price a CCC position is valued at. */
  isCurrent: boolean;
}

/**
 * CCC market price history — the same supersession chain read back, for the
 * "CCC Market Price" row instead of the EU certificate one.
 *
 * The one difference from the CBAM reader above: rows with a non-positive
 * value are dropped rather than returned. The seed row is a zero meaning "no
 * price recorded" (CCCs have never traded — the market opens on IEX in
 * October 2026), and a zero passed through to a chart would draw as a real
 * ₹0 print. Same reason getCccMarketPrice() maps a non-positive value to null.
 */
export const listCccMarketPriceHistory = async (): Promise<CccMarketPricePoint[]> => {
  const rows = await prisma.emissionFactor.findMany({
    where: { name: CCC_MARKET_PRICE_FACTOR_NAME, value: { gt: 0 } },
    orderBy: { validFrom: "asc" },
    select: { value: true, source: true, validFrom: true, isCurrent: true },
  });

  return rows.map((row) => ({
    asOfDate: row.validFrom.toISOString(),
    pricePerCreditInr: row.value,
    source: row.source,
    isCurrent: row.isCurrent,
  }));
};
