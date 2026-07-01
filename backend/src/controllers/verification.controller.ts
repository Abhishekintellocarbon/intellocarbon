import { asyncHandler } from "../utils/asyncHandler";
import * as verificationService from "../services/verification.service";

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

export const listPending = asyncHandler(async (_req, res) => {
  const requests = await verificationService.listPending();
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
