import { asyncHandler } from "../utils/asyncHandler";
import * as verificationQueryService from "../services/verificationQuery.service";

export const listFacilityQueries = asyncHandler(async (req, res) => {
  const queries = await verificationQueryService.listQueriesForFacility(req.user!.sub, req.params.facilityId);
  res.status(200).json({ queries });
});

export const respondToQuery = asyncHandler(async (req, res) => {
  const query = await verificationQueryService.respondToQuery(
    req.user!.sub,
    req.params.facilityId,
    req.params.queryId,
    req.body.responseText,
  );
  res.status(200).json({ query });
});
