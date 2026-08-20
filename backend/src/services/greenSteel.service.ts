import type { Company } from "@prisma/client";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";
import { requireOwnedFacilityForCbam } from "./cbamAccess.service";
import { resolveFyWindow as resolveBrsrFyWindow } from "./brsrCalculation.service";

/**
 * India's Green Steel Taxonomy — Ministry of Steel, Gazette Notification
 * No. 763(E), 12 December 2024.
 *
 * ===========================================================================
 * INTELLOCARBON DOES NOT CERTIFY GREEN STEEL.
 *
 * The National Institute of Secondary Steel Technology (NISST) is the notified
 * nodal agency for measurement, reporting, verification and certificate
 * issuance under the taxonomy. This module calculates the emission intensity a
 * producer would submit to NISST and shows where it falls against the
 * published bands. That is preparation, not certification, and the same line
 * already drawn for CBAM, CCTS and BRSR verification applies: no output here
 * may be worded, styled or exported as a certificate, and no copy may say a
 * producer "is" 4-star — only that its calculated intensity falls in the
 * 4-star band.
 * ===========================================================================
 *
 * THE BANDS ARE ABSOLUTE INTENSITIES, NOT PERCENTAGES BELOW THE THRESHOLD.
 * This is worth stating because it is the natural thing to assume and it is
 * wrong: the notification sets fixed cut-offs in tCO2e per tonne of finished
 * steel, so a producer at 1.59 is five-star regardless of what percentage
 * below 2.2 that represents. A percentage is still reported alongside because
 * it is useful for tracking progress, but it never drives the rating.
 *
 *   Five-star   intensity < 1.6
 *   Four-star   1.6 <= intensity < 2.0
 *   Three-star  2.0 <= intensity < 2.2
 *   Not rated   intensity >= 2.2
 *
 * BOUNDARY HANDLING. The notification words the middle bands as "between 1.6
 * and 2.0" and "between 2.0 and 2.2", which leaves 2.0 named by both. Ties are
 * resolved DOWNWARD here — 2.0 is three-star, not four — because the two
 * errors are not symmetric: awarding a star the producer has not earned is the
 * failure that reaches a buyer as an overstated claim, and a producer sitting
 * exactly on a boundary should be told the conservative reading so they can
 * confirm it with NISST rather than discover it at certification.
 *
 * The threshold is to be reviewed every three years, so treat the constants
 * below as a dated reading of the notification rather than a fixed law of
 * nature; they are in one place so a revision is a one-line change.
 */

/** tCO2e per tonne of finished steel, at or above which steel is not green. */
export const GREEN_STEEL_THRESHOLD_TCO2E_PER_T = 2.2;

/**
 * Upper bound of each star band, exclusive, best first. Read with the
 * boundary rule above: a value equal to a bound falls into the NEXT band down.
 */
export const GREEN_STEEL_BANDS = [
  { stars: 5 as const, upperExclusive: 1.6 },
  { stars: 4 as const, upperExclusive: 2.0 },
  { stars: 3 as const, upperExclusive: GREEN_STEEL_THRESHOLD_TCO2E_PER_T },
];

export type GreenSteelStars = 3 | 4 | 5;

export interface GreenSteelRating {
  /** Null where the intensity is at or above 2.2 — not rated, not zero. */
  stars: GreenSteelStars | null;
  qualifiesAsGreen: boolean;
  /**
   * How far below 2.2 the intensity sits, as a percentage. Reported for
   * progress tracking only — it does not determine the band. Negative when
   * the intensity is above the threshold.
   */
  percentBelowThreshold: number;
  /** Plain-language statement of where the number landed. */
  summary: string;
}

const round = (value: number, decimals = 2) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const starLabel = (stars: GreenSteelStars) => `${stars}-star`;

/**
 * Maps a calculated intensity onto the taxonomy's bands.
 *
 * Takes the number rather than reading it, so the band logic is testable
 * without a database and the provenance of the intensity stays the caller's
 * problem.
 */
export const rateGreenSteel = (emissionIntensity: number): GreenSteelRating => {
  const percentBelowThreshold = round(
    ((GREEN_STEEL_THRESHOLD_TCO2E_PER_T - emissionIntensity) / GREEN_STEEL_THRESHOLD_TCO2E_PER_T) * 100,
    1,
  );

  const band = GREEN_STEEL_BANDS.find((b) => emissionIntensity < b.upperExclusive);

  if (!band) {
    return {
      stars: null,
      qualifiesAsGreen: false,
      percentBelowThreshold,
      summary:
        `Calculated intensity of ${round(emissionIntensity)} tCO2e per tonne is at or above the ` +
        `${GREEN_STEEL_THRESHOLD_TCO2E_PER_T} tCO2e threshold, so it does not fall in a star band under the taxonomy.`,
    };
  }

  return {
    stars: band.stars,
    qualifiesAsGreen: true,
    percentBelowThreshold,
    summary:
      `Calculated intensity of ${round(emissionIntensity)} tCO2e per tonne falls in the ` +
      `${starLabel(band.stars)} band (below ${band.upperExclusive} tCO2e per tonne).`,
  };
};

// ---------------------------------------------------------------------------
// Applicability
// ---------------------------------------------------------------------------

/**
 * The taxonomy covers steel. An intensity computed for a cement or aluminium
 * facility and compared against 2.2 would be a number with no meaning, and
 * showing it a star rating would be worse than showing nothing — so this is a
 * refusal rather than an empty state.
 *
 * NOTE ON WHERE SECTOR LIVES. Facility has no sector column — sector is
 * recorded on Company (the client's registered sector) and again on each
 * ActivityData row (which line the entry came from). So applicability is a
 * company-level question, which also matches how this is sold: it is offered
 * to steel-sector clients.
 *
 * The per-row sector is not ignored, though. A company registered as steel
 * that also files entries for another line would otherwise have those tonnes
 * and emissions pulled into a steel intensity, so the aggregation below
 * filters to STEEL rows as well. Both checks are needed: this one decides
 * whether the module applies at all, that one decides what counts.
 */
export const isGreenSteelApplicable = (company: Pick<Company, "sector">) => company.sector === "STEEL";

export const GREEN_STEEL_NOT_STEEL_MESSAGE =
  "The Green Steel Taxonomy applies to steel producers. This account is not registered in the steel sector, so no assessment is produced.";

/**
 * What every surface must show alongside a rating. Kept here so the dashboard
 * card, the API response and the PDF cannot drift into three different
 * wordings of who certifies.
 */
export const GREEN_STEEL_CERTIFICATION_NOTICE =
  "This assessment is based on Intellocarbon's calculation of your emissions intensity. Formal Green Steel " +
  "certification is issued by NISST (National Institute of Secondary Steel Technology) — this dashboard prepares " +
  "your data for that submission, it does not itself certify.";

/**
 * The boundary this figure is computed on, stated wherever the figure is,
 * because it is the most likely source of a discrepancy against what NISST
 * accepts.
 */
export const GREEN_STEEL_BOUNDARY_NOTICE =
  "Intensity is the CBAM steel calculation already run on your submitted activity data — direct emissions, " +
  "purchased electricity and steam, and precursor emissions — divided by production tonnage, on the AR5 basis. " +
  "The taxonomy's Scope 3 boundary (sintering, pellet making, coke making and raw material procurement) is not " +
  "identical to CBAM's precursor boundary, so confirm the inclusions with NISST before submitting.";

// ---------------------------------------------------------------------------
// Calculation
// ---------------------------------------------------------------------------

export interface GreenSteelFigures {
  totalEmissionsTco2e: number;
  productionTonnes: number;
  emissionIntensity: number;
  activityDataCount: number;
}

/**
 * Aggregates the facility's submitted activity data for the period.
 *
 * The intensity is total emissions over total production — production
 * weighted — rather than the mean of each entry's own intensity. Averaging
 * intensities would let a small, clean batch offset a large, dirty one and
 * would not be the number the taxonomy asks for.
 *
 * Reuses `totalEmissionsCbamAr5`, which is already Scope 1 + Scope 2 +
 * precursors for every CBAM steel client. Nothing is recalculated here; see
 * GREEN_STEEL_BOUNDARY_NOTICE for the caveat that goes with the reuse.
 */
export const computeGreenSteelFigures = async (
  facilityId: string,
  reportingPeriod: string,
  fyStartMonth: number,
): Promise<GreenSteelFigures | null> => {
  // Activity data is dated, not tagged with a period label, so the window is
  // resolved the same way every other framework here resolves it rather than
  // by string match — see brsrCalculation.service.
  const window = resolveBrsrFyWindow(reportingPeriod, fyStartMonth);
  const rows = await prisma.activityData.findMany({
    where: {
      facilityId,
      status: "SUBMITTED",
      // Only steel lines count toward a steel intensity — see the note on
      // isGreenSteelApplicable.
      sector: "STEEL",
      periodStart: { gte: window.start },
      periodEnd: { lt: window.end },
    },
    select: { productionQuantityT: true, calculationResult: { select: { totalEmissionsCbamAr5: true } } },
  });

  const usable = rows.filter((r) => r.calculationResult != null && (r.productionQuantityT ?? 0) > 0);
  if (usable.length === 0) return null;

  const totalEmissionsTco2e = usable.reduce((sum, r) => sum + (r.calculationResult?.totalEmissionsCbamAr5 ?? 0), 0);
  const productionTonnes = usable.reduce((sum, r) => sum + (r.productionQuantityT ?? 0), 0);
  if (productionTonnes <= 0) return null;

  return {
    totalEmissionsTco2e: round(totalEmissionsTco2e),
    productionTonnes: round(productionTonnes),
    emissionIntensity: round(totalEmissionsTco2e / productionTonnes, 4),
    activityDataCount: usable.length,
  };
};

export type GreenSteelAssessmentResult =
  | { applicable: false; reason: string; sector: string }
  | {
      applicable: true;
      facilityId: string;
      reportingPeriod: string;
      figures: GreenSteelFigures | null;
      rating: GreenSteelRating | null;
      threshold: number;
      assessmentId: string | null;
      certificationNotice: string;
      boundaryNotice: string;
      /** Prior periods, oldest first, for the trend view. */
      history: { reportingPeriod: string; emissionIntensity: number; starRating: number | null }[];
    };

/**
 * The facility's assessment for a period.
 *
 * Non-steel returns `applicable: false` rather than throwing, so the dashboard
 * can decide not to render the card without treating it as an error. The PDF
 * route does throw, since generating a document for a facility the taxonomy
 * does not cover is never a reasonable request.
 */
export const getGreenSteelAssessment = async (
  userId: string,
  facilityId: string,
  reportingPeriod: string,
): Promise<GreenSteelAssessmentResult> => {
  const facility = await requireOwnedFacilityForCbam(userId, facilityId);

  if (!isGreenSteelApplicable(facility.company)) {
    return { applicable: false, reason: GREEN_STEEL_NOT_STEEL_MESSAGE, sector: facility.company.sector };
  }

  const figures = await computeGreenSteelFigures(facilityId, reportingPeriod, facility.company.reportingFyStartMonth);
  const rating = figures ? rateGreenSteel(figures.emissionIntensity) : null;

  // Snapshot only when there is something to snapshot. An assessment row with
  // no figures would be a record of an absence.
  let assessmentId: string | null = null;
  if (figures && rating) {
    const saved = await prisma.greenSteelAssessment.upsert({
      where: { facilityId_reportingPeriod: { facilityId, reportingPeriod } },
      create: {
        companyId: facility.companyId,
        facilityId,
        reportingPeriod,
        totalEmissionsTco2e: figures.totalEmissionsTco2e,
        productionTonnes: figures.productionTonnes,
        emissionIntensity: figures.emissionIntensity,
        starRating: rating.stars,
        qualifiesAsGreen: rating.qualifiesAsGreen,
        activityDataCount: figures.activityDataCount,
      },
      update: {
        totalEmissionsTco2e: figures.totalEmissionsTco2e,
        productionTonnes: figures.productionTonnes,
        emissionIntensity: figures.emissionIntensity,
        starRating: rating.stars,
        qualifiesAsGreen: rating.qualifiesAsGreen,
        activityDataCount: figures.activityDataCount,
      },
    });
    assessmentId = saved.id;
  }

  const history = await prisma.greenSteelAssessment.findMany({
    where: { facilityId },
    orderBy: { reportingPeriod: "asc" },
    select: { reportingPeriod: true, emissionIntensity: true, starRating: true },
  });

  return {
    applicable: true,
    facilityId,
    reportingPeriod,
    figures,
    rating,
    threshold: GREEN_STEEL_THRESHOLD_TCO2E_PER_T,
    assessmentId,
    certificationNotice: GREEN_STEEL_CERTIFICATION_NOTICE,
    boundaryNotice: GREEN_STEEL_BOUNDARY_NOTICE,
    history,
  };
};

/** Loads a stored assessment for the PDF, enforcing ownership and sector. */
export const getGreenSteelAssessmentById = async (userId: string, assessmentId: string) => {
  const assessment = await prisma.greenSteelAssessment.findUnique({
    where: { id: assessmentId },
    include: { facility: { include: { company: { include: { owner: true } } } } },
  });

  if (!assessment || assessment.facility.company.ownerId !== userId) {
    throw AppError.notFound("Green Steel assessment not found");
  }
  await requireOwnedFacilityForCbam(userId, assessment.facilityId);

  if (!isGreenSteelApplicable(assessment.facility.company)) {
    throw AppError.badRequest(GREEN_STEEL_NOT_STEEL_MESSAGE, "GREEN_STEEL_NOT_STEEL");
  }

  return assessment;
};
