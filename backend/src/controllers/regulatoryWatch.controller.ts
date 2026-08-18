import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import * as service from "../services/regulatoryWatch.service";
import { watchEntrySchema } from "../validators/regulatoryWatch.validators";

const badRequest = (error: { issues: { path: (string | number)[]; message: string }[] }): never => {
  const issue = error.issues[0];
  throw AppError.badRequest(
    `${issue?.path.length ? `${issue.path.join(".")}: ` : ""}${issue?.message ?? "Invalid request body"}`,
    "VALIDATION_ERROR",
  );
};

export const listEntries = asyncHandler(async (_req, res) => {
  const entries = await service.listWatchEntries();
  res.status(200).json({ entries });
});

export const createEntry = asyncHandler(async (req, res) => {
  const parsed = watchEntrySchema.safeParse(req.body);
  if (!parsed.success) badRequest(parsed.error);
  const entry = await service.createWatchEntry(parsed.data as never);
  res.status(201).json({ entry });
});

export const updateEntry = asyncHandler(async (req, res) => {
  const parsed = watchEntrySchema.safeParse(req.body);
  if (!parsed.success) badRequest(parsed.error);
  const entry = await service.updateWatchEntry(req.params.entryId, parsed.data as never);
  res.status(200).json({ entry });
});

export const deleteEntry = asyncHandler(async (req, res) => {
  await service.deleteWatchEntry(req.params.entryId);
  res.status(204).send();
});

/** Loads the starting entries. Idempotent — existing entries are never touched. */
export const seedEntries = asyncHandler(async (_req, res) => {
  const created = await service.seedRegulatoryWatch();
  res.status(200).json({ created });
});
