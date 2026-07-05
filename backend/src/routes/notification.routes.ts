import { Router } from "express";
import * as notificationController from "../controllers/notification.controller";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

router.use(requireAuth);

router.get("/", notificationController.listNotifications);
router.post("/read-all", notificationController.markAllNotificationsRead);
router.post("/:id/read", notificationController.markNotificationRead);

export default router;
