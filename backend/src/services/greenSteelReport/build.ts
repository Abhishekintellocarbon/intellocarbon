import PDFDocument from "pdfkit";
import type { Company, Facility, GreenSteelAssessment } from "@prisma/client";
import { PageBuilder } from "../cbamReport/layout";
import { MARGIN_X, CONTENT_WIDTH, MUTED, fmt, fmtInt, fmtDate } from "../cbamReport/theme";
import {
  GREEN_STEEL_BANDS,
  GREEN_STEEL_THRESHOLD_TCO2E_PER_T,
  GREEN_STEEL_CERTIFICATION_NOTICE,
  GREEN_STEEL_BOUNDARY_NOTICE,
  rateGreenSteel,
} from "../greenSteel.service";

/**
 * Green Steel calculation summary.
 *
 * ===========================================================================
 * THIS IS NOT A CERTIFICATE, AND MUST NOT LOOK LIKE ONE.
 *
 * NISST issues Green Steel certification. This document exists so a producer
 * can see the calculation and carry the figures into that submission. The
 * styling restraint is therefore deliberate and load-bearing, not an
 * unfinished job:
 *
 *   - no seal, crest, border, guilloche or certificate furniture
 *   - no signature line, no "awarded to", no reference number that could be
 *     mistaken for a certificate number
 *   - no Ministry of Steel or NISST logo, which would imply endorsement
 *   - the star band is stated as where a calculation landed, never as a
 *     status the holder has been granted
 *
 * A reader glancing at this must not be able to mistake it for government
 * certification. If a future change adds any of the above, it stops being a
 * working paper and starts being a forgery risk.
 * ===========================================================================
 */

type FacilityWithCompany = Facility & { company: Company };

const NOT_RATED_LABEL = "Not rated under the taxonomy";

const bandTableRows = () =>
  GREEN_STEEL_BANDS.map((band, index) => {
    const lower = index === 0 ? null : GREEN_STEEL_BANDS[index - 1].upperExclusive;
    return [
      `${band.stars}-star`,
      lower == null ? `Below ${band.upperExclusive}` : `${lower} to below ${band.upperExclusive}`,
    ];
  });

export const buildGreenSteelSummary = (
  doc: PDFKit.PDFDocument,
  assessment: GreenSteelAssessment,
  facility: FacilityWithCompany,
) => {
  const pb = new PageBuilder(doc, `GS-${assessment.id.slice(-8).toUpperCase()}`);
  const rating = rateGreenSteel(assessment.emissionIntensity);

  // A plain title block, not a cover page. The Communication Package opens
  // with a branded cover because it is a submission; this one opens with what
  // it is, so the first thing read is the scope of the document.
  pb.heading("Green Steel Taxonomy — calculation summary");
  pb.paragraph(
    "Working paper prepared by Intellocarbon. It sets out the emission intensity calculated from this facility's " +
      "submitted activity data and shows where that figure falls against the bands in the Ministry of Steel's " +
      "Taxonomy of Green Steel (Gazette Notification No. 763(E), 12 December 2024).",
  );

  pb.note(GREEN_STEEL_CERTIFICATION_NOTICE);

  pb.keyValueColumns(
    "Facility",
    [
      ["Facility", facility.name],
      ["Company", facility.company.name],
    ],
    "Assessment",
    [
      ["Reporting period", assessment.reportingPeriod],
      ["Prepared on", fmtDate(new Date())],
    ],
  );

  pb.heading("Calculated emission intensity");
  pb.table({
    columns: [
      { header: "Figure", width: 300 },
      { header: "Value", width: 195, align: "right" },
    ],
    rows: [
      ["Total emissions (Scope 1 + Scope 2 + precursors, AR5)", `${fmtInt(assessment.totalEmissionsTco2e)} tCO2e`],
      ["Production", `${fmtInt(assessment.productionTonnes)} t`],
      ["Emission intensity", `${fmt(assessment.emissionIntensity, 3)} tCO2e/t`],
      ["Taxonomy threshold", `${GREEN_STEEL_THRESHOLD_TCO2E_PER_T} tCO2e/t`],
      [
        "Difference against threshold",
        `${rating.percentBelowThreshold >= 0 ? "" : "+"}${fmt(Math.abs(rating.percentBelowThreshold), 1)}% ${
          rating.percentBelowThreshold >= 0 ? "below" : "above"
        }`,
      ],
      ["Activity data entries aggregated", fmtInt(assessment.activityDataCount)],
    ],
  });

  pb.heading("Where this falls");
  // Stated as a sentence about the calculation rather than a large star
  // graphic. A row of five stars is exactly the furniture that would make this
  // read as an award.
  pb.paragraph(
    rating.stars == null
      ? `${NOT_RATED_LABEL}. ${rating.summary}`
      : `Calculated band: ${rating.stars}-star. ${rating.summary}`,
    { bold: true },
  );

  pb.paragraph(
    "The taxonomy's bands are absolute intensities, not percentages below the threshold. The percentage above is " +
      "reported for tracking progress only and does not determine the band.",
    { size: 9.5, color: MUTED },
  );

  pb.table({
    columns: [
      { header: "Band", width: 150 },
      { header: "Emission intensity (tCO2e per tonne of finished steel)", width: 345 },
    ],
    rows: bandTableRows(),
  });

  pb.paragraph(
    `Steel at or above ${GREEN_STEEL_THRESHOLD_TCO2E_PER_T} tCO2e per tonne is not rated under the taxonomy. ` +
      "The Ministry of Steel reviews the threshold every three years.",
    { size: 9.5, color: MUTED },
  );

  pb.heading("Basis of the figure");
  pb.paragraph(GREEN_STEEL_BOUNDARY_NOTICE, { size: 10 });

  pb.heading("What this document is not");
  pb.paragraph(
    "This is not a Green Steel certificate and confers no rating. Certification under the taxonomy is issued by " +
      "NISST following its own measurement, reporting and verification process. Intellocarbon is not a certifying " +
      "body, has no role in that process, and this summary carries no standing in it. Figures should be confirmed " +
      "against NISST's requirements before submission.",
    { size: 10 },
  );

  doc.moveDown(0.5);
  doc
    .fontSize(8)
    .fillColor(MUTED)
    .text(
      "Prepared by Intellocarbon from client-submitted data. Not a certificate. Not issued, endorsed or verified by the Ministry of Steel or NISST.",
      MARGIN_X,
      doc.y,
      { width: CONTENT_WIDTH },
    );
};

export const generateGreenSteelPdf = (assessment: GreenSteelAssessment, facility: FacilityWithCompany) => {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 50, left: 50, right: 50, bottom: 20 },
    bufferPages: true,
  });
  buildGreenSteelSummary(doc, assessment, facility);
  return doc;
};
