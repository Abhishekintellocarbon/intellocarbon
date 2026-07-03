import { Router } from "express";
import * as facilityController from "../controllers/facility.controller";
import { requireAuth } from "../middleware/requireAuth";
import { validate } from "../middleware/validate";
import { facilitySchema } from "../validators/facility.validators";
import activityDataRoutes from "./activityData.routes";

const router = Router();

router.use(requireAuth);

router.get("/", facilityController.listFacilities);
router.post("/", validate(facilitySchema), facilityController.createFacility);
router.get("/:facilityId", facilityController.getFacility);
router.put("/:facilityId", validate(facilitySchema), facilityController.updateFacility);
router.delete("/:facilityId", facilityController.deleteFacility);

router.use("/:facilityId/activity-data", activityDataRoutes);

export default router;
