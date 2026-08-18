import { Router } from "express";
import * as controller from "../controllers/rec.controller";
import { requireAuth } from "../middleware/requireAuth";
import { requireApproved } from "../middleware/requireApproved";

const router = Router();

router.use(requireAuth, requireApproved);

router.get("/", controller.listRecs);
router.post("/", controller.createRec);
router.delete("/:recId", controller.deleteRec);

export default router;
