import { prisma } from "../config/prisma";
import { logger } from "../utils/logger";
import { createNotificationOnce } from "./notification.service";
import {
  sendMonthlyReminderEmail,
  sendDeadlineWarningEmail,
} from "./email.service";
import { CCTS_DEADLINE, CBAM_QUARTERS, daysUntil, quarterLabel } from "../data/complianceDeadlines";
import type { Company, Facility, Subscription, User } from "@prisma/client";

const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type CompanyWithRelations = Company & {
  owner: User;
  subscription: Subscription | null;
  facilities: Facility[];
};

const dateFor = (year: number, month: number, day: number): Date => new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
const endOfMonthUtc = (year: number, month: number): Date => new Date(Date.UTC(year, month, 0, 23, 59, 59));

// --- 1. Monthly reminder — 1st of the month, per facility ---------------

const checkMonthlyReminders = async (company: CompanyWithRelations, now: Date): Promise<void> => {
  if (now.getUTCDate() !== 1) return;

  const currentMonthLabel = `${MONTH_LABELS[now.getUTCMonth()]} ${now.getUTCFullYear()}`;
  const yyyyMM = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

  // The month that just ended — the one they should have already submitted.
  const prevMonthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const prevYear = prevMonthDate.getUTCFullYear();
  const prevMonth = prevMonthDate.getUTCMonth() + 1;
  const previousMonthLabel = `${MONTH_LABELS[prevMonth - 1]} ${prevYear}`;
  const prevMonthStart = dateFor(prevYear, prevMonth, 1);
  const prevMonthEnd = endOfMonthUtc(prevYear, prevMonth);

  for (const facility of company.facilities) {
    const prevEntry = await prisma.activityData.findFirst({
      where: {
        facilityId: facility.id,
        periodStart: { gte: prevMonthStart },
        periodEnd: { lte: prevMonthEnd },
      },
      orderBy: { createdAt: "desc" },
    });
    const previousMonthIncomplete = !prevEntry || prevEntry.status === "DRAFT";

    const title = `Enter ${currentMonthLabel} activity data for ${facility.name}`;
    const body = previousMonthIncomplete
      ? `Your ${previousMonthLabel} activity data for ${facility.name} is still ${prevEntry ? "in draft" : "missing"}. Please complete it, then enter ${currentMonthLabel}'s data.`
      : `Please enter ${currentMonthLabel} activity data for ${facility.name}.`;

    await createNotificationOnce(
      {
        userId: company.ownerId,
        companyId: company.id,
        facilityId: facility.id,
        type: "MONTHLY_REMINDER",
        title,
        body,
        dedupeKey: `monthly:${facility.id}:${yyyyMM}`,
      },
      () =>
        sendMonthlyReminderEmail(
          company.owner.email,
          facility.name,
          currentMonthLabel,
          previousMonthIncomplete,
          previousMonthLabel,
        ),
    );
  }
};

// --- completeness check shared by CCTS/CBAM deadline alerts --------------

const countIncompleteFacilities = async (
  facilities: Facility[],
  periodStart: Date,
  periodEnd: Date,
): Promise<{ incomplete: number; total: number }> => {
  let incomplete = 0;
  for (const facility of facilities) {
    const submitted = await prisma.activityData.findFirst({
      where: {
        facilityId: facility.id,
        periodStart: { gte: periodStart },
        periodEnd: { lte: periodEnd },
        status: "SUBMITTED",
      },
    });
    if (!submitted) incomplete++;
  }
  return { incomplete, total: facilities.length };
};

// --- 2/3. CCTS 30-day warning + 7-day urgent alert ------------------------

const checkCctsDeadlineAlerts = async (company: CompanyWithRelations, now: Date): Promise<void> => {
  if (company.facilities.length === 0) return;

  const year = now.getUTCFullYear();
  const deadline = dateFor(year, CCTS_DEADLINE.month, CCTS_DEADLINE.day);
  const days = daysUntil(now, deadline);
  if (days !== 30 && days !== 7) return;

  // CCTS is an annual filing — completeness is checked against the whole
  // calendar year to date (baseline FY2023-24 notwithstanding — the
  // reporting cycle itself runs on calendar-year activity data entries).
  const { incomplete, total } = await countIncompleteFacilities(
    company.facilities,
    dateFor(year, 1, 1),
    dateFor(year, 12, 31),
  );
  if (incomplete === 0) return;

  const deadlineLabel = deadline.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const type = days === 30 ? "DEADLINE_WARNING_30D" : "DEADLINE_URGENT_7D";
  const title =
    days === 30
      ? `Your CCTS report is due in 30 days`
      : `Urgent: your CCTS report is due in 7 days`;
  const body = `${incomplete} of ${total} required data entries are still incomplete. CCTS report due ${deadlineLabel}.`;

  await createNotificationOnce(
    {
      userId: company.ownerId,
      companyId: company.id,
      type,
      title,
      body,
      dedupeKey: `ccts-${days}d:${year}`,
    },
    () => sendDeadlineWarningEmail(company.owner.email, "CCTS", days, incomplete, total, deadlineLabel),
  );
};

// --- 4/5. CBAM 30-day warning + 7-day urgent alert, per quarter -----------

const checkCbamDeadlineAlerts = async (company: CompanyWithRelations, now: Date): Promise<void> => {
  if (company.facilities.length === 0) return;

  const year = now.getUTCFullYear();
  for (const q of CBAM_QUARTERS) {
    const deadline = dateFor(year, q.deadline.month, q.deadline.day);
    const days = daysUntil(now, deadline);
    if (days !== 30 && days !== 7) continue;

    const unlockDate = dateFor(year, q.unlock.month, q.unlock.day);
    const { incomplete, total } = await countIncompleteFacilities(company.facilities, unlockDate, deadline);
    if (incomplete === 0) continue;

    const deadlineLabel = deadline.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    const type = days === 30 ? "DEADLINE_WARNING_30D" : "DEADLINE_URGENT_7D";
    const title =
      days === 30 ? `Your CBAM report is due in 30 days` : `Urgent: your CBAM report is due in 7 days`;
    const body = `${incomplete} of ${total} required data entries are still incomplete. CBAM Q${q.quarter} report due ${deadlineLabel}.`;

    await createNotificationOnce(
      {
        userId: company.ownerId,
        companyId: company.id,
        type,
        title,
        body,
        dedupeKey: `cbam-${days}d:${quarterLabel(now)}`,
      },
      () => sendDeadlineWarningEmail(company.owner.email, "CBAM", days, incomplete, total, deadlineLabel),
    );
  }
};

/**
 * The daily compliance check — notifies every company with an active
 * subscription about monthly data-entry reminders and upcoming CCTS/CBAM
 * deadlines. Sector-agnostic: branches only on subscription tier (which
 * framework(s) a company pays for) and calendar dates, never on Sector —
 * the six live CBAM sectors' different emission factors are handled
 * entirely inside the existing calculation engine.
 *
 * Notifications currently go to the company's one owner User — Company is
 * 1:1 with User today (see schema), so there's no separate "Data Entry
 * Operator" to fan out to yet. If/when multi-user company membership ships,
 * this is the single place to change: replace `company.owner` below with an
 * iteration over all of that company's members.
 */
export const runDailyComplianceCheck = async (now: Date = new Date()): Promise<void> => {
  const companies = await prisma.company.findMany({
    where: { subscription: { status: "ACTIVE" } },
    include: {
      owner: true,
      subscription: true,
      facilities: { where: { isDraft: false } },
    },
  });

  logger.info(`Daily compliance check: ${companies.length} active-subscription companies`);

  for (const company of companies) {
    try {
      await checkMonthlyReminders(company, now);

      const tier = company.subscription?.tier;
      if (tier === "CCTS_COMPLIANCE" || tier === "CBAM_PLUS_CCTS") {
        await checkCctsDeadlineAlerts(company, now);
      }
      if (tier === "CBAM_COMPLIANCE" || tier === "CBAM_PLUS_CCTS") {
        await checkCbamDeadlineAlerts(company, now);
      }
    } catch (err) {
      // One company's failure shouldn't block the rest of the run.
      logger.error(`Compliance check failed for company ${company.id}`, err);
    }
  }
};
