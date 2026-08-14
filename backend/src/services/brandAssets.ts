import path from "path";

/**
 * Brand asset paths for the PDF builders.
 *
 * Two lockups, because one file cannot serve both backgrounds these documents
 * use. The report covers paint a #00A88E -> #0F1923 gradient band and need a
 * light lockup; interior page headers and the legal documents are plain white
 * pages and need a dark one.
 *
 * This split also fixes a pre-existing defect. The previous single asset had a
 * white "Intello" wordmark, which was correct on the cover band and invisible
 * on every interior page header — the mark and the teal "carbon" showed, the
 * first word did not. Picking the variant per background is what makes the
 * wordmark legible on both.
 *
 * Both files are 2416x512 (the 604x128 ratio the layouts already assume, at
 * 4x for print). pdfkit's doc.image(..., { width }) derives height from the
 * file, so a replacement of a different aspect ratio would silently resize the
 * logo on every page — keep the ratio if these are ever regenerated.
 */
const ASSETS_DIR = path.join(__dirname, "../assets");

/** Light lockup — for the dark gradient cover band. */
export const LOGO_LOCKUP_ON_DARK = path.join(ASSETS_DIR, "logo-full.png");

/** Dark lockup — for white interior pages and the legal documents. */
export const LOGO_LOCKUP_ON_LIGHT = path.join(ASSETS_DIR, "logo-full-onlight.png");
