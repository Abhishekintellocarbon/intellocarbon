import { fyLabelFor, parseBrsrFyStartYear } from "../data/complianceDeadlines";

/**
 * Renewable Energy Certificate coverage — how much of the electricity that
 * needs a contractual renewable attribute actually has one.
 *
 * Three things this deliberately does not do, each of which would inflate the
 * number:
 *
 *   It does not sum every certificate ever bought against a single year.
 *   Market-based accounting expects a certificate's vintage — the year the
 *   underlying generation happened — to match the consumption being claimed
 *   against. Certificates whose vintage matches no reported consumption year
 *   are reported separately as unmatched rather than quietly counted.
 *
 *   It does not measure coverage against total electricity. Electricity
 *   already reported as renewable (on-site generation, a PPA recorded in
 *   renewableElectricityMwh) carries its attribute already; applying
 *   certificates to it as well would claim the same megawatt-hour twice. The
 *   denominator is grid electricity — the part with no attribute.
 *
 *   It does not cap coverage at 100% silently. Holding more certificates than
 *   grid consumption is a real situation (over-procurement, or certificates
 *   bought against a facility not reporting here) and is flagged, because the
 *   alternative reading is double counting and the purchaser should look.
 *
 * As with the offsets ledger, nothing here verifies a certificate exists.
 */

export interface RecRow {
  vintageYear: number;
  quantityMwh: number;
}

export interface ActivityElectricityRow {
  periodStart: Date | null;
  gridElectricityMwh: number;
  renewableElectricityMwh: number;
}

export interface RecCoveragePeriod {
  periodLabel: string;
  year: number;
  /** Electricity drawn from the grid — the part a certificate is needed for. */
  gridElectricityMwh: number;
  /** Already renewable by generation or contract; needs no certificate. */
  directRenewableMwh: number;
  totalElectricityMwh: number;
  /** Certificates whose vintage matches this year. */
  recsMatchedMwh: number;
  /** Matched certificates as a share of grid electricity. Can exceed 100. */
  coveragePct: number | null;
  overCovered: boolean;
}

export interface RecCoverage {
  hasData: boolean;
  periods: RecCoveragePeriod[];
  latest: RecCoveragePeriod | null;
  totalRecsMwh: number;
  /**
   * Certificates whose vintage year matches no year with reported electricity.
   * Listed rather than counted — they may be legitimate, but they cannot
   * support a claim against a year this platform has no consumption for.
   */
  unmatchedRecs: { vintageYear: number; quantityMwh: number }[];
  unmatchedMwh: number;
}

const round = (value: number, decimals = 3) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const EMPTY: RecCoverage = {
  hasData: false,
  periods: [],
  latest: null,
  totalRecsMwh: 0,
  unmatchedRecs: [],
  unmatchedMwh: 0,
};

export const buildRecCoverage = (recs: RecRow[], activityRows: ActivityElectricityRow[]): RecCoverage => {
  // Electricity per financial year.
  const byYear = new Map<number, { label: string; grid: number; direct: number }>();
  for (const row of activityRows) {
    if (!row.periodStart) continue;
    const label = fyLabelFor(row.periodStart);
    const year = parseBrsrFyStartYear(label);
    const entry = byYear.get(year) ?? { label, grid: 0, direct: 0 };
    entry.grid += row.gridElectricityMwh;
    entry.direct += row.renewableElectricityMwh;
    byYear.set(year, entry);
  }

  // Certificates per vintage year.
  const recsByVintage = new Map<number, number>();
  for (const rec of recs) {
    recsByVintage.set(rec.vintageYear, (recsByVintage.get(rec.vintageYear) ?? 0) + rec.quantityMwh);
  }

  const totalRecsMwh = round(recs.reduce((total, r) => total + r.quantityMwh, 0));

  const periods: RecCoveragePeriod[] = Array.from(byYear.entries())
    .sort(([a], [b]) => a - b)
    .map(([year, v]) => {
      const matched = recsByVintage.get(year) ?? 0;
      const total = v.grid + v.direct;
      return {
        periodLabel: v.label,
        year,
        gridElectricityMwh: round(v.grid),
        directRenewableMwh: round(v.direct),
        totalElectricityMwh: round(total),
        recsMatchedMwh: round(matched),
        // Null rather than 0 when there is no grid draw at all: a facility
        // running entirely on its own renewable generation needs no
        // certificates, and 0% would read as a failure to procure them.
        coveragePct: v.grid > 0 ? round((matched / v.grid) * 100, 1) : null,
        overCovered: v.grid > 0 && matched > v.grid,
      };
    });

  const consumptionYears = new Set(byYear.keys());
  const unmatchedRecs = Array.from(recsByVintage.entries())
    .filter(([vintage]) => !consumptionYears.has(vintage))
    .map(([vintageYear, quantityMwh]) => ({ vintageYear, quantityMwh: round(quantityMwh) }))
    .sort((a, b) => a.vintageYear - b.vintageYear);

  if (periods.length === 0 && recs.length === 0) return EMPTY;

  return {
    hasData: true,
    periods,
    latest: periods.at(-1) ?? null,
    totalRecsMwh,
    unmatchedRecs,
    unmatchedMwh: round(unmatchedRecs.reduce((total, r) => total + r.quantityMwh, 0)),
  };
};

export const REC_REGISTRY_LABELS: Record<string, string> = {
  INDIA_REC_CERC: "India REC (CERC)",
  I_REC: "I-REC",
  TIGR: "TIGR",
  GUARANTEE_OF_ORIGIN: "Guarantee of Origin (EU)",
  GREEN_E: "Green-e",
  OTHER: "Other",
};

/** Shown with the coverage figure, for the same reason the offsets ledger carries its own. */
export const REC_TRACKING_NOTICE =
  "Certificates are recorded as you enter them. Intellocarbon does not verify, rate or issue them, and does not " +
  "check them against a registry — this is your own record. Coverage is measured against grid electricity only, " +
  "since electricity you already report as renewable carries its attribute without a certificate.";
