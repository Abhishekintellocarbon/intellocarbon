// Regulatory calendar for CBAM and CCTS — fixed dates, not user data, so
// this lives as static config (matching emissionFactors.ts/cbamReferenceData.ts)
// rather than a database table. Sector-agnostic: applies identically across
// all six live CBAM sectors (Steel, Cement, Aluminium, Fertilizers, Hydrogen,
// Electricity) — only the emission factors differ, and those are handled
// entirely by the existing calculation engine, untouched by this file.

export interface MonthDay {
  month: number; // 1-12
  day: number;
}

export const CCTS_DEADLINE: MonthDay = { month: 7, day: 31 };
export const CCTS_REPORT_UNLOCK: MonthDay = { month: 4, day: 1 };
export const CCTS_BASELINE_FY = "FY2023-24";

export interface CbamQuarter {
  quarter: 1 | 2 | 3 | 4;
  unlock: MonthDay;
  deadline: MonthDay;
}

export const CBAM_QUARTERS: CbamQuarter[] = [
  { quarter: 1, unlock: { month: 1, day: 1 }, deadline: { month: 1, day: 31 } },
  { quarter: 2, unlock: { month: 4, day: 1 }, deadline: { month: 4, day: 30 } },
  { quarter: 3, unlock: { month: 7, day: 1 }, deadline: { month: 7, day: 31 } },
  { quarter: 4, unlock: { month: 10, day: 1 }, deadline: { month: 10, day: 31 } },
];

export const CBAM_CERTIFICATE_SURRENDER: MonthDay = { month: 5, day: 31 };

const dateFor = (year: number, md: MonthDay): Date => new Date(Date.UTC(year, md.month - 1, md.day, 23, 59, 59));

const daysBetween = (from: Date, to: Date): number =>
  Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));

/** CCTS report generation is open from 1 Apr through 31 Jul of the same year. */
export const isCctsReportWindowOpen = (now: Date): boolean => {
  const year = now.getUTCFullYear();
  return now >= dateFor(year, CCTS_REPORT_UNLOCK) && now <= dateFor(year, CCTS_DEADLINE);
};

/** Next CCTS window unlock date on/after `now` (for the locked-state message). */
export const nextCctsUnlockDate = (now: Date): Date => {
  const year = now.getUTCFullYear();
  const thisYearUnlock = dateFor(year, CCTS_REPORT_UNLOCK);
  return now <= dateFor(year, CCTS_DEADLINE) ? thisYearUnlock : dateFor(year + 1, CCTS_REPORT_UNLOCK);
};

/** The CBAM quarter (if any) whose unlock..deadline window contains `now`. */
export const getOpenCbamQuarter = (now: Date): CbamQuarter | null => {
  const year = now.getUTCFullYear();
  for (const q of CBAM_QUARTERS) {
    if (now >= dateFor(year, q.unlock) && now <= dateFor(year, q.deadline)) return q;
  }
  return null;
};

export const isCbamReportWindowOpen = (now: Date): boolean => getOpenCbamQuarter(now) !== null;

/** Next CBAM window unlock date on/after `now` (for the locked-state message). */
export const nextCbamUnlockDate = (now: Date): Date => {
  const year = now.getUTCFullYear();
  for (const q of CBAM_QUARTERS) {
    const unlock = dateFor(year, q.unlock);
    if (now <= unlock) return unlock;
  }
  // Past this year's last quarter — next window is next year's Q1.
  return dateFor(year + 1, CBAM_QUARTERS[0].unlock);
};

export const daysUntil = (now: Date, target: Date): number => daysBetween(now, target);

/** Calendar-quarter label for a date, e.g. "2026-Q3" — used in dedupe keys. */
export const quarterLabel = (now: Date): string => {
  const quarter = Math.floor(now.getUTCMonth() / 3) + 1;
  return `${now.getUTCFullYear()}-Q${quarter}`;
};
