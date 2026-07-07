import { Router } from "express";
import * as leadCaptureController from "../controllers/leadCapture.controller";
import * as userApprovalController from "../controllers/userApproval.controller";
import * as adminOverviewController from "../controllers/adminOverview.controller";
import * as adminCompaniesController from "../controllers/adminCompanies.controller";
import * as adminFacilitiesController from "../controllers/adminFacilities.controller";
import { requireAuth } from "../middleware/requireAuth";
import { requireSuperAdmin } from "../middleware/requireSuperAdmin";

const router = Router();

router.use(requireAuth, requireSuperAdmin);

router.get("/overview", adminOverviewController.getOverview);

router.get("/companies", adminCompaniesController.listCompanies);
router.get("/companies/:companyId", adminCompaniesController.getCompanyDetail);

router.get("/facilities/:facilityId", adminFacilitiesController.getFacilityDetail);
router.get("/documents/:documentId/download", adminFacilitiesController.downloadDocument);

router.get("/leads", leadCaptureController.listLeads);

router.get("/pending-users", userApprovalController.listPendingUsers);
router.post("/pending-users/:userId/approve", userApprovalController.approveUser);
router.post("/pending-users/:userId/reject", userApprovalController.rejectUser);

export default router;
