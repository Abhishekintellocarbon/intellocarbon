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

/** Next upcoming CBAM quarterly filing deadline on/after `now` (whether or not that quarter's window is currently open). */
export const nextCbamDeadline = (now: Date): Date => {
  const year = now.getUTCFullYear();
  for (const q of CBAM_QUARTERS) {
    const deadline = dateFor(year, q.deadline);
    if (now <= deadline) return deadline;
  }
  return dateFor(year + 1, CBAM_QUARTERS[0].deadline);
};

/** Next upcoming CCTS annual compliance deadline (31 Jul) on/after `now`. */
export const nextCctsDeadline = (now: Date): Date => {
  const year = now.getUTCFullYear();
  const thisYearDeadline = dateFor(year, CCTS_DEADLINE);
  return now <= thisYearDeadline ? thisYearDeadline : dateFor(year + 1, CCTS_DEADLINE);
};

/**
 * The financial year currently in progress, e.g. "FY2026-27" from any date in
 * Apr 2026 - Mar 2027. Matches the frontend's BRSR "suggested FY" convention
 * (see frontend/src/app/facilities/[id]/brsr/new/page.tsx) — the standard
 * April-March Indian FY, independent of a company's own reportingFyStartMonth.
 */
export const currentBrsrFyLabel = (now: Date): string => {
  const year = now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return `FY${year}-${String((year + 1) % 100).padStart(2, "0")}`;
};

/** 31 March close of the financial year currently in progress — the BRSR Core submission deadline shown on the facility dashboard. */
export const currentBrsrFyDeadline = (now: Date): Date => {
  const startYear = now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return dateFor(startYear + 1, { month: 3, day: 31 });
};

const BRSR_REPORTING_PERIOD_REGEX = /^FY(\d{4})-\d{2}$/;

/** Parses a "FY2025-26" style BRSR reporting period into its start year (2025). */
export const parseBrsrFyStartYear = (reportingPeriod: string): number => {
  const match = reportingPeriod.match(BRSR_REPORTING_PERIOD_REGEX);
  if (!match) {
    throw new Error(`Invalid BRSR reporting period "${reportingPeriod}" — expected e.g. "FY2025-26"`);
  }
  return Number(match[1]);
};

/**
 * BRSR Core is an annual (not quarterly) disclosure, so its report-generation
 * window isn't a recurring calendar window like CBAM/CCTS — each FY gets its
 * own one-time window: it unlocks 1 April the year after that FY closes (once
 * the year's data is complete) and stays open for a full 12 months, through
 * 31 March the year after that.
 */
export const isBrsrReportWindowOpen = (reportingPeriod: string, now: Date): boolean => {
  const startYear = parseBrsrFyStartYear(reportingPeriod);
  const unlock = new Date(Date.UTC(startYear + 1, 3, 1, 0, 0, 0));
  const deadline = new Date(Date.UTC(startYear + 2, 2, 31, 23, 59, 59));
  return now >= unlock && now <= deadline;
};

/** This reporting period's fixed unlock date (for the locked-state message). */
export const brsrUnlockDate = (reportingPeriod: string): Date => {
  const startYear = parseBrsrFyStartYear(reportingPeriod);
  return new Date(Date.UTC(startYear + 1, 3, 1, 0, 0, 0));
};

/** Calendar-quarter label for a date, e.g. "2026-Q3" — used in dedupe keys. */
export const quarterLabel = (now: Date): string => {
  const quarter = Math.floor(now.getUTCMonth() / 3) + 1;
  return `${now.getUTCFullYear()}-Q${quarter}`;
};
