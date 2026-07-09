import { asyncHandler } from "../utils/asyncHandler";
import * as crossCheckReviewService from "../services/crossCheckReview.service";

export const listForFacility = asyncHandler(async (req, res) => {
  const entries = await crossCheckReviewService.listCrossCheckReviewsForFacility(req.user!, req.params.facilityId);
  res.status(200).json({ entries });
});

export const upsertReview = asyncHandler(async (req, res) => {
  const review = await crossCheckReviewService.upsertCrossCheckReview(
    req.user!,
    req.params.activityDataId,
    req.params.documentId,
    req.body,
  );
  res.status(200).json({ review });
});
