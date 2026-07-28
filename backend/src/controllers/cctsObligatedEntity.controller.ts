import { asyncHandler } from "../utils/asyncHandler";
import * as cctsObligatedEntityService from "../services/cctsObligatedEntity.service";

// Public, unauthenticated lookup — the "CCTS Obligated Entities Tracker"
// lead-gen page. Read-only: manual entry/verification happens only through
// the Super Admin Regulatory Watch panel (see adminCctsObligatedEntities.controller.ts).
export const listPublicEntities = asyncHandler(async (req, res) => {
  const { state, sector, status, search } = req.query as Record<string, string | undefined>;
  const [entities, lastVerifiedDate] = await Promise.all([
    cctsObligatedEntityService.listObligatedEntities({
      state,
      sector,
      status: status as "DRAFT" | "FINAL" | undefined,
      search,
    }),
    cctsObligatedEntityService.getLastVerifiedDate(),
  ]);
  res.status(200).json({ entities, lastVerifiedDate });
});
