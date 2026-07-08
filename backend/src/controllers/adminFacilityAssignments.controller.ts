import { asyncHandler } from "../utils/asyncHandler";
import * as facilityAssignmentService from "../services/facilityAssignment.service";

export const listInternalOperators = asyncHandler(async (_req, res) => {
  const operators = await facilityAssignmentService.listInternalOperators();
  res.status(200).json({ operators });
});

export const createInternalOperator = asyncHandler(async (req, res) => {
  const operator = await facilityAssignmentService.createInternalOperator(req.body);
  res.status(201).json({ operator });
});

export const listAssignmentsForFacility = asyncHandler(async (req, res) => {
  const assignments = await facilityAssignmentService.listAssignmentsForFacility(req.params.facilityId);
  res.status(200).json({ assignments });
});

export const assignOperator = asyncHandler(async (req, res) => {
  const assignment = await facilityAssignmentService.assignOperatorToFacility(
    req.params.facilityId,
    req.body.userId,
    req.user!.sub,
  );
  res.status(201).json({ assignment });
});

export const unassignOperator = asyncHandler(async (req, res) => {
  await facilityAssignmentService.unassignOperatorFromFacility(req.params.facilityId, req.params.userId);
  res.status(204).send();
});
