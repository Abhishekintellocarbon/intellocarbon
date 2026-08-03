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
 * The EU Omnibus simplification moved the annual declaration and certificate
 * surrender deadline from 31 May to 30 Sept of the year following the reporting
 * year. First declaration under this rule (covering 2026 imports) is due 2027.
 */
const CBAM_ANNUAL_DECLARATION_DEADLINE: MonthDay = { month: 9, day: 30 };
const CBAM_FIRST_ANNUAL_DECLARATION_YEAR = 2027;

const dateFor = (year: number, md: MonthDay): Date =>
  new Date(Date.UTC(year, md.month - 1, md.day, 23, 59, 59));

export interface ComplianceEvent {
  date: Date;
  label: string;
}

/** Every calendar event in a given year, unsorted. */
function eventsForYear(year: number): ComplianceEvent[] {
  const events: ComplianceEvent[] = [];

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

/**
 * The soonest compliance event strictly after `now`. Looks across the current
 * and next two years so a date late in December still resolves.
 */
export function getNextComplianceDeadline(now: Date = new Date()): ComplianceEvent {
  const year = now.getUTCFullYear();

  const upcoming = [year, year + 1, year + 2]
    .flatMap((candidateYear) => eventsForYear(candidateYear))
    .filter((event) => event.date.getTime() > now.getTime())
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  // The three-year horizon always contains a future event; the fallback keeps
  // the return type non-nullable for callers.
  return upcoming[0] ?? { date: dateFor(year + 1, CCTS_DEADLINE), label: "CCTS compliance deadline" };
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
