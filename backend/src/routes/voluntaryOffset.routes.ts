import { Router } from "express";
import * as voluntaryOffsetController from "../controllers/voluntaryOffset.controller";
import { requireAuth } from "../middleware/requireAuth";
import { requireApproved } from "../middleware/requireApproved";

const router = Router();

router.use(requireAuth, requireApproved);

// The ESG Disclosure Bundle check lives in the service layer
// (requireOwnedFacilityForEsgBundle), same as BRSR/ISSB/Scope 3 — it needs the
// facility's company, which the route has no reason to load.
router.get("/facilities/:facilityId/purchases", voluntaryOffsetController.listVoluntaryOffsets);
router.post("/facilities/:facilityId/purchases", voluntaryOffsetController.createVoluntaryOffset);
router.patch("/facilities/:facilityId/purchases/:purchaseId", voluntaryOffsetController.updateVoluntaryOffset);
router.delete("/facilities/:facilityId/purchases/:purchaseId", voluntaryOffsetController.deleteVoluntaryOffset);

export default router;
