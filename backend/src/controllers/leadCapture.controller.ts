import { asyncHandler } from "../utils/asyncHandler";
import * as leadCaptureService from "../services/leadCapture.service";
import { listLeadsQuerySchema } from "../validators/leadCapture.validators";
import { AppError } from "../utils/AppError";
import { buildComplyPdf } from "../services/complyPdf.service";
import type { ComplyResults } from "../services/intellocalcCalculations";

export const submitLead = asyncHandler(async (req, res) => {
  const { lead, results } = await leadCaptureService.createLead(req.body);
  res.status(201).json({ results, leadId: lead.id });
});

export const listLeads = asyncHandler(async (req, res) => {
  const query = listLeadsQuerySchema.parse(req.query);
  const leads = await leadCaptureService.listLeads(query);
  res.status(200).json({ leads });
});

export const downloadComplyPdf = asyncHandler(async (req, res) => {
  const lead = await leadCaptureService.getLeadById(req.params.leadId);
  if (!lead || lead.toolUsed !== "COMPLY") {
    throw AppError.notFound("Compliance map not found");
  }

  const doc = buildComplyPdf(lead.name, lead.company, lead.resultsJson as unknown as ComplyResults);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="intellocalc-comply-map-${lead.id.slice(-8)}.pdf"`);
  doc.pipe(res);
  doc.end();
});
