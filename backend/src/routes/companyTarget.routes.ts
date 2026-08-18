import { Router } from "express";
import * as controller from "../controllers/companyTarget.controller";
import { requireAuth } from "../middleware/requireAuth";
import { requireApproved } from "../middleware/requireApproved";

const router = Router();

router.use(requireAuth, requireApproved);

// Company-level, not per facility: a reduction target is set for the
// organisation, not per site per year. See companyTarget.service.
router.get("/", controller.listTargets);
router.post("/", controller.createTarget);
router.put("/:targetId", controller.updateTarget);
router.delete("/:targetId", controller.deleteTarget);

export default router;
