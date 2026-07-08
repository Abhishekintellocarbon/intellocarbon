import { Router } from "express";
import * as leadCaptureController from "../controllers/leadCapture.controller";
import * as userApprovalController from "../controllers/userApproval.controller";
import * as adminOverviewController from "../controllers/adminOverview.controller";
import * as adminRevenueController from "../controllers/adminRevenue.controller";
import * as adminCompaniesController from "../controllers/adminCompanies.controller";
import * as adminFacilitiesController from "../controllers/adminFacilities.controller";
import * as adminVerifiersController from "../controllers/adminVerifiers.controller";
import { requireAuth } from "../middleware/requireAuth";
import { requireSuperAdmin } from "../middleware/requireSuperAdmin";
import { validate } from "../middleware/validate";
import { assignVerifierSchema } from "../validators/verifierAssignment.validators";

const router = Router();

router.use(requireAuth, requireSuperAdmin);

router.get("/overview", adminOverviewController.getOverview);
router.get("/revenue", adminRevenueController.getRevenue);

router.get("/companies", adminCompaniesController.listCompanies);
router.get("/companies/:companyId", adminCompaniesController.getCompanyDetail);

router.get("/facilities/:facilityId", adminFacilitiesController.getFacilityDetail);
router.get("/documents/:documentId/download", adminFacilitiesController.downloadDocument);

router.get("/leads", leadCaptureController.listLeads);

router.get("/pending-users", userApprovalController.listPendingUsers);
router.post("/pending-users/:userId/approve", userApprovalController.approveUser);
router.post("/pending-users/:userId/reject", userApprovalController.rejectUser);

router.get("/verifiers", adminVerifiersController.listVerifiers);
router.post("/companies/:companyId/verifiers", validate(assignVerifierSchema), adminVerifiersController.assignVerifier);
router.delete("/companies/:companyId/verifiers/:verifierId", adminVerifiersController.unassignVerifier);

export default router;
