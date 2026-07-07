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

// --- Report generation periods (dashboard "Generate Report" modal) ---
// A separate, additive set of helpers from isCbamReportWindowOpen /
// isCctsReportWindowOpen above, which keep gating the older per-activity-data
// report download endpoints untouched. These answer "which single period is
// open for generation right now, and if none, when does the next one open" —
// exactly what the report-generation cards need to render.

export interface ReportPeriodStatus {
  /** Machine-readable period key, e.g. "Q2-2026" or "FY2025-26". */
  period: string;
  /** Human-readable, e.g. "Q2 2026" or "FY2025-26". */
  displayLabel: string;
  isOpen: boolean;
  windowStart: Date;
  windowEnd: Date;
  /** Calendar bounds of the underlying activity data this period reports on (CBAM only — CCTS/BRSR already key off a full FY). */
  dataRangeStart?: Date;
  dataRangeEnd?: Date;
}

// CBAM_QUARTERS' unlock windows recur every quarter, but each one files the
// *preceding* calendar quarter's data — the January window files Q4 of the
// prior year, April files Q1, July files Q2, October files Q3.
const CBAM_TARGET_QUARTER_BY_UNLOCK_MONTH: Record<number, 1 | 2 | 3 | 4> = { 1: 4, 4: 1, 7: 2, 10: 3 };
const QUARTER_MONTH_RANGE: Record<1 | 2 | 3 | 4, [number, number]> = { 1: [1, 3], 2: [4, 6], 3: [7, 9], 4: [10, 12] };

const startOfQuarter = (quarter: 1 | 2 | 3 | 4, year: number): Date =>
  new Date(Date.UTC(year, QUARTER_MONTH_RANGE[quarter][0] - 1, 1, 0, 0, 0));

// Day 0 of the month after endMonth = the last day of endMonth.
const endOfQuarter = (quarter: 1 | 2 | 3 | 4, year: number): Date =>
  new Date(Date.UTC(year, QUARTER_MONTH_RANGE[quarter][1], 0, 23, 59, 59));

const cbamWindowFor = (unlockMonth: number, unlockYear: number) => {
  const q = CBAM_QUARTERS.find((cq) => cq.unlock.month === unlockMonth)!;
  return { windowStart: dateFor(unlockYear, q.unlock), windowEnd: dateFor(unlockYear, q.deadline) };
};

const cbamTargetFor = (unlockMonth: number, unlockYear: number) => ({
  targetQuarter: CBAM_TARGET_QUARTER_BY_UNLOCK_MONTH[unlockMonth],
  targetYear: unlockMonth === 1 ? unlockYear - 1 : unlockYear,
});

/** The CBAM report period whose window is open right now, or the next one that will open. */
export const getCbamReportPeriodStatus = (now: Date): ReportPeriodStatus => {
  const openWindow = getOpenCbamQuarter(now);
  const year = now.getUTCFullYear();

  const unlockMonth = openWindow ? openWindow.unlock.month : nextCbamUnlockDate(now).getUTCMonth() + 1;
  const unlockYear = openWindow ? year : nextCbamUnlockDate(now).getUTCFullYear();

  const { targetQuarter, targetYear } = cbamTargetFor(unlockMonth, unlockYear);
  const { windowStart, windowEnd } = cbamWindowFor(unlockMonth, unlockYear);

  return {
    period: `Q${targetQuarter}-${targetYear}`,
    displayLabel: `Q${targetQuarter} ${targetYear}`,
    isOpen: Boolean(openWindow),
    windowStart,
    windowEnd,
    dataRangeStart: startOfQuarter(targetQuarter, targetYear),
    dataRangeEnd: endOfQuarter(targetQuarter, targetYear),
  };
};

/**
 * CCTS annual GHG Intensity Report — for the dashboard's "Generate Report"
 * flow specifically. Distinct from isCctsReportWindowOpen above (which gates
 * the older per-activity-data CCTS PDF download on a narrower Apr-Jul
 * window): this mirrors BRSR Core's model instead — the report for a given
 * FY opens for generation 1 April the following FY and stays open a full 12
 * months, so at any moment there is exactly one FY whose report is open.
 */
export const getCctsReportPeriodStatus = (now: Date): ReportPeriodStatus => {
  const livingYear = now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  const reportStartYear = livingYear - 1;
  const period = `FY${reportStartYear}-${String((reportStartYear + 1) % 100).padStart(2, "0")}`;
  const windowStart = new Date(Date.UTC(livingYear, 3, 1, 0, 0, 0));
  const windowEnd = new Date(Date.UTC(livingYear + 1, 2, 31, 23, 59, 59));
  return {
    period,
    displayLabel: period,
    isOpen: now >= windowStart && now <= windowEnd,
    windowStart,
    windowEnd,
  };
};

/** Same 12-month-window model as CCTS above, built on BRSR's own reportingPeriod window math. */
export const getBrsrReportPeriodStatus = (now: Date): ReportPeriodStatus => {
  const livingYear = now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  const reportStartYear = livingYear - 1;
  const period = `FY${reportStartYear}-${String((reportStartYear + 1) % 100).padStart(2, "0")}`;
  const windowStart = brsrUnlockDate(period);
  const windowEnd = new Date(Date.UTC(reportStartYear + 2, 2, 31, 23, 59, 59));
  return {
    period,
    displayLabel: period,
    isOpen: isBrsrReportWindowOpen(period, now),
    windowStart,
    windowEnd,
  };
};
