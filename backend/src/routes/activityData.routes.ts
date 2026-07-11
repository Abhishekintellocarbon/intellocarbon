import { Router } from "express";
import * as activityDataController from "../controllers/activityData.controller";
import * as verificationController from "../controllers/verification.controller";
import * as evidenceDocumentController from "../controllers/evidenceDocument.controller";
import { requireAuth } from "../middleware/requireAuth";
import { validate } from "../middleware/validate";
import { uploadRateLimiter } from "../middleware/rateLimiters";
import { activityDataSchema, activityDataDraftSchema } from "../validators/activityData.validators";

const router = Router({ mergeParams: true });

router.use(requireAuth);

router.get("/", activityDataController.listActivityData);
router.post("/", validate(activityDataSchema), activityDataController.createActivityData);
router.post("/draft", validate(activityDataDraftSchema), activityDataController.autosaveNewActivityData);
router.get("/:dataId", activityDataController.getActivityData);
router.patch("/:dataId/draft", validate(activityDataDraftSchema), activityDataController.autosaveActivityData);
router.post("/:dataId/submit", validate(activityDataSchema), activityDataController.submitActivityData);
router.delete("/:dataId", activityDataController.deleteActivityData);
router.get("/:dataId/report/cbam", activityDataController.downloadCbamReport);
router.get("/:dataId/report/ccts", activityDataController.downloadCctsReport);
router.post("/:dataId/verification", verificationController.submitForVerification);
router.get("/:dataId/verification", verificationController.getVerificationStatus);
router.post("/:dataId/documents", uploadRateLimiter, ...evidenceDocumentController.uploadEvidenceDocument);

export default router;
