import { Router } from "express";
import * as cctsObligatedEntityController from "../controllers/cctsObligatedEntity.controller";

const router = Router();

// Public — no auth. Covered by the app-wide generalApiRateLimiter (see app.ts).
router.get("/", cctsObligatedEntityController.listPublicEntities);

export default router;
