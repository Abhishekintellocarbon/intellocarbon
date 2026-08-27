import { asyncHandler } from "../utils/asyncHandler";
import * as recommendationEngine from "../services/recommendationEngine";

/**
 * IntelloAdvisor Phase 2 — Decarbonization Recommendation Engine.
 *
 * Read-only. The engine derives its output from the facility's stored
 * calculation on every request, so there is nothing to POST, refresh or
 * invalidate: a GET immediately after a resubmission already reflects it.
 */

/** Recommendations for the facility's most recent submitted reporting period. */
export const getFacilityRecommendations = asyncHandler(async (req, res) => {
  const report = await recommendationEngine.getRecommendationsForFacility(req.user!.sub, req.params.facilityId);
  res.status(200).json({ report });
});

/**
 * Recommendations for one specific reporting period. Kept separate from the
 * route above rather than folded into a query parameter so that "the current
 * position" and "this historical period" are distinct, cacheable URLs.
 */
export const getActivityDataRecommendations = asyncHandler(async (req, res) => {
  const report = await recommendationEngine.getRecommendationsForActivityData(
    req.user!.sub,
    req.params.facilityId,
    req.params.dataId,
  );
  res.status(200).json({ report });
});
