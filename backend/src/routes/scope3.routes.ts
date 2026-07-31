import { Router } from "express";
import * as scope3Controller from "../controllers/scope3.controller";
import { requireAuth } from "../middleware/requireAuth";
import { requireApproved } from "../middleware/requireApproved";

const router = Router();

router.use(requireAuth, requireApproved);

router.get("/categories", scope3Controller.listScope3Categories);
router.get("/relevance/:companyId", scope3Controller.getScope3Relevance);
// Coming-soon stub for the 10 categories without a calculation path yet.
router.get("/categories/:category/entry", scope3Controller.getScope3CategoryStub);
router.get("/facilities/:facilityId/data", scope3Controller.listScope3Data);
router.post("/facilities/:facilityId/data", scope3Controller.saveScope3Data);
router.delete("/facilities/:facilityId/data/:period/:category", scope3Controller.deleteScope3Data);

export default router;
