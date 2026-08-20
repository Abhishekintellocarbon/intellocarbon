import PDFDocument from "pdfkit";
import { PageBuilder } from "../cbamReport/layout";
import { MARGIN_X, CONTENT_WIDTH, MUTED, TEAL, fmt, fmtDateTime } from "../cbamReport/theme";
import { percentBars, CHART_AMBER, CHART_SLATE } from "../cbamReport/charts";
import {
  READINESS_BAND_LABELS,
  type EcovadisReadiness,
  type ReadinessBand,
} from "../ecovadisReadiness.service";

/**
 * EcoVadis readiness summary.
 *
 * ===========================================================================
 * THIS IS NOT AN ECOVADIS SCORE, A MEDAL, OR A SUBMISSION.
 *
 * EcoVadis scores 0-100 and awards medals using its own methodology, weighted
 * by sector, size and country, applied by its analysts to documents submitted
 * on its own platform. None of that is visible from here. What this document
 * reports is how much of each theme the company could already evidence from
 * data it has given Intellocarbon, and where it would be starting from
 * nothing.
 *
 * The styling restraint is therefore deliberate and load-bearing:
 *
 *   - no medal, ribbon, seal, badge or 0-100 number anywhere
 *   - no green/amber/red traffic light on the overall position, which is the
 *     visual grammar of a rating — coverage bars only, which read as "how much
 *     of this do you have" rather than "how good is this"
 *   - both standing notices printed in full, at the front, before any figure
 *   - "readiness" and "coverage" throughout; never "score", "rating" or "grade"
 *
 * A reader glancing at this must not be able to mistake it for an EcoVadis
 * result. If a future change adds any of the above, it stops being a
 * preparation aid and starts misrepresenting a third party's assessment.
 * ===========================================================================
 *
 * A standalone export rather than a page inside another report, because there
 * is no ESG bundle document to put it in — the bundle is a set of separate
 * framework reports plus a dashboard — and because it is company-scoped where
 * every framework report here is facility-scoped. Folding a company-level
 * readiness page into one facility's GRI report would attach it to the wrong
 * subject.
 */

/** Coverage is a quantity, not a grade — so the bars are shaded by how much, not by good or bad. */
const BAND_COLOR: Record<ReadinessBand, string> = {
  STRONG: TEAL,
  ESTABLISHED: TEAL,
  DEVELOPING: CHART_AMBER,
  NOT_STARTED: CHART_SLATE,
};

export const buildEcovadisReadinessSummary = (
  doc: PDFKit.PDFDocument,
  readiness: EcovadisReadiness,
  companyName: string,
) => {
  const pb = new PageBuilder(doc, "ECOVADIS-READINESS", companyName);

  // No cover page: a branded cover with a headline figure is the closest this
  // document could come to looking like a result. It opens on what it is.
  pb.noCoverPage();

  pb.heading("EcoVadis readiness — data coverage summary");
  pb.paragraph(
    `Prepared by Intellocarbon for ${companyName}. It reports how much of each EcoVadis theme this organization ` +
      "could already evidence from data held on the Intellocarbon platform, and where it would be starting from " +
      "nothing.",
  );

  // Both notices before any figure, so nothing below can be read out of context.
  pb.note(readiness.notScoreNotice);
  pb.note(readiness.notSubmissionNotice);

  pb.keyValueColumns(
    "Document control",
    [
      ["Reference", "ECOVADIS-READINESS"],
      ["Version", "v1.0"],
      ["Classification", "Confidential — Internal Preparation"],
      ["Distribution", "Company Admin"],
    ],
    "Scope",
    [
      ["Organization", companyName],
      ["Basis", "Data held on the Intellocarbon platform"],
      ["Themes assessed", `${readiness.themes.length} (EcoVadis's four)`],
      ["Generated", fmtDateTime(new Date())],
    ],
  );

  pb.heading("Coverage by theme");
  pb.paragraph(
    "The bar shows the share of that theme's indicators this organization can already evidence. It is a measure of " +
      "how much data is on file, not of how well the organization performs on the theme.",
    { size: 9.5, color: MUTED },
  );

  pb.y = percentBars(pb.doc, {
    x: MARGIN_X,
    y: pb.y,
    width: CONTENT_WIDTH,
    rows: readiness.themes.map((theme) => ({
      label: theme.label,
      pct: theme.coveragePct,
      valueLabel: `${theme.metCount} of ${theme.totalCount}`,
      color: BAND_COLOR[theme.band],
    })),
  });

  pb.summaryBox(
    "Overall readiness",
    [
      ["Indicators evidenced", `${readiness.metCount} of ${readiness.totalCount}`],
      ["Overall coverage", `${fmt(readiness.coveragePct, 1)}%`],
      ["Overall readiness band", READINESS_BAND_LABELS[readiness.overallBand]],
    ],
  );
  pb.note(
    "The overall band is the weakest theme's band, not an average. EcoVadis assesses all four themes, so strong " +
      "environmental data with nothing on ethics is not a well-prepared position, and averaging would hide exactly " +
      "that.",
  );

  pb.heading("Indicator detail");
  for (const theme of readiness.themes) {
    pb.ensureSpace(60);
    pb.paragraph(`${theme.label} — ${theme.metCount} of ${theme.totalCount} evidenced`, { bold: true, size: 10 });
    pb.table({
      columns: [
        { header: "Indicator", width: 250 },
        { header: "Evidenced", width: 75 },
        { header: "Sourced from", width: 170 },
      ],
      rows: theme.indicators.map((indicator) => [
        indicator.label,
        indicator.met ? "Yes" : "No",
        indicator.sourcedFrom,
      ]),
    });
  }

  if (readiness.gaps.length > 0) {
    pb.heading("Where the gaps are");
    pb.paragraph(
      "Ordered by how little of each theme is currently evidenced. Closing a gap means entering the data on the " +
        "platform, which is what would let this organization evidence it — it is not advice on what to do about the " +
        "underlying issue.",
      { size: 9.5, color: MUTED },
    );
    for (const gap of readiness.gaps) pb.paragraph(gap, { size: 9.5 });
  }

  pb.heading("What this document is not");
  pb.paragraph(
    "This is not an EcoVadis score, medal or rating, and it does not predict one. EcoVadis applies its own " +
      "methodology through its own analysts on its own platform, weighted by sector, size and country, to documents " +
      "submitted to it. Intellocarbon has no relationship with EcoVadis, sends nothing to them, and this summary " +
      "carries no standing in an EcoVadis assessment. The four themes are EcoVadis's; what sits under each is " +
      "Intellocarbon's mapping of this organization's data, not EcoVadis's question set, which is issued per company.",
  );

  pb.finalize();
};

export const generateEcovadisReadinessPdf = (readiness: EcovadisReadiness, companyName: string) => {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 50, left: 50, right: 50, bottom: 20 },
    bufferPages: true,
  });
  buildEcovadisReadinessSummary(doc, readiness, companyName);
  return doc;
};
