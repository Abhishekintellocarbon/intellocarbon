import { asyncHandler } from "../utils/asyncHandler";
import * as leadCaptureService from "../services/leadCapture.service";
import { listLeadsQuerySchema, unsubscribeSchema } from "../validators/leadCapture.validators";
import { suppressEmail, verifyUnsubscribeToken } from "../services/emailSuppression.service";
import { logger } from "../utils/logger";
import { AppError } from "../utils/AppError";
import { buildComplyPdf } from "../services/complyPdf.service";
import type { ComplyResults } from "../services/intellocalcCalculations";

export const submitLead = asyncHandler(async (req, res) => {
  const { lead, results } = await leadCaptureService.createLead(req.body);
  res.status(201).json({ results, leadId: lead.id });
});

export const submitEsgWaitlist = asyncHandler(async (req, res) => {
  const { lead } = await leadCaptureService.createEsgWaitlistSignup(req.body);
  res.status(201).json({ leadId: lead.id });
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

  // COMPLY leads always carry name/company (only the ESG_* waitlist tool
  // omits them) — the fallback here is just to satisfy the nullable column type.
  const doc = buildComplyPdf(lead.name ?? "there", lead.company ?? "your company", lead.resultsJson as unknown as ComplyResults);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="intellocalc-comply-map-${lead.id.slice(-8)}.pdf"`);
  doc.pipe(res);
  doc.end();
});

/**
 * Public unsubscribe. POST, not GET, per RFC 8058 — mail clients and security
 * scanners prefetch links, so a GET that mutates would let a scanner
 * unsubscribe a recipient who never clicked anything.
 *
 * Always reports success, even for a bad token or an address that was already
 * suppressed. The endpoint is unauthenticated, so distinguishing "wrong
 * token" from "right token, already unsubscribed" would turn it into an
 * oracle for probing which addresses are on the list. The real outcome is
 * logged server-side instead.
 */
export const unsubscribe = asyncHandler(async (req, res) => {
  const parsed = unsubscribeSchema.safeParse(req.body);
  if (!parsed.success) {
    throw AppError.badRequest(parsed.error.issues[0]?.message ?? "Invalid request body", "VALIDATION_ERROR");
  }

  const { email, token } = parsed.data;
  if (verifyUnsubscribeToken(email, token)) {
    await suppressEmail(email, "Unsubscribed via email link");
  } else {
    logger.warn(`Unsubscribe attempted with an invalid token for ${email}`);
  }

  res.status(200).json({ unsubscribed: true });
});
