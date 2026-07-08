import { Router } from "express";
import * as leadCaptureController from "../controllers/leadCapture.controller";
import * as userApprovalController from "../controllers/userApproval.controller";
import * as adminOverviewController from "../controllers/adminOverview.controller";
import * as adminRevenueController from "../controllers/adminRevenue.controller";
import * as adminCompaniesController from "../controllers/adminCompanies.controller";
import * as adminFacilitiesController from "../controllers/adminFacilities.controller";
import * as adminVerifiersController from "../controllers/adminVerifiers.controller";
import * as adminFacilityAssignmentsController from "../controllers/adminFacilityAssignments.controller";
import * as adminEmissionFactorsController from "../controllers/adminEmissionFactors.controller";
import { requireAuth } from "../middleware/requireAuth";
import { requireSuperAdmin } from "../middleware/requireSuperAdmin";
import { validate } from "../middleware/validate";
import { assignVerifierSchema, createVerifierSchema } from "../validators/verifierAssignment.validators";
import { assignFacilityOperatorSchema, createInternalOperatorSchema } from "../validators/facilityAssignment.validators";
import {
  createEmissionFactorSchema,
  updateEmissionFactorSchema,
  supersedeEmissionFactorSchema,
  quickUpdateValueSchema,
} from "../validators/emissionFactor.validators";

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
router.post("/verifiers", validate(createVerifierSchema), adminVerifiersController.createVerifier);
router.post("/companies/:companyId/verifiers", validate(assignVerifierSchema), adminVerifiersController.assignVerifier);
router.delete("/companies/:companyId/verifiers/:verifierId", adminVerifiersController.unassignVerifier);

router.get("/internal-operators", adminFacilityAssignmentsController.listInternalOperators);
router.post(
  "/internal-operators",
  validate(createInternalOperatorSchema),
  adminFacilityAssignmentsController.createInternalOperator,
);
router.get("/facilities/:facilityId/assignments", adminFacilityAssignmentsController.listAssignmentsForFacility);
router.post(
  "/facilities/:facilityId/assignments",
  validate(assignFacilityOperatorSchema),
  adminFacilityAssignmentsController.assignOperator,
);
router.delete("/facilities/:facilityId/assignments/:userId", adminFacilityAssignmentsController.unassignOperator);

router.get("/emission-factors", adminEmissionFactorsController.listFactors);
router.post("/emission-factors", validate(createEmissionFactorSchema), adminEmissionFactorsController.createFactor);
router.put("/emission-factors/:id", validate(updateEmissionFactorSchema), adminEmissionFactorsController.updateFactor);
router.put(
  "/emission-factors/:id/supersede",
  validate(supersedeEmissionFactorSchema),
  adminEmissionFactorsController.supersedeFactor,
);
router.put(
  "/cbam-certificate-price",
  validate(quickUpdateValueSchema),
  adminEmissionFactorsController.updateCbamCertificatePrice,
);
router.put("/cea-grid-factor", validate(quickUpdateValueSchema), adminEmissionFactorsController.updateCeaGridFactor);

export default router;
