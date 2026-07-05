import { Prisma, type NotificationType } from "@prisma/client";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";
import { logger } from "../utils/logger";

interface CreateNotificationOnceInput {
  userId: string;
  companyId: string;
  facilityId?: string;
  type: NotificationType;
  title: string;
  body: string;
  /** Uniquely identifies "this alert, for this company, for this period" — see schema comment on Notification.dedupeKey. */
  dedupeKey: string;
}

const isUniqueConstraintViolation = (err: unknown): boolean =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";

/**
 * Creates the notification row and sends its email exactly once per
 * dedupeKey. If a row with this (companyId, dedupeKey) already exists — e.g.
 * the daily cron re-running on day 2 of a 30-day warning window — the
 * insert hits the unique constraint, we treat that as "already sent", skip
 * the email, and return false. Callers don't need their own "have I already
 * alerted for this period" bookkeeping.
 */
export const createNotificationOnce = async (
  input: CreateNotificationOnceInput,
  sendEmail: () => Promise<void>,
): Promise<boolean> => {
  try {
    await prisma.notification.create({
      data: {
        userId: input.userId,
        companyId: input.companyId,
        facilityId: input.facilityId,
        type: input.type,
        title: input.title,
        body: input.body,
        dedupeKey: input.dedupeKey,
      },
    });
  } catch (err) {
    if (isUniqueConstraintViolation(err)) return false;
    throw err;
  }

  try {
    await sendEmail();
    await prisma.notification.updateMany({
      where: { companyId: input.companyId, dedupeKey: input.dedupeKey },
      data: { emailSentAt: new Date() },
    });
  } catch (err) {
    // The in-app notification is already saved and is the source of truth —
    // an email delivery failure (e.g. Resend hiccup) shouldn't be retried by
    // re-running the job, since the dedupe key would just block it anyway.
    logger.error(`Failed to send notification email for dedupeKey=${input.dedupeKey}`, err);
  }

  return true;
};

export const listNotifications = async (userId: string) =>
  prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

export const markNotificationRead = async (userId: string, notificationId: string) => {
  const notification = await prisma.notification.findUnique({ where: { id: notificationId } });
  if (!notification || notification.userId !== userId) {
    throw AppError.notFound("Notification not found");
  }
  return prisma.notification.update({
    where: { id: notificationId },
    data: { readAt: new Date() },
  });
};

export const markAllNotificationsRead = async (userId: string) => {
  await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
};
