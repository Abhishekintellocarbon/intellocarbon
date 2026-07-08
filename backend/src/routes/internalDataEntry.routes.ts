import { Router } from "express";
import * as internalDataEntryController from "../controllers/internalDataEntry.controller";
import { requireAuth } from "../middleware/requireAuth";
import { requireApproved } from "../middleware/requireApproved";
import { requireRole } from "../middleware/requireRole";

const router = Router();

router.use(requireAuth, requireApproved, requireRole("DATA_ENTRY_INTERNAL"));

router.get("/facilities", internalDataEntryController.listAssignedFacilities);
router.get("/facilities/:facilityId", internalDataEntryController.getFacilityDetail);

export default router;
