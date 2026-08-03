/**
 * Public-site compliance calendar.
 *
 * These patterns mirror the canonical definitions in
 * `backend/src/data/complianceDeadlines.ts` (CCTS_DEADLINE, CCTS_REPORT_UNLOCK,
 * CBAM_QUARTERS, CBAM_ANNUAL_DECLARATION_DEADLINE). That module is the source of
 * truth for anything inside the product; it is not importable from the frontend
 * build, and the marketing homepage must render without a backend round-trip, so
 * the dated patterns are restated here. Keep the two in step when a deadline moves.
 */

interface MonthDay {
  month: number; // 1-12
  day: number;
}

/** CCTS: report window opens 1 Apr, closes 31 Jul of the same year. */
const CCTS_REPORT_UNLOCK: MonthDay = { month: 4, day: 1 };
const CCTS_DEADLINE: MonthDay = { month: 7, day: 31 };

/** Indian financial year close — the CCTS/BRSR annual cycle boundary. */
const INDIAN_FY_CLOSE: MonthDay = { month: 3, day: 31 };

interface CbamQuarter {
  quarter: 1 | 2 | 3 | 4;
  unlock: MonthDay;
  deadline: MonthDay;
}

const CBAM_QUARTERS: CbamQuarter[] = [
  { quarter: 1, unlock: { month: 1, day: 1 }, deadline: { month: 1, day: 31 } },
  { quarter: 2, unlock: { month: 4, day: 1 }, deadline: { month: 4, day: 30 } },
  { quarter: 3, unlock: { month: 7, day: 1 }, deadline: { month: 7, day: 31 } },
  { quarter: 4, unlock: { month: 10, day: 1 }, deadline: { month: 10, day: 31 } },
];

/**
 * Each CBAM window files the *preceding* quarter's data — mirrors
 * CBAM_TARGET_QUARTER_BY_UNLOCK_MONTH in the backend module.
 */
const CBAM_TARGET_QUARTER_BY_UNLOCK_MONTH: Record<number, number> = { 1: 4, 4: 1, 7: 2, 10: 3 };

/**
 * The annual declaration and certificate surrender fall due on 31 May of the
 * year following the reporting year, per the EU's 2025 Omnibus simplification
 * package. First declaration under this rule (covering 2026 imports) is 2027.
 */
const CBAM_ANNUAL_DECLARATION_DEADLINE: MonthDay = { month: 5, day: 31 };
const CBAM_FIRST_ANNUAL_DECLARATION_YEAR = 2027;

const dateFor = (year: number, md: MonthDay): Date =>
  new Date(Date.UTC(year, md.month - 1, md.day, 23, 59, 59));

export interface ComplianceEvent {
  date: Date;
  label: string;
  /** Whole days from `now` to the event, rounded like the backend's daysUntil. */
  daysRemaining: number;
}

interface DatedEvent {
  date: Date;
  label: string;
}

/** Every calendar event in a given year, unsorted. */
function eventsForYear(year: number): DatedEvent[] {
  const events: DatedEvent[] = [];

  for (const q of CBAM_QUARTERS) {
    const filedQuarter = CBAM_TARGET_QUARTER_BY_UNLOCK_MONTH[q.unlock.month];
    events.push({
      date: dateFor(year, q.unlock),
      label: `CBAM Q${filedQuarter} report window opens`,
    });
    events.push({
      date: dateFor(year, q.deadline),
      label: `CBAM Q${filedQuarter} report deadline`,
    });
  }

  if (year >= CBAM_FIRST_ANNUAL_DECLARATION_YEAR) {
    events.push({
      date: dateFor(year, CBAM_ANNUAL_DECLARATION_DEADLINE),
      label: "CBAM annual declaration due",
    });
  }

  events.push({
    date: dateFor(year, CCTS_REPORT_UNLOCK),
    label: "CCTS report window opens",
  });
  events.push({
    date: dateFor(year, CCTS_DEADLINE),
    label: "CCTS compliance deadline",
  });
  events.push({
    date: dateFor(year, INDIAN_FY_CLOSE),
    label: "Next CCTS & BRSR compliance cycle",
  });

  return events;
}

/** Whole days between two instants, rounded like the backend's daysUntil. */
const daysBetween = (from: Date, to: Date): number =>
  Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));

/**
 * The soonest compliance event strictly after `now`. Looks across the current
 * and next two years so a date late in December still resolves.
 *
 * This is the single source of truth for every deadline the marketing site
 * displays — homepage stat strip, hero mockup badge, and anywhere else a date
 * appears. Do not hardcode a deadline date in a page; call this instead.
 */
export function getNextComplianceDeadline(now: Date = new Date()): ComplianceEvent {
  const year = now.getUTCFullYear();

  const upcoming = [year, year + 1, year + 2]
    .flatMap((candidateYear) => eventsForYear(candidateYear))
    .filter((event) => event.date.getTime() > now.getTime())
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  // The three-year horizon always contains a future event; the fallback keeps
  // the return type non-nullable for callers.
  const next: DatedEvent = upcoming[0] ?? {
    date: dateFor(year + 1, CCTS_DEADLINE),
    label: "CCTS compliance deadline",
  };

  return { ...next, daysRemaining: daysBetween(now, next.date) };
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** Formats as "1 Oct 2026", matching the existing stat-card style. */
export function formatDeadline(date: Date): string {
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/**
 * Current calendar quarter as "Q3 2026" — same shape as the backend's
 * dashboardShared quarterLabel. Used to keep sample/mockup framing current
 * rather than pinned to a quarter that has already gone by.
 */
export function currentQuarterLabel(now: Date = new Date()): string {
  return `Q${Math.floor(now.getUTCMonth() / 3) + 1} ${now.getUTCFullYear()}`;
}

const fyLabelForEndYear = (endYear: number): string =>
  `FY${endYear - 1}-${String(endYear % 100).padStart(2, "0")}`;

/**
 * The next CCTS submission deadline (31 Jul) and the Indian FY whose data it
 * covers — the FY that closed on the 31 Mar immediately before it.
 */
export function getNextCctsDeadline(now: Date = new Date()): {
  date: Date;
  fyLabel: string;
  daysRemaining: number;
} {
  const year = now.getUTCFullYear();
  const thisYear = dateFor(year, CCTS_DEADLINE);
  const date = now.getTime() <= thisYear.getTime() ? thisYear : dateFor(year + 1, CCTS_DEADLINE);

  return {
    date,
    fyLabel: fyLabelForEndYear(date.getUTCFullYear()),
    daysRemaining: daysBetween(now, date),
  };
}

/** "31 July 2027" — long form, for prose such as the FAQ answers. */
export function formatLongDeadline(date: Date): string {
  const LONG_MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${date.getUTCDate()} ${LONG_MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/**
 * The FY that CCTS reporting currently covers — the one that closed on the
 * most recent 31 Mar. Mirrors getCctsReportPeriodStatus in the backend module.
 */
export function currentCctsReportingFyLabel(now: Date = new Date()): string {
  const livingYear = now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return fyLabelForEndYear(livingYear);
}

/**
 * How far through the current Indian FY (1 Apr – 31 Mar) `now` sits, 0-100.
 * Drives the compliance-calendar progress bar so it tracks the real position
 * in the year instead of a fixed fill.
 */
export function indianFyProgressPercent(now: Date = new Date()): number {
  const startYear = now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  const start = Date.UTC(startYear, 3, 1);
  const end = Date.UTC(startYear + 1, 2, 31, 23, 59, 59);
  const fraction = (now.getTime() - start) / (end - start);

  return Math.min(100, Math.max(0, Math.round(fraction * 100)));
}
