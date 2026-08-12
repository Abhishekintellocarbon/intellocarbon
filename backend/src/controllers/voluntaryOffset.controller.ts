import { asyncHandler } from "../utils/asyncHandler";
import * as voluntaryOffsetService from "../services/voluntaryOffset.service";
import { voluntaryOffsetSchema } from "../validators/voluntaryOffset.validators";

// `submit: true` stores the purchase as SUBMITTED, otherwise DRAFT — same
// single-endpoint convention as issbApi.save / scope3Controller.saveScope3Data,
// rather than a separate submit route.
const parseBody = (body: unknown) => {
  const { submit, ...rest } = (body ?? {}) as Record<string, unknown>;
  return { input: voluntaryOffsetSchema.parse(rest), submit: submit === true };
};

export const listVoluntaryOffsets = asyncHandler(async (req, res) => {
  const result = await voluntaryOffsetService.listOffsets(req.user!.sub, req.params.facilityId);
  res.status(200).json(result);
});

export const createVoluntaryOffset = asyncHandler(async (req, res) => {
  const { input, submit } = parseBody(req.body);
  const purchase = await voluntaryOffsetService.createOffset(req.user!.sub, req.params.facilityId, input, submit);
  res.status(201).json({ purchase });
});

export const updateVoluntaryOffset = asyncHandler(async (req, res) => {
  const { input, submit } = parseBody(req.body);
  const purchase = await voluntaryOffsetService.updateOffset(
    req.user!.sub,
    req.params.facilityId,
    req.params.purchaseId,
    input,
    submit,
  );
  res.status(200).json({ purchase });
});

export const deleteVoluntaryOffset = asyncHandler(async (req, res) => {
  await voluntaryOffsetService.deleteOffset(req.user!.sub, req.params.facilityId, req.params.purchaseId);
  res.status(204).send();
});
