import { asyncHandler } from "../utils/asyncHandler";
import * as companyService from "../services/company.service";
import * as companyDashboardService from "../services/companyDashboard.service";
import * as esgOverviewService from "../services/esgOverview.service";
import { generateEcovadisReadinessPdf } from "../services/ecovadisReport/build";

export const getMyCompany = asyncHandler(async (req, res) => {
  const company = await companyService.getMyCompany(req.user!.sub);
  res.status(200).json({ company });
});

export const getCompanyDashboard = asyncHandler(async (req, res) => {
  const analytics = await companyDashboardService.getCompanyAnalytics(req.user!.sub);
  res.status(200).json({ analytics });
});

export const getEsgOverview = asyncHandler(async (req, res) => {
  const overview = await esgOverviewService.getEsgOverview(req.user!.sub);
  res.status(200).json({ overview });
});

/**
 * The EcoVadis readiness summary as a PDF.
 *
 * Built from exactly the same getEsgOverview call the dashboard card reads, so
 * the document and the screen cannot report different coverage. Gated on the
 * ESG Disclosure Bundle inside that service, like every other route here.
 */
export const downloadEcovadisReadinessPdf = asyncHandler(async (req, res) => {
  const overview = await esgOverviewService.getEsgOverview(req.user!.sub);
  const doc = generateEcovadisReadinessPdf(overview.ecovadis, overview.companyName);

  const filename = `ecovadis-readiness-${overview.companyName.replace(/\s+/g, "-").toLowerCase()}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  doc.pipe(res);
  doc.end();
});

export const createCompany = asyncHandler(async (req, res) => {
  const company = await companyService.createCompany(req.user!.sub, req.body);
  res.status(201).json({ company });
});

export const updateCompany = asyncHandler(async (req, res) => {
  const company = await companyService.updateCompany(req.user!.sub, req.body);
  res.status(200).json({ company });
});
