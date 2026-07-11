import { MARGIN_X, CONTENT_WIDTH, NAVY, TEAL_DARK, MUTED, BORDER } from "../cbamReport/theme";

const PAGE_RIGHT = MARGIN_X + CONTENT_WIDTH;
const TOP_Y = 78;
const FOOTER_NOTE = "Intellocarbon Solutions Private Limited  |  intellocarbon.com  |  Confidential";
const BODY_COLOR = "#1A2530";

/**
 * Lean, text-focused page builder for legal-agreement PDFs (DPA, NDA, ...) — same
 * logo/margin/footer conventions as the branded report builders (cbamReport/layout.ts),
 * but no cover hero, TOC, QR code, or chart support, since a signed contract isn't a
 * data report. Shared by every legal-document generator so their visual style can't
 * drift between documents — pass the running-header label (e.g. "DATA PROCESSING
 * AGREEMENT") specific to the document being built.
 */
export class LegalDocumentPageBuilder {
  doc: PDFKit.PDFDocument;
  y = TOP_Y;
  private logoPath: string;
  private pageHeaderLabel: string;

  constructor(doc: PDFKit.PDFDocument, logoPath: string, pageHeaderLabel: string) {
    this.doc = doc;
    this.logoPath = logoPath;
    this.pageHeaderLabel = pageHeaderLabel;
    this.drawPageHeader();
  }

  private drawPageHeader() {
    const doc = this.doc;
    doc.image(this.logoPath, MARGIN_X, 24, { width: 90 });
    doc
      .fillColor(MUTED)
      .font("Helvetica-Bold")
      .fontSize(8)
      .text(this.pageHeaderLabel, MARGIN_X, 32, { width: CONTENT_WIDTH, align: "right", characterSpacing: 1 });
    doc.moveTo(MARGIN_X, 56).lineTo(PAGE_RIGHT, 56).strokeColor(BORDER).lineWidth(1).stroke();
    this.y = TOP_Y;
  }

  private newPage() {
    this.doc.addPage();
    this.drawPageHeader();
  }

  ensureSpace(needed: number) {
    if (this.y + needed > this.doc.page.height - 60) {
      this.newPage();
    }
  }

  titleBlock(title: string, subtitle: string, effectiveDateLabel: string) {
    this.doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(22).text(title, MARGIN_X, this.y, { width: CONTENT_WIDTH });
    this.y = this.doc.y + 4;
    this.doc.fillColor(MUTED).font("Helvetica").fontSize(11).text(subtitle, MARGIN_X, this.y, { width: CONTENT_WIDTH });
    this.y = this.doc.y + 4;
    this.doc.fillColor(MUTED).font("Helvetica").fontSize(9.5).text(effectiveDateLabel, MARGIN_X, this.y);
    this.y = this.doc.y + 16;
    this.doc.moveTo(MARGIN_X, this.y).lineTo(PAGE_RIGHT, this.y).strokeColor(BORDER).lineWidth(1).stroke();
    this.y += 16;
  }

  paragraph(text: string, opts: { bold?: boolean; size?: number } = {}) {
    this.ensureSpace(20);
    this.doc
      .fillColor(BODY_COLOR)
      .font(opts.bold ? "Helvetica-Bold" : "Helvetica")
      .fontSize(opts.size ?? 10)
      .text(text, MARGIN_X, this.y, { width: CONTENT_WIDTH, lineGap: 2 });
    this.y = this.doc.y + 9;
  }

  sectionHeading(text: string) {
    this.ensureSpace(30);
    this.doc.fillColor(TEAL_DARK).font("Helvetica-Bold").fontSize(12.5).text(text, MARGIN_X, this.y, { width: CONTENT_WIDTH });
    this.y = this.doc.y + 8;
  }

  /** Signature block — a drawn blank line for the physical/digital signature, then typed Name/Designation/Date. `dateValue` of null renders a literal blank underscore line, matching an unsigned counterpart's Date field. */
  signatureBlock(orgHeading: string, name: string, designation: string, dateValue: string | null) {
    this.ensureSpace(110);
    this.doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(11).text(orgHeading, MARGIN_X, this.y);
    this.y = this.doc.y + 22;

    this.doc.moveTo(MARGIN_X, this.y).lineTo(MARGIN_X + 220, this.y).strokeColor(BORDER).lineWidth(1).stroke();
    this.y += 14;

    this.doc.fillColor(BODY_COLOR).font("Helvetica").fontSize(9.5);
    this.doc.text(`Name: ${name}`, MARGIN_X, this.y);
    this.y = this.doc.y + 5;
    this.doc.text(`Designation: ${designation}`, MARGIN_X, this.y);
    this.y = this.doc.y + 5;
    this.doc.text(`Date: ${dateValue ?? "____________"}`, MARGIN_X, this.y);
    this.y = this.doc.y + 26;
  }

  private drawFooter(pageNumber: number, total: number) {
    const height = this.doc.page.height;
    this.doc
      .fillColor(MUTED)
      .font("Helvetica")
      .fontSize(7.5)
      .text(FOOTER_NOTE, MARGIN_X, height - 46, { width: CONTENT_WIDTH, align: "center", lineBreak: false });
    this.doc
      .fillColor(MUTED)
      .font("Helvetica")
      .fontSize(7.5)
      .text(`Page ${pageNumber} of ${total}`, MARGIN_X, height - 34, { width: CONTENT_WIDTH, align: "center", lineBreak: false });
  }

  finalize() {
    const range = this.doc.bufferedPageRange();
    const total = range.count;
    for (let i = range.start; i < range.start + range.count; i++) {
      this.doc.switchToPage(i);
      this.drawFooter(i + 1, total);
    }
  }
}
