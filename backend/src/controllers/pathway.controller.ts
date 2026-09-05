import { asyncHandler } from "../utils/asyncHandler";
import * as pathwayModelling from "../services/pathwayModelling";

/**
 * IntelloAdvisor Phase 4 — Pathway Modelling.
 *
 * Read-only, like the recommendation endpoints beside it. The projection is
 * derived from the facility's stored calculation on every request, so there is
 * nothing to POST and nothing to invalidate.
 *
 * `productionChangePct` is a query parameter rather than a body field for the
 * same reason: the whole response is a pure function of (facility, period,
 * change), so it belongs in a cacheable URL. Omitting it is a valid request —
 * the production-change scenario then returns with a stated reason rather than
 * a default percentage invented on the customer's behalf.
 */

export const getFacilityPathway = asyncHandler(async (req, res) => {
  const productionChangePct = pathwayModelling.parseProductionChangePct(req.query.productionChangePct);
  const report = await pathwayModelling.getPathwayForFacility(req.user!.sub, req.params.facilityId, productionChangePct);
  res.status(200).json({ report });
});

export const getActivityDataPathway = asyncHandler(async (req, res) => {
  const productionChangePct = pathwayModelling.parseProductionChangePct(req.query.productionChangePct);
  const report = await pathwayModelling.getPathwayForActivityData(
    req.user!.sub,
    req.params.facilityId,
    req.params.dataId,
    productionChangePct,
  );
  res.status(200).json({ report });
});
