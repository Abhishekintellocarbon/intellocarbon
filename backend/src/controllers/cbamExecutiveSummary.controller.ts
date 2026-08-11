import { asyncHandler } from "../utils/asyncHandler";
import { generateCbamExecutiveSummary } from "../services/cbamExecutiveSummary.service";
import { logFacilityAudit } from "../services/auditLog.service";

// Streams the PDF straight to the response, same as downloadCbamReport in
// activityData.controller.ts — nothing is stored, since this is a regenerable
// view of data that already lives in the activity data row.
export const downloadCbamExecutiveSummary = asyncHandler(async (req, res) => {
  const { doc, ctx } = await generateCbamExecutiveSummary(req.user!.sub, req.params.facilityId);

  logFacilityAudit(
    ctx.facility.id,
    ctx.facility.companyId,
    "REPORT_GENERATED",
    `CBAM executive summary — ${ctx.periodStart.toLocaleDateString("en-IN")} to ${ctx.periodEnd.toLocaleDateString("en-IN")}`,
    req.user!.sub,
  );

  const slug = ctx.facility.name.replace(/\s+/g, "-").toLowerCase();
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="cbam-executive-summary-${slug}.pdf"`);

  doc.pipe(res);
  doc.end();
});
