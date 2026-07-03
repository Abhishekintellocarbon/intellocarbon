import {
  TEAL,
  TEAL_DARK,
  NAVY,
  MUTED,
  BORDER,
  ROW_ALT,
  WHITE,
  DANGER,
  MARGIN_X,
  CONTENT_WIDTH,
  TOP_Y,
  PAGE_WIDTH,
} from "./theme";

const PAGE_RIGHT = MARGIN_X + CONTENT_WIDTH;
const FOOTER_NOTE = "Intellocarbon Solutions Private Limited  |  intellocarbon.com  |  Confidential";

interface TocEntry {
  number: number;
  title: string;
  pageIndex: number;
}

export interface TableColumn {
  header: string;
  width: number;
  align?: "left" | "right";
}

export interface TableOptions {
  columns: TableColumn[];
  rows: (string | number)[][];
  highlightRowIndex?: number;
  highlightNote?: string;
}

export class PageBuilder {
  doc: PDFKit.PDFDocument;
  y = TOP_Y;
  private toc: TocEntry[] = [];
  private tocPageIndex = -1;
  private tocStartY = TOP_Y;
  private coverPageIndex = 0;
  private reportReference: string;

  constructor(doc: PDFKit.PDFDocument, reportReference: string) {
    this.doc = doc;
    this.reportReference = reportReference;
  }

  private currentPageIndex() {
    return this.doc.bufferedPageRange().count - 1;
  }

  /** Call once, immediately, for the auto-created first page (the cover). */
  startCover() {
    this.coverPageIndex = this.currentPageIndex();
    this.y = 0;
  }

  startTocPage() {
    this.doc.addPage();
    this.tocPageIndex = this.currentPageIndex();
    this.y = TOP_Y;
    this.doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(18).text("Table of Contents", MARGIN_X, this.y);
    this.y += 34;
    // `this.y` is a shared cursor that later sections will overwrite — the
    // TOC's row-drawing happens later, in finalize(), so its starting
    // position must be captured now rather than read off `this.y` then.
    this.tocStartY = this.y;
  }

  /** A numbered content section — one logical page in the 14-page structure. */
  startSection(number: number, title: string) {
    this.doc.addPage();
    const pageIndex = this.currentPageIndex();
    this.toc.push({ number, title, pageIndex });
    this.y = TOP_Y;
    this.sectionHeader(number, title);
    return pageIndex;
  }

  ensureSpace(needed: number) {
    if (this.y + needed > this.doc.page.height - 60) {
      this.doc.addPage();
      this.y = TOP_Y;
    }
  }

  sectionHeader(number: number, title: string) {
    this.doc
      .fillColor(TEAL_DARK)
      .font("Helvetica-Bold")
      .fontSize(9)
      .text(`SECTION ${String(number).padStart(2, "0")}`, MARGIN_X, this.y);
    this.y += 14;
    this.doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(14).text(title, MARGIN_X, this.y);
    this.y += 20;
    this.doc.moveTo(MARGIN_X, this.y).lineTo(PAGE_RIGHT, this.y).strokeColor(TEAL).lineWidth(1.5).stroke();
    this.y += 14;
  }

  heading(text: string) {
    this.ensureSpace(24);
    this.doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(11).text(text, MARGIN_X, this.y);
    this.y += 16;
    this.doc.moveTo(MARGIN_X, this.y - 3).lineTo(PAGE_RIGHT, this.y - 3).strokeColor(BORDER).lineWidth(1).stroke();
    this.y += 6;
  }

  paragraph(text: string, opts: { color?: string; size?: number; bold?: boolean } = {}) {
    this.ensureSpace(18);
    this.doc
      .fillColor(opts.color ?? "#1A2530")
      .font(opts.bold ? "Helvetica-Bold" : "Helvetica")
      .fontSize(opts.size ?? 10)
      .text(text, MARGIN_X, this.y, { width: CONTENT_WIDTH });
    this.y = this.doc.y + 8;
  }

  /** Small citation / footnote line. */
  note(text: string) {
    this.ensureSpace(14);
    this.doc
      .fillColor(MUTED)
      .font("Helvetica")
      .fontSize(7.5)
      .text(text, MARGIN_X, this.y, { width: CONTENT_WIDTH });
    this.y = this.doc.y + 6;
  }

  keyValueRow(label: string, value: string, opts: { width?: number; x?: number } = {}) {
    const x = opts.x ?? MARGIN_X;
    const width = opts.width ?? CONTENT_WIDTH;
    this.ensureSpace(16);
    this.doc.fillColor(MUTED).font("Helvetica").fontSize(9).text(label, x, this.y, { width, lineBreak: false });
    this.y += 12;
    this.doc
      .fillColor("#1A2530")
      .font("Helvetica-Bold")
      .fontSize(9.5)
      .text(value, x, this.y, { width });
    this.y = Math.max(this.y + 14, this.doc.y + 6);
  }

  /** Two side-by-side key/value columns — installation vs declarant details. */
  keyValueColumns(
    leftTitle: string,
    leftRows: [string, string][],
    rightTitle: string,
    rightRows: [string, string][],
  ) {
    const colWidth = (CONTENT_WIDTH - 24) / 2;

    this.doc.fillColor(TEAL_DARK).font("Helvetica-Bold").fontSize(10).text(leftTitle, MARGIN_X, this.y);
    const leftHeaderY = this.y;
    this.doc
      .fillColor(TEAL_DARK)
      .font("Helvetica-Bold")
      .fontSize(10)
      .text(rightTitle, MARGIN_X + colWidth + 24, leftHeaderY);

    this.y = leftHeaderY + 18;
    let leftY = this.y;
    for (const [label, value] of leftRows) {
      this.doc.fillColor(MUTED).font("Helvetica").fontSize(8.5).text(label, MARGIN_X, leftY, { width: colWidth });
      leftY += 11;
      this.doc
        .fillColor("#1A2530")
        .font("Helvetica-Bold")
        .fontSize(9)
        .text(value, MARGIN_X, leftY, { width: colWidth });
      leftY = Math.max(leftY + 13, this.doc.y + 5);
    }

    let rightY = this.y;
    const rightX = MARGIN_X + colWidth + 24;
    for (const [label, value] of rightRows) {
      this.doc.fillColor(MUTED).font("Helvetica").fontSize(8.5).text(label, rightX, rightY, { width: colWidth });
      rightY += 11;
      this.doc
        .fillColor("#1A2530")
        .font("Helvetica-Bold")
        .fontSize(9)
        .text(value, rightX, rightY, { width: colWidth });
      rightY = Math.max(rightY + 13, this.doc.y + 5);
    }

    this.y = Math.max(leftY, rightY) + 4;
  }

  table({ columns, rows, highlightRowIndex, highlightNote }: TableOptions) {
    const headerHeight = 20;
    const rowHeight = 17;
    this.ensureSpace(headerHeight + Math.min(rows.length, 3) * rowHeight);

    let x = MARGIN_X;
    const tableWidth = columns.reduce((sum, c) => sum + c.width, 0);

    // `height` (not just `lineBreak: false`) is required to make pdfkit's
    // `ellipsis` actually truncate to a single line instead of wrapping —
    // pdfkit only engages ellipsis truncation once a bounded `height` forces
    // it to decide a second line won't fit (see LineWrapper.wrap()).
    const cellTextHeight = 10;

    this.doc.rect(MARGIN_X, this.y, tableWidth, headerHeight).fillColor(TEAL).fill();
    this.doc.font("Helvetica-Bold").fontSize(8.5).fillColor(WHITE);
    columns.forEach((col) => {
      this.doc.text(col.header, x + 6, this.y + 6, {
        width: col.width - 10,
        height: cellTextHeight,
        align: col.align ?? "left",
        ellipsis: true,
      });
      x += col.width;
    });
    this.y += headerHeight;

    rows.forEach((row, rowIndex) => {
      this.ensureSpace(rowHeight);
      const isHighlight = rowIndex === highlightRowIndex;
      const bg = isHighlight ? "#E0FBF4" : rowIndex % 2 === 0 ? WHITE : ROW_ALT;
      this.doc.rect(MARGIN_X, this.y, tableWidth, rowHeight).fillColor(bg).fill();

      x = MARGIN_X;
      this.doc.font(isHighlight ? "Helvetica-Bold" : "Helvetica").fontSize(9).fillColor(isHighlight ? TEAL_DARK : "#1A2530");
      row.forEach((cell, colIndex) => {
        const col = columns[colIndex];
        this.doc.text(String(cell), x + 6, this.y + 5, {
          width: col.width - 10,
          height: cellTextHeight,
          align: col.align ?? "left",
          ellipsis: true,
        });
        x += col.width;
      });
      this.y += rowHeight;
    });

    this.doc.moveTo(MARGIN_X, this.y).lineTo(MARGIN_X + tableWidth, this.y).strokeColor(BORDER).lineWidth(1).stroke();
    this.y += 8;

    if (highlightNote) {
      this.note(highlightNote);
    }
  }

  /** Bordered box with a title and a list of label/value rows — executive summary, financial summary. */
  summaryBox(title: string, rows: [string, string][], opts: { tone?: "teal" | "neutral" } = {}) {
    const rowHeight = 16;
    const pad = 14;
    const boxHeight = 30 + rows.length * rowHeight + pad;
    this.ensureSpace(boxHeight + 8);

    const boxY = this.y;
    this.doc
      .roundedRect(MARGIN_X, boxY, CONTENT_WIDTH, boxHeight, 6)
      .fillColor(opts.tone === "teal" ? "#EFFBF7" : ROW_ALT)
      .fill();
    this.doc
      .roundedRect(MARGIN_X, boxY, CONTENT_WIDTH, boxHeight, 6)
      .strokeColor(BORDER)
      .lineWidth(1)
      .stroke();

    this.doc.fillColor(TEAL_DARK).font("Helvetica-Bold").fontSize(10.5).text(title, MARGIN_X + pad, boxY + 12);

    // Rows are single-line by design — pass long descriptive text to
    // heading()/paragraph() instead. `height` forces pdfkit's `ellipsis` to
    // actually truncate rather than wrap (see note in table()).
    let rowY = boxY + 34;
    for (const [label, value] of rows) {
      this.doc
        .fillColor(MUTED)
        .font("Helvetica")
        .fontSize(9)
        .text(label, MARGIN_X + pad, rowY, { width: 260, height: 11, ellipsis: true });
      this.doc
        .fillColor(NAVY)
        .font("Helvetica-Bold")
        .fontSize(9.5)
        .text(value, MARGIN_X + pad + 260, rowY, {
          width: CONTENT_WIDTH - 260 - pad * 2,
          height: 11,
          align: "right",
          ellipsis: true,
        });
      rowY += rowHeight;
    }

    this.y = boxY + boxHeight + 10;
  }

  statBox(label: string, value: string, sublabel: string) {
    this.ensureSpace(70);
    const boxY = this.y;
    this.doc.roundedRect(MARGIN_X, boxY, CONTENT_WIDTH, 60, 6).fillColor("#EFFBF7").fill();
    this.doc.fillColor(TEAL_DARK).font("Helvetica-Bold").fontSize(10).text(label, MARGIN_X + 16, boxY + 10);
    this.doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(22).text(value, MARGIN_X + 16, boxY + 24);
    this.doc.fillColor(MUTED).font("Helvetica").fontSize(8.5).text(sublabel, MARGIN_X + 16, boxY + 48);
    this.y = boxY + 72;
  }

  /** Formula name, labelled inputs, and the resulting value — shown explicitly per the spec's data requirements. */
  formulaBlock(name: string, inputs: [string, string][], resultLabel: string, resultValue: string) {
    const lineHeight = 13;
    const boxHeight = 40 + inputs.length * lineHeight;
    this.ensureSpace(boxHeight + 10);

    const boxY = this.y;
    this.doc.rect(MARGIN_X, boxY, CONTENT_WIDTH, boxHeight).fillColor(ROW_ALT).fill();
    this.doc.rect(MARGIN_X, boxY, 3, boxHeight).fillColor(TEAL).fill();

    this.doc.fillColor(TEAL_DARK).font("Helvetica-Bold").fontSize(9).text(`Formula — ${name}`, MARGIN_X + 16, boxY + 10);

    let lineY = boxY + 26;
    for (const [label, value] of inputs) {
      this.doc
        .fillColor("#1A2530")
        .font("Helvetica")
        .fontSize(8.5)
        .text(`${label} = ${value}`, MARGIN_X + 16, lineY, { width: CONTENT_WIDTH - 32, lineBreak: false });
      lineY += lineHeight;
    }

    this.doc
      .fillColor(NAVY)
      .font("Helvetica-Bold")
      .fontSize(9.5)
      .text(`${resultLabel} = ${resultValue}`, MARGIN_X + 16, lineY + 2, { width: CONTENT_WIDTH - 32 });

    this.y = boxY + boxHeight + 10;
  }

  watermark(text: string) {
    this.doc.save();
    this.doc.rotate(-38, { origin: [PAGE_WIDTH / 2, 421] });
    this.doc.fillColor(DANGER).opacity(0.16);
    this.doc.font("Helvetica-Bold").fontSize(58).text(text, 0, 390, { width: PAGE_WIDTH, align: "center" });
    this.doc.restore();
    this.doc.opacity(1);
  }

  private drawHeaderBand() {
    this.doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(8).text("INTELLOCARBON", MARGIN_X, 34, { lineBreak: false });
    this.doc
      .fillColor(MUTED)
      .font("Helvetica")
      .fontSize(8)
      .text(this.reportReference, MARGIN_X, 34, { width: CONTENT_WIDTH, align: "right", lineBreak: false });
    this.doc.moveTo(MARGIN_X, 50).lineTo(PAGE_RIGHT, 50).strokeColor(TEAL).lineWidth(1.5).stroke();
  }

  private drawFooter(pageNumber: number, total: number) {
    // pdfkit auto-paginates if a text call's computed bottom edge
    // (y + line height) crosses `page.height - margins.bottom` — even with an
    // explicit y and lineBreak:false — so these two lines must stay well clear
    // of that threshold (bottom margin is 20, see PDFDocument construction).
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

  private drawTocTable() {
    this.y = this.tocStartY;
    for (const entry of this.toc) {
      this.ensureSpace(22);
      this.doc
        .fillColor(TEAL_DARK)
        .font("Helvetica-Bold")
        .fontSize(10)
        .text(String(entry.number).padStart(2, "0"), MARGIN_X, this.y, { width: 28, lineBreak: false });
      this.doc
        .fillColor(NAVY)
        .font("Helvetica")
        .fontSize(10)
        .text(entry.title, MARGIN_X + 30, this.y, { width: CONTENT_WIDTH - 80, lineBreak: false });
      this.doc
        .fillColor(MUTED)
        .font("Helvetica-Bold")
        .fontSize(10)
        .text(String(entry.pageIndex + 1), MARGIN_X, this.y, { width: CONTENT_WIDTH, align: "right", lineBreak: false });
      this.y += 15;
      this.doc.moveTo(MARGIN_X, this.y).lineTo(PAGE_RIGHT, this.y).strokeColor(BORDER).lineWidth(0.5).stroke();
      this.y += 12;
    }
  }

  /** Finalize: draw the TOC rows and stamp header/footer/page-numbers on every page now that total page count is known. */
  finalize() {
    const range = this.doc.bufferedPageRange();
    const total = range.count;

    if (this.tocPageIndex >= 0) {
      this.doc.switchToPage(this.tocPageIndex);
      this.drawTocTable();
    }

    for (let i = range.start; i < range.start + range.count; i++) {
      this.doc.switchToPage(i);
      if (i !== this.coverPageIndex) {
        this.drawHeaderBand();
      }
      this.drawFooter(i + 1, total);
    }
  }
}
