import { Router } from "express";
import * as companyController from "../controllers/company.controller";
import { requireAuth } from "../middleware/requireAuth";
import { requireApproved } from "../middleware/requireApproved";
import { validate } from "../middleware/validate";
import { companySchema } from "../validators/company.validators";

const router = Router();

router.use(requireAuth, requireApproved);

router.get("/", companyController.getMyCompany);
router.post("/", validate(companySchema), companyController.createCompany);
router.put("/", validate(companySchema), companyController.updateCompany);
router.get("/dashboard", companyController.getCompanyDashboard);
// Gated inside the service on the ESG Disclosure Bundle subscription (403
// ESG_BUNDLE_NOT_SUBSCRIBED), the same gate every BRSR/ISSB/Scope 3 route uses.
router.get("/esg-overview", companyController.getEsgOverview);

export default router;
