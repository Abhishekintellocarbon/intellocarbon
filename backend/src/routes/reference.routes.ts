import { Router } from "express";
import * as referenceController from "../controllers/reference.controller";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

router.get("/emission-factors", requireAuth, referenceController.getEmissionFactorReference);

export default router;
