import { asyncHandler } from "../utils/asyncHandler";
import * as scope3Service from "../services/scope3.service";
import { parseScope3Entry } from "../validators/scope3.validators";
import { SCOPE3_CATEGORY_CATALOG } from "../data/scope3Categories";

// Reference endpoint for the frontend's category picker — all 15 GHG
// Protocol categories, flagged with which 5 are actually calculable today,
// so the UI can show an honest "not yet supported" state for the rest.
export const listScope3Categories = asyncHandler(async (_req, res) => {
  res.status(200).json({ categories: SCOPE3_CATEGORY_CATALOG });
});

export const listScope3Data = asyncHandler(async (req, res) => {
  const reportingPeriod = typeof req.query.reportingPeriod === "string" ? req.query.reportingPeriod : undefined;
  const result = await scope3Service.listScope3Data(req.user!.sub, req.params.facilityId, reportingPeriod);
  res.status(200).json(result);
});

export const saveScope3Data = asyncHandler(async (req, res) => {
  const submit = req.body?.submit === true;
  const parsed = parseScope3Entry(req.body);
  const entry = await scope3Service.saveScope3Data(req.user!.sub, req.params.facilityId, parsed, submit);
  res.status(200).json({ entry });
});

export const deleteScope3Data = asyncHandler(async (req, res) => {
  await scope3Service.deleteScope3Data(req.user!.sub, req.params.facilityId, req.params.period, req.params.category);
  res.status(204).send();
});
