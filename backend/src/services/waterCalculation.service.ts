import type { WaterEntry } from "@prisma/client";
import { WATER_SOURCE_LIBRARY, WATER_VOLUME_UNIT } from "../data/waterFactors";
import { round } from "./dashboardShared.helpers";

/**
 * ISO 14046 water footprint for one reporting period.
 *
 * Pure and synchronous — it takes the WaterEntry rows already loaded with an
 * ActivityData row plus that row's production quantity, and returns the
 * footprint. Unlike emissionCalculation.service.ts, nothing here is persisted:
 * the GHG result is stored because it is the audited artefact a CBAM/CCTS
 * report and a verification request are drawn against, whereas the water
 * footprint is a total, a difference and a ratio over columns that are all
 * already stored. Persisting it would add a table whose only possible failure
 * mode is disagreeing with its own inputs. Recomputed on read instead, the way
 * getCompanyBrsrAnalytics already treats BRSR's water figures.
 *
 * Consumption is derived, never entered — see the WaterEntry model comment.
 */

export interface WaterSourceBreakdownEntry {
  sourceType: string;
  label: string;
  category: string;
  withdrawnM3: number;
  dischargedM3: number;
  consumedM3: number;
  /** Withdrawal x the source's freshwater factor (or this line's override). */
  freshwaterWithdrawnM3: number;
  freshwaterFactorApplied: number;
  /** Share of total withdrawal, for the breakdown chart. */
  pctOfWithdrawal: number;
}

export interface WaterFootprint {
  hasData: boolean;
  unit: string;
  totalWithdrawnM3: number;
  totalDischargedM3: number;
  /** Withdrawn - discharged. Never negative — see clampConsumption below. */
  totalConsumedM3: number;
  /** Withdrawal excluding reclaimed water — the ISO 14046 freshwater figure. */
  freshwaterWithdrawnM3: number;
  /** Reclaimed share of total withdrawal, %. The circularity headline. */
  recycledSharePct: number;
  /**
   * m³ consumed per tonne of product, reusing ActivityData.productionQuantityT
   * — the same denominator the GHG intensity uses. null when production is
   * absent or zero rather than 0, which would read as "no water per tonne".
   */
  waterIntensityM3PerTonne: number | null;
  /** Withdrawal per tonne — reported alongside intensity, as BRSR does. */
  withdrawalIntensityM3PerTonne: number | null;
  sources: WaterSourceBreakdownEntry[];
  /**
   * True when discharge exceeds withdrawal on at least one source, which
   * means the inventory doesn't balance. Surfaced rather than silently
   * clamped away, because it is a data-entry error worth showing the user.
   */
  hasDischargeExceedingWithdrawal: boolean;
}

const EMPTY_FOOTPRINT: WaterFootprint = {
  hasData: false,
  unit: WATER_VOLUME_UNIT,
  totalWithdrawnM3: 0,
  totalDischargedM3: 0,
  totalConsumedM3: 0,
  freshwaterWithdrawnM3: 0,
  recycledSharePct: 0,
  waterIntensityM3PerTonne: null,
  withdrawalIntensityM3PerTonne: null,
  sources: [],
  hasDischargeExceedingWithdrawal: false,
};

/**
 * Consumption cannot be negative: discharging more than was withdrawn in a
 * period is a metering or boundary error, not water created on site. The raw
 * imbalance is reported through hasDischargeExceedingWithdrawal so the number
 * shown stays physical without hiding the problem.
 */
const clampConsumption = (withdrawn: number, discharged: number) => Math.max(0, withdrawn - discharged);

const resolveFreshwaterFactor = (entry: WaterEntry): number => {
  if (entry.freshwaterFactorOverride != null) return entry.freshwaterFactorOverride;
  return WATER_SOURCE_LIBRARY[entry.sourceType]?.freshwaterFactor ?? 1;
};

export const buildWaterFootprint = (
  entries: WaterEntry[],
  productionQuantityT: number | null,
): WaterFootprint => {
  if (entries.length === 0) return EMPTY_FOOTPRINT;

  let totalWithdrawn = 0;
  let totalDischarged = 0;
  let freshwaterWithdrawn = 0;
  let imbalanced = false;

  // Several rows can share a source type (two borewells, say) — aggregate by
  // source so the breakdown has one row per source, matching the chart.
  const bySource = new Map<string, { withdrawn: number; discharged: number; freshwater: number }>();

  for (const entry of entries) {
    const factor = resolveFreshwaterFactor(entry);
    const freshwater = entry.withdrawnM3 * factor;

    if (entry.dischargedM3 > entry.withdrawnM3) imbalanced = true;

    totalWithdrawn += entry.withdrawnM3;
    totalDischarged += entry.dischargedM3;
    freshwaterWithdrawn += freshwater;

    const bucket = bySource.get(entry.sourceType) ?? { withdrawn: 0, discharged: 0, freshwater: 0 };
    bucket.withdrawn += entry.withdrawnM3;
    bucket.discharged += entry.dischargedM3;
    bucket.freshwater += freshwater;
    bySource.set(entry.sourceType, bucket);
  }

  const totalConsumed = clampConsumption(totalWithdrawn, totalDischarged);
  const recycledWithdrawn = totalWithdrawn - freshwaterWithdrawn;

  const sources: WaterSourceBreakdownEntry[] = Array.from(bySource.entries())
    .map(([sourceType, v]) => {
      const definition = WATER_SOURCE_LIBRARY[sourceType];
      return {
        sourceType,
        // An unrecognised key can only come from a library entry removed after
        // the row was written; show the raw key rather than dropping the volume.
        label: definition?.label ?? sourceType,
        category: definition?.category ?? "FRESHWATER",
        withdrawnM3: round(v.withdrawn),
        dischargedM3: round(v.discharged),
        consumedM3: round(clampConsumption(v.withdrawn, v.discharged)),
        freshwaterWithdrawnM3: round(v.freshwater),
        freshwaterFactorApplied: v.withdrawn > 0 ? round(v.freshwater / v.withdrawn, 3) : 0,
        pctOfWithdrawal: totalWithdrawn > 0 ? round((v.withdrawn / totalWithdrawn) * 100, 1) : 0,
      };
    })
    .sort((a, b) => b.withdrawnM3 - a.withdrawnM3);

  const canDivide = productionQuantityT != null && productionQuantityT > 0;

  return {
    hasData: true,
    unit: WATER_VOLUME_UNIT,
    totalWithdrawnM3: round(totalWithdrawn),
    totalDischargedM3: round(totalDischarged),
    totalConsumedM3: round(totalConsumed),
    freshwaterWithdrawnM3: round(freshwaterWithdrawn),
    recycledSharePct: totalWithdrawn > 0 ? round((recycledWithdrawn / totalWithdrawn) * 100, 1) : 0,
    waterIntensityM3PerTonne: canDivide ? round(totalConsumed / productionQuantityT, 3) : null,
    withdrawalIntensityM3PerTonne: canDivide ? round(totalWithdrawn / productionQuantityT, 3) : null,
    sources,
    hasDischargeExceedingWithdrawal: imbalanced,
  };
};

/**
 * Company-wide rollup for the ESG Overview: sums the per-period footprints of
 * every submitted entry that has water data, and blends intensity as
 * total consumption / total production rather than averaging the per-entry
 * ratios — an unweighted mean would let a tiny facility swing the number as
 * hard as the largest one.
 */
export interface WaterFootprintRollup extends WaterFootprint {
  entriesWithWater: number;
  facilitiesReporting: number;
}

export const rollUpWaterFootprints = (
  rows: { facilityId: string; productionQuantityT: number | null; waterEntries: WaterEntry[] }[],
): WaterFootprintRollup => {
  const withWater = rows.filter((r) => r.waterEntries.length > 0);
  if (withWater.length === 0) {
    return { ...EMPTY_FOOTPRINT, entriesWithWater: 0, facilitiesReporting: 0 };
  }

  const allEntries = withWater.flatMap((r) => r.waterEntries);
  // Only production from periods that actually reported water belongs in the
  // intensity denominator — including a period with no water inventory would
  // understate m³/t by inflating the divisor.
  const totalProduction = withWater.reduce((sum, r) => sum + (r.productionQuantityT ?? 0), 0);

  const combined = buildWaterFootprint(allEntries, totalProduction > 0 ? totalProduction : null);

  return {
    ...combined,
    entriesWithWater: withWater.length,
    facilitiesReporting: new Set(withWater.map((r) => r.facilityId)).size,
  };
};
