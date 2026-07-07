import { Router } from "express";
import * as facilityController from "../controllers/facility.controller";
import * as facilityDashboardController from "../controllers/facilityDashboard.controller";
import * as facilityReportsController from "../controllers/facilityReports.controller";
import { requireAuth } from "../middleware/requireAuth";
import { requireApproved } from "../middleware/requireApproved";
import { validate } from "../middleware/validate";
import { facilitySchema, facilityDraftSchema } from "../validators/facility.validators";
import { generateReportSchema } from "../validators/report.validators";
import activityDataRoutes from "./activityData.routes";

const router = Router();

router.use(requireAuth, requireApproved);

router.get("/", facilityController.listFacilities);
router.post("/", validate(facilitySchema), facilityController.createFacility);
router.post("/draft", validate(facilityDraftSchema), facilityController.autosaveNewFacility);
router.get("/:facilityId", facilityController.getFacility);
router.get("/:facilityId/dashboard", facilityDashboardController.getFacilityDashboard);
router.get("/:facilityId/reports/status", facilityReportsController.getReportGenerationStatus);
router.post("/:facilityId/reports/generate", validate(generateReportSchema), facilityReportsController.generateReport);
router.get("/:facilityId/reports", facilityReportsController.listReports);
router.get("/:facilityId/reports/:reportId/pdf", facilityReportsController.downloadReportPdf);
router.put("/:facilityId", validate(facilitySchema), facilityController.updateFacility);
router.patch("/:facilityId/draft", validate(facilityDraftSchema), facilityController.autosaveFacility);
router.post("/:facilityId/complete", validate(facilitySchema), facilityController.completeFacility);
router.delete("/:facilityId", facilityController.deleteFacility);

router.use("/:facilityId/activity-data", activityDataRoutes);

export default router;
