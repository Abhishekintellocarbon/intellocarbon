import { fyLabelFor } from "../data/complianceDeadlines";

/**
 * Renewable vs non-renewable energy, tracked across reporting periods.
 *
 * The company dashboard already shows this split as a donut for the latest
 * financial year (energyComposition in companyDashboard.service.ts). What was
 * missing is the direction of travel, which is the part a reader actually
 * acts on — a 12% renewable share means something different when last year
 * was 4% than when it was 20%.
 *
 * As with waste circularity, two sources exist and they measure different
 * denominators:
 *
 *   BRSR Core (preferred) reports renewableEnergyConsumptionGj and
 *   nonRenewableEnergyConsumptionGj — TOTAL energy, fuel combustion included.
 *   This is what the existing donut uses, so the trend agrees with it.
 *
 *   Activity data (fallback) carries gridElectricityMwh,
 *   renewableElectricityMwh and steamImportedGj. That yields a renewable share
 *   of PURCHASED ELECTRICITY AND STEAM only — it cannot see diesel, furnace
 *   oil or natural gas burned on site, which for an industrial facility is
 *   usually the larger number.
 *
 * A renewable share computed on the second basis is therefore systematically
 * higher than one computed on the first, for the same company, in the same
 * year. The trend reports which basis it used and the UI states it. Blending
 * or silently switching between them mid-trend would draw a line that bends
 * because the denominator changed, not because anything happened.
 */

export type EnergyMixSource = "BRSR_CORE" | "ACTIVITY_DATA";

export interface EnergyMixPoint {
  periodLabel: string;
  renewableGj: number;
  nonRenewableGj: number;
  totalGj: number;
  renewablePct: number;
}

export interface EnergyMixTrend {
  hasData: boolean;
  source: EnergyMixSource | null;
  points: EnergyMixPoint[];
  /**
   * True when the split covers purchased electricity and steam only, rather
   * than total energy including on-site fuel combustion.
   */
  electricityOnly: boolean;
  latestRenewablePct: number | null;
  /** Percentage-point move against the previous period. Null with fewer than two points. */
  changePoints: number | null;
}

const MWH_TO_GJ = 3.6;

const round = (value: number, decimals = 3) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const EMPTY: EnergyMixTrend = {
  hasData: false,
  source: null,
  points: [],
  electricityOnly: false,
  latestRenewablePct: null,
  changePoints: null,
};

export interface BrsrEnergyRow {
  reportingPeriod: string;
  renewableEnergyConsumptionGj: number | null;
  nonRenewableEnergyConsumptionGj: number | null;
}

export interface ActivityEnergyRow {
  periodStart: Date | null;
  gridElectricityMwh: number;
  renewableElectricityMwh: number;
  steamImportedGj: number;
}

const toPoints = (byPeriod: Map<string, { renewable: number; nonRenewable: number }>): EnergyMixPoint[] =>
  Array.from(byPeriod.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([periodLabel, v]) => {
      const total = v.renewable + v.nonRenewable;
      return {
        periodLabel,
        renewableGj: round(v.renewable),
        nonRenewableGj: round(v.nonRenewable),
        totalGj: round(total),
        renewablePct: total > 0 ? round((v.renewable / total) * 100, 1) : 0,
      };
    })
    // A period whose energy total is zero carries no share to plot, and would
    // draw the line down to 0% as though renewables had been switched off.
    .filter((p) => p.totalGj > 0);

const finish = (points: EnergyMixPoint[], source: EnergyMixSource, electricityOnly: boolean): EnergyMixTrend => {
  if (points.length === 0) return EMPTY;
  const latest = points.at(-1)!;
  const previous = points.length >= 2 ? points.at(-2)! : null;
  return {
    hasData: true,
    source,
    points,
    electricityOnly,
    latestRenewablePct: latest.renewablePct,
    changePoints: previous ? round(latest.renewablePct - previous.renewablePct, 1) : null,
  };
};

export const buildEnergyMixTrend = (brsrRows: BrsrEnergyRow[], activityRows: ActivityEnergyRow[]): EnergyMixTrend => {
  // BRSR first, and only rows carrying BOTH halves of the split — one half
  // alone gives a share of an unknown total.
  const brsrByPeriod = new Map<string, { renewable: number; nonRenewable: number }>();
  for (const row of brsrRows) {
    if (row.renewableEnergyConsumptionGj == null || row.nonRenewableEnergyConsumptionGj == null) continue;
    const entry = brsrByPeriod.get(row.reportingPeriod) ?? { renewable: 0, nonRenewable: 0 };
    entry.renewable += row.renewableEnergyConsumptionGj;
    entry.nonRenewable += row.nonRenewableEnergyConsumptionGj;
    brsrByPeriod.set(row.reportingPeriod, entry);
  }

  const brsrPoints = toPoints(brsrByPeriod);
  if (brsrPoints.length > 0) return finish(brsrPoints, "BRSR_CORE", false);

  // Fallback: purchased electricity and imported steam from activity data.
  // Grid electricity and steam are treated as non-renewable because neither
  // carries a contractual renewable attribute here — a renewable claim needs
  // a certificate, which is what the REC ledger is for, not an assumption
  // made on this company's behalf.
  const activityByPeriod = new Map<string, { renewable: number; nonRenewable: number }>();
  for (const row of activityRows) {
    if (!row.periodStart) continue;
    const label = fyLabelFor(row.periodStart);
    const entry = activityByPeriod.get(label) ?? { renewable: 0, nonRenewable: 0 };
    entry.renewable += row.renewableElectricityMwh * MWH_TO_GJ;
    entry.nonRenewable += row.gridElectricityMwh * MWH_TO_GJ + row.steamImportedGj;
    activityByPeriod.set(label, entry);
  }

  return finish(toPoints(activityByPeriod), "ACTIVITY_DATA", true);
};

export const ENERGY_MIX_SOURCE_LABELS: Record<EnergyMixSource, string> = {
  BRSR_CORE: "BRSR Core (Attribute 4)",
  ACTIVITY_DATA: "Activity data — purchased electricity and steam",
};

/** Printed under the trend so a share is never read against the wrong denominator. */
export const ENERGY_MIX_SOURCE_NOTES: Record<EnergyMixSource, string> = {
  BRSR_CORE: "Total energy consumption including on-site fuel combustion, as reported in BRSR Core Attribute 4.",
  ACTIVITY_DATA:
    "Purchased electricity and imported steam only. On-site fuel combustion — diesel, furnace oil, natural gas — is not included, and for most industrial facilities that is the larger share of total energy. Report BRSR Core Attribute 4 for a total-energy renewable share.",
};
