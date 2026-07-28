import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import * as cctsObligatedEntityService from "../services/cctsObligatedEntity.service";

export const listEntities = asyncHandler(async (req, res) => {
  const { state, sector, status, search } = req.query as Record<string, string | undefined>;
  const entities = await cctsObligatedEntityService.listObligatedEntities({ state, sector, status: status as "DRAFT" | "FINAL" | undefined, search });
  res.status(200).json({ entities });
});

export const createEntity = asyncHandler(async (req, res) => {
  const entity = await cctsObligatedEntityService.createObligatedEntity(req.body);
  res.status(201).json({ entity });
});

export const updateEntity = asyncHandler(async (req, res) => {
  const entity = await cctsObligatedEntityService.updateObligatedEntity(req.params.id, req.body);
  res.status(200).json({ entity });
});

export const deleteEntity = asyncHandler(async (req, res) => {
  await cctsObligatedEntityService.deleteObligatedEntity(req.params.id);
  res.status(204).send();
});

export const bulkImport = asyncHandler(async (req, res) => {
  const { rows } = req.body as { rows?: unknown };
  if (!Array.isArray(rows) || rows.length === 0) {
    throw AppError.badRequest("No rows to import", "VALIDATION_ERROR");
  }
  if (rows.length > 2000) {
    throw AppError.badRequest("Import at most 2000 rows at a time", "VALIDATION_ERROR");
  }

  const results = await cctsObligatedEntityService.bulkImportObligatedEntities(rows);
  const succeeded = results.filter((r) => r.success).length;
  res.status(200).json({ results, succeeded, failed: results.length - succeeded });
});
