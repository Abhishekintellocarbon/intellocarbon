import type { Supplier } from "@prisma/client";

/**
 * Supplier ESG scorecard.
 *
 * ===========================================================================
 * EVERY FIGURE HERE IS ABOUT THE SUPPLIERS THE COMPANY CHOSE TO LIST.
 *
 * "80% of suppliers have an ESG disclosure on file" is only meaningful
 * alongside how many suppliers that is and what share of spend they represent.
 * Eighty per cent of five listed suppliers covering 12% of spend is a very
 * different statement from the same percentage across the whole supply base,
 * and the first reads exactly like the second unless the denominator travels
 * with it.
 *
 * So coverage is always reported with the supplier count and, where spend
 * shares are recorded, the share of spend those suppliers represent. The UI
 * renders all three together.
 *
 * Self-assessed throughout. The risk flag is the company's own judgement about
 * its own supplier; `hasEsgDisclosure` records whether a disclosure is held,
 * not whether one exists or whether it is any good. Intellocarbon does not
 * contact, screen, rate or verify suppliers — a scorecard that looked like a
 * rating would be the failure here, since the output is a table of other
 * companies' names.
 * ===========================================================================
 */

export interface SupplierRiskBreakdown {
  LOW: number;
  MEDIUM: number;
  HIGH: number;
  NOT_ASSESSED: number;
}

/** The aggregate picture from GRI 308/414, shown alongside rather than merged. */
export interface GriSupplierAggregates {
  hasData: boolean;
  environmentalScreenedPct: number | null;
  socialScreenedPct: number | null;
  assessedCount: number | null;
  withNegativeImpactsCount: number | null;
  periodLabel: string | null;
}

/**
 * One listed supplier, as the dashboard row renders it.
 *
 * The three states here are the three this platform actually holds per
 * supplier. There is deliberately no per-ESG-category breakdown: Supplier
 * carries no category columns, and GRI 308/414 are company-level aggregates
 * about new suppliers screened in a period — they hold no per-supplier detail
 * to attribute back. A category grid would therefore be drawing states nobody
 * ever entered, which is the one thing this scorecard must not do, since its
 * output is a table of other companies' names.
 *
 * `disclosureType` is free text the customer typed ("CDP response 2025"). It
 * is shown as recorded and never parsed into a status.
 */
export interface SupplierScorecardRow {
  id: string;
  name: string;
  sector: string | null;
  country: string | null;
  hasEsgDisclosure: boolean;
  disclosureType: string | null;
  riskFlag: Supplier["riskFlag"];
  spendSharePct: number | null;
  /** ISO date, or null where no review has been recorded. Never defaulted to today. */
  lastReviewedAt: string | null;
}

export interface SupplierScorecard {
  hasData: boolean;
  supplierCount: number;
  withDisclosureCount: number;
  /** Share of LISTED suppliers with a disclosure on file. Never of the supply base. */
  disclosureCoveragePct: number | null;
  /**
   * Share of spend the listed suppliers represent, where recorded. Null when
   * no spend shares have been entered — which is the common case, and the
   * reason coverage must never be presented as supply-chain-wide.
   */
  spendCoveredPct: number | null;
  riskBreakdown: SupplierRiskBreakdown;
  highRiskWithoutDisclosure: number;
  gri: GriSupplierAggregates;
  /**
   * Every listed supplier, so the dashboard can show the actual rows rather
   * than only the percentage. Ordered the way the card reads by default:
   * suppliers still missing a disclosure first, because they are the ones
   * with something outstanding, then by spend share, then by name.
   */
  rows: SupplierScorecardRow[];
}

const round = (value: number, decimals = 1) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

export interface GriSupplierRow {
  reportingPeriod: string;
  env?: {
    newSuppliersScreenedPct: number | null;
    suppliersAssessedCount: number | null;
    suppliersWithNegativeImpactsCount: number | null;
  } | null;
  social?: { newSuppliersScreenedPct: number | null } | null;
}

const EMPTY_GRI: GriSupplierAggregates = {
  hasData: false,
  environmentalScreenedPct: null,
  socialScreenedPct: null,
  assessedCount: null,
  withNegativeImpactsCount: null,
  periodLabel: null,
};

const buildGriAggregates = (rows: GriSupplierRow[]): GriSupplierAggregates => {
  const latest = rows
    .filter((r) => r.env != null || r.social != null)
    .sort((a, b) => a.reportingPeriod.localeCompare(b.reportingPeriod))
    .at(-1);
  if (!latest) return EMPTY_GRI;

  const aggregates: GriSupplierAggregates = {
    hasData: true,
    environmentalScreenedPct: latest.env?.newSuppliersScreenedPct ?? null,
    socialScreenedPct: latest.social?.newSuppliersScreenedPct ?? null,
    assessedCount: latest.env?.suppliersAssessedCount ?? null,
    withNegativeImpactsCount: latest.env?.suppliersWithNegativeImpactsCount ?? null,
    periodLabel: latest.reportingPeriod,
  };

  // A row that exists but holds nothing is not data.
  const anyValue = [
    aggregates.environmentalScreenedPct,
    aggregates.socialScreenedPct,
    aggregates.assessedCount,
    aggregates.withNegativeImpactsCount,
  ].some((v) => v != null);

  return anyValue ? aggregates : EMPTY_GRI;
};

export const buildSupplierScorecard = (suppliers: Supplier[], griRows: GriSupplierRow[] = []): SupplierScorecard => {
  const gri = buildGriAggregates(griRows);

  const riskBreakdown: SupplierRiskBreakdown = { LOW: 0, MEDIUM: 0, HIGH: 0, NOT_ASSESSED: 0 };
  let withDisclosure = 0;
  let spendSum = 0;
  let anySpendRecorded = false;
  let highRiskWithoutDisclosure = 0;

  for (const supplier of suppliers) {
    riskBreakdown[supplier.riskFlag] += 1;
    if (supplier.hasEsgDisclosure) withDisclosure += 1;
    if (supplier.spendSharePct != null) {
      anySpendRecorded = true;
      spendSum += supplier.spendSharePct;
    }
    if (supplier.riskFlag === "HIGH" && !supplier.hasEsgDisclosure) highRiskWithoutDisclosure += 1;
  }

  return {
    hasData: suppliers.length > 0 || gri.hasData,
    supplierCount: suppliers.length,
    withDisclosureCount: withDisclosure,
    disclosureCoveragePct: suppliers.length > 0 ? round((withDisclosure / suppliers.length) * 100) : null,
    // Capped at 100: spend shares are entered per supplier and can be keyed to
    // sum above 100, which is a data-entry problem rather than a supply base
    // larger than itself.
    spendCoveredPct: anySpendRecorded ? Math.min(100, round(spendSum)) : null,
    riskBreakdown,
    highRiskWithoutDisclosure,
    gri,
    rows: buildRows(suppliers),
  };
};

/**
 * Outstanding first: a supplier with no disclosure on file is the one the
 * reader can act on, so it leads rather than being sorted to the bottom by
 * name. Within each group, larger spend share first — a gap at 40% of spend
 * matters more than the same gap at 2% — and suppliers with no recorded share
 * sort last rather than as zero, since "not recorded" is not "small".
 */
const buildRows = (suppliers: Supplier[]): SupplierScorecardRow[] =>
  suppliers
    .map((supplier) => ({
      id: supplier.id,
      name: supplier.name,
      sector: supplier.sector,
      country: supplier.country,
      hasEsgDisclosure: supplier.hasEsgDisclosure,
      disclosureType: supplier.esgDisclosureType,
      riskFlag: supplier.riskFlag,
      spendSharePct: supplier.spendSharePct,
      lastReviewedAt: supplier.lastReviewedAt ? supplier.lastReviewedAt.toISOString() : null,
    }))
    .sort((a, b) => {
      if (a.hasEsgDisclosure !== b.hasEsgDisclosure) return a.hasEsgDisclosure ? 1 : -1;
      const spend = (row: SupplierScorecardRow) => (row.spendSharePct == null ? -1 : row.spendSharePct);
      if (spend(a) !== spend(b)) return spend(b) - spend(a);
      return a.name.localeCompare(b.name);
    });

export const SUPPLIER_RISK_LABELS: Record<string, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  NOT_ASSESSED: "Not assessed",
};

/** Rendered with the coverage figure. Asserted on substance by tests. */
export const SUPPLIER_SCORECARD_NOTICE =
  "Coverage is of the suppliers you have listed here, not of your whole supply base. Risk flags are your own " +
  "assessment of your own suppliers — Intellocarbon does not contact, screen, rate or verify them, and a " +
  "disclosure on file is not a judgement on what it contains.";
