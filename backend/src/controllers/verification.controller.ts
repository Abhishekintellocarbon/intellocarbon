import { asyncHandler } from "../utils/asyncHandler";
import * as verificationService from "../services/verification.service";
import * as verificationQueryService from "../services/verificationQuery.service";
import { ANNEX_VI_CHECKLIST } from "../data/annexVIChecklist";

export const getChecklistItems = asyncHandler(async (_req, res) => {
  res.status(200).json({ items: ANNEX_VI_CHECKLIST });
});

export const submitForVerification = asyncHandler(async (req, res) => {
  const request = await verificationService.submitForVerification(
    req.user!.sub,
    req.params.facilityId,
    req.params.dataId,
  );
  res.status(201).json({ request });
});

export const getVerificationStatus = asyncHandler(async (req, res) => {
  const request = await verificationService.getVerificationStatus(
    req.user!.sub,
    req.params.facilityId,
    req.params.dataId,
  );
  res.status(200).json({ request });
});

export const listPending = asyncHandler(async (req, res) => {
  const requests = await verificationService.listPending(req.user!.sub);
  res.status(200).json({ requests });
});

export const listMyAssignments = asyncHandler(async (req, res) => {
  const requests = await verificationService.listMyAssignments(req.user!.sub);
  res.status(200).json({ requests });
});

export const getRequestDetail = asyncHandler(async (req, res) => {
  const request = await verificationService.getRequestDetail(req.user!.sub, req.params.id);
  res.status(200).json({ request });
});

export const claimRequest = asyncHandler(async (req, res) => {
  const request = await verificationService.claimRequest(req.user!.sub, req.params.id);
  res.status(200).json({ request });
});

export const decideRequest = asyncHandler(async (req, res) => {
  const request = await verificationService.decideRequest(req.user!.sub, req.params.id, req.body);
  res.status(200).json({ request });
});

export const updateChecklist = asyncHandler(async (req, res) => {
  const request = await verificationService.updateChecklist(req.user!.sub, req.params.id, req.body.checklistState);
  res.status(200).json({ request });
});

export const raiseQuery = asyncHandler(async (req, res) => {
  const query = await verificationQueryService.raiseQuery(req.user!.sub, req.params.id, req.body.queryText);
  res.status(201).json({ query });
});

export const listQueriesForRequest = asyncHandler(async (req, res) => {
  const queries = await verificationQueryService.listQueriesForRequest(req.user!.sub, req.params.id);
  res.status(200).json({ queries });
});
