import { asyncHandler } from "../utils/asyncHandler";
import * as verifierAssignmentService from "../services/verifierAssignment.service";

export const listVerifiers = asyncHandler(async (_req, res) => {
  const verifiers = await verifierAssignmentService.listVerifiers();
  res.status(200).json({ verifiers });
});

export const createVerifier = asyncHandler(async (req, res) => {
  const verifier = await verifierAssignmentService.createVerifier(req.body);
  res.status(201).json({ verifier });
});

export const assignVerifier = asyncHandler(async (req, res) => {
  const assignment = await verifierAssignmentService.assignVerifierToCompany(
    req.params.companyId,
    req.body.verifierId,
    req.user!.sub,
  );
  res.status(201).json({ assignment });
});

export const unassignVerifier = asyncHandler(async (req, res) => {
  await verifierAssignmentService.unassignVerifierFromCompany(req.params.companyId, req.params.verifierId);
  res.status(204).send();
});

export const deactivateVerifier = asyncHandler(async (req, res) => {
  await verifierAssignmentService.deactivateVerifier(req.params.verifierId);
  res.status(200).json({ success: true });
});

export const reactivateVerifier = asyncHandler(async (req, res) => {
  await verifierAssignmentService.reactivateVerifier(req.params.verifierId);
  res.status(200).json({ success: true });
});
