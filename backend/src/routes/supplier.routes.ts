import { Router } from "express";
import * as controller from "../controllers/supplier.controller";
import { requireAuth } from "../middleware/requireAuth";
import { requireApproved } from "../middleware/requireApproved";

const router = Router();

router.use(requireAuth, requireApproved);

router.get("/", controller.listSuppliers);
router.post("/", controller.createSupplier);
router.put("/:supplierId", controller.updateSupplier);
router.delete("/:supplierId", controller.deleteSupplier);

export default router;
