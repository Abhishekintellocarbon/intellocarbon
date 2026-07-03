import { Router } from "express";
import * as activityDataController from "../controllers/activityData.controller";
import * as verificationController from "../controllers/verification.controller";
import { requireAuth } from "../middleware/requireAuth";
import { validate } from "../middleware/validate";
import { activityDataSchema } from "../validators/activityData.validators";

const router = Router({ mergeParams: true });

router.use(requireAuth);

router.get("/", activityDataController.listActivityData);
router.post("/", validate(activityDataSchema), activityDataController.createActivityData);
router.get("/:dataId", activityDataController.getActivityData);
router.delete("/:dataId", activityDataController.deleteActivityData);
router.get("/:dataId/report/cbam", activityDataController.downloadCbamReport);
router.get("/:dataId/report/ccts", activityDataController.downloadCctsReport);
router.post("/:dataId/verification", verificationController.submitForVerification);
router.get("/:dataId/verification", verificationController.getVerificationStatus);

export default router;
