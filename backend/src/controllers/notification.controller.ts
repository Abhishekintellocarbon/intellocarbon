import { asyncHandler } from "../utils/asyncHandler";
import * as notificationService from "../services/notification.service";

export const listNotifications = asyncHandler(async (req, res) => {
  const notifications = await notificationService.listNotifications(req.user!.sub);
  res.status(200).json({ notifications });
});

export const markNotificationRead = asyncHandler(async (req, res) => {
  const notification = await notificationService.markNotificationRead(req.user!.sub, req.params.id);
  res.status(200).json({ notification });
});

export const markAllNotificationsRead = asyncHandler(async (req, res) => {
  await notificationService.markAllNotificationsRead(req.user!.sub);
  res.status(204).send();
});
