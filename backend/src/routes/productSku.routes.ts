import { Router } from "express";
import * as controller from "../controllers/productSku.controller";
import { requireAuth } from "../middleware/requireAuth";
import { requireApproved } from "../middleware/requireApproved";

const router = Router();

router.use(requireAuth, requireApproved);

router.get("/facilities/:facilityId/allocation/:period", controller.getAllocation);
router.post("/", controller.createSku);
router.delete("/:skuId", controller.deleteSku);

export default router;
