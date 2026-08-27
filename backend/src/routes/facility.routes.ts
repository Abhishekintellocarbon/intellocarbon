import { Router } from "express";
import * as facilityController from "../controllers/facility.controller";
import * as facilityDashboardController from "../controllers/facilityDashboard.controller";
import * as facilityReportsController from "../controllers/facilityReports.controller";
import * as evidenceDocumentController from "../controllers/evidenceDocument.controller";
import * as recommendationController from "../controllers/recommendation.controller";
import * as facilityQueriesController from "../controllers/facilityQueries.controller";
import * as cbamExecutiveSummaryController from "../controllers/cbamExecutiveSummary.controller";
import { requireAuth } from "../middleware/requireAuth";
import { requireApproved } from "../middleware/requireApproved";
import { validate } from "../middleware/validate";
import { facilitySchema, facilityDraftSchema } from "../validators/facility.validators";
import { generateReportSchema } from "../validators/report.validators";
import { respondQuerySchema } from "../validators/verification.validators";
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
// Board-ready condensed summary. CBAM tier gate lives in the service
// (requireOwnedFacilityForCbam), matching how the ESG modules gate.
router.get("/:facilityId/cbam-executive-summary", cbamExecutiveSummaryController.downloadCbamExecutiveSummary);
router.get("/:facilityId/documents", evidenceDocumentController.listFacilityDocuments);
router.get("/:facilityId/documents/:documentId/download", evidenceDocumentController.downloadFacilityDocument);
// IntelloAdvisor Bill Intelligence — read the fields extracted from an
// uploaded bill, and record the client accepting the Scope 2 suggestion.
// Facility-scoped like every other document route, so access is the same
// check the upload and download already make.
router.get("/:facilityId/documents/:documentId/extraction", evidenceDocumentController.getBillExtraction);
router.post("/:facilityId/documents/:documentId/extraction/accept", evidenceDocumentController.acceptBillPrefill);
// IntelloAdvisor Phase 2 — Decarbonization Recommendation Engine. Read-only and
// derived on every request from the stored emissions calculation, so it needs no
// regeneration endpoint and can never serve a stale card.
router.get("/:facilityId/recommendations", recommendationController.getFacilityRecommendations);
router.get("/:facilityId/activity-data/:dataId/recommendations", recommendationController.getActivityDataRecommendations);
router.get("/:facilityId/queries", facilityQueriesController.listFacilityQueries);
router.post("/:facilityId/queries/:queryId/respond", validate(respondQuerySchema), facilityQueriesController.respondToQuery);
router.put("/:facilityId", validate(facilitySchema), facilityController.updateFacility);
router.patch("/:facilityId/draft", validate(facilityDraftSchema), facilityController.autosaveFacility);
router.post("/:facilityId/complete", validate(facilitySchema), facilityController.completeFacility);
router.delete("/:facilityId", facilityController.deleteFacility);

router.use("/:facilityId/activity-data", activityDataRoutes);

export default router;
