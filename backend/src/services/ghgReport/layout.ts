import { NAVY, NAVY_LIGHT, GREY, GREY_LIGHT, BORDER, ROW_ALT, WHITE, MARGIN_X, CONTENT_WIDTH, TOP_Y, PAGE_WIDTH } from "./theme";

const PAGE_RIGHT = MARGIN_X + CONTENT_WIDTH;
const FOOTER_NOTE = "Confidential — prepared for the addressed organization only";

export interface TableColumn {
  header: string;
  width: number;
  align?: "left" | "right";
}

export interface TableOptions {
  columns: TableColumn[];
  rows: (string | number)[][];
  highlightRowIndex?: number;
}

export interface BarChartItem {
  label: string;
  value: number;
  color: string;
}

/**
 * Leaner sibling of cbamReport/layout.ts's PageBuilder — same pdfkit
 * techniques (rect/roundedRect fills, alternating table rows, a running `y`
 * cursor, section headers, a footer pass once total page count is known)
 * but with no logo, no QR/verification panel, no teal, and no per-report
 * reference-number badge system — none of that fits an unbranded
 * consulting deliverable.
 */
export class GhgPageBuilder {
  doc: PDFKit.PDFDocument;
  y = TOP_Y;

  constructor(doc: PDFKit.PDFDocument) {
    this.doc = doc;
  }

  /**
   * Cover page — organization name, reporting period, and the report title,
   * on a plain navy band. No logo, no gradient, no QR code.
   */
  coverPage(opts: {
    title: string;
    organizationName: string;
    periodLabel: string;
    jurisdictionLabel: string;
    regulationLabel: string;
    preparedDate: string;
  }) {
    const doc = this.doc;

    const bandHeight = 260;
    doc.rect(0, 0, PAGE_WIDTH, bandHeight).fillColor(NAVY).fill();

    doc
      .fillColor(GREY_LIGHT)
      .font("Helvetica-Bold")
      .fontSize(9)
      .text("GREENHOUSE GAS EMISSIONS INVENTORY", MARGIN_X, 70, { characterSpacing: 1.2 });
    doc.fillColor(WHITE).font("Helvetica-Bold").fontSize(24).text(opts.title, MARGIN_X, 90, { width: CONTENT_WIDTH });
    doc
      .fillColor(GREY_LIGHT)
      .font("Helvetica")
      .fontSize(11)
      .text("Scope 1 and Scope 2", MARGIN_X, doc.y + 4, { width: CONTENT_WIDTH });

    doc
      .moveTo(MARGIN_X, doc.y + 18)
      .lineTo(MARGIN_X + 90, doc.y + 18)
      .strokeColor(GREY_LIGHT)
      .lineWidth(1.5)
      .stroke();

    const orgY = doc.y + 36;
    doc.fillColor(GREY_LIGHT).font("Helvetica-Bold").fontSize(9).text("PREPARED FOR", MARGIN_X, orgY, { characterSpacing: 1 });
    doc.fillColor(WHITE).font("Helvetica-Bold").fontSize(20).text(opts.organizationName, MARGIN_X, orgY + 14, { width: CONTENT_WIDTH });

    const detailY = bandHeight + 40;
    const rows: [string, string][] = [
      ["Reporting period", opts.periodLabel],
      ["Jurisdiction / reporting standard", `${opts.jurisdictionLabel} — ${opts.regulationLabel}`],
      ["Report prepared", opts.preparedDate],
    ];
    let rowY = detailY;
    for (const [label, value] of rows) {
      doc.fillColor(GREY).font("Helvetica").fontSize(9).text(label.toUpperCase(), MARGIN_X, rowY, { characterSpacing: 0.5 });
      rowY += 13;
      doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(11).text(value, MARGIN_X, rowY, { width: CONTENT_WIDTH });
      rowY = doc.y + 16;
    }

    doc.moveTo(MARGIN_X, rowY).lineTo(PAGE_RIGHT, rowY).strokeColor(BORDER).lineWidth(1).stroke();
    doc
      .fillColor(GREY)
      .font("Helvetica-Oblique")
      .fontSize(8)
      .text(
        "This document is confidential and prepared solely for the addressed organization based on data it supplied. See the Disclaimers and Assumptions section before relying on these figures.",
        MARGIN_X,
        rowY + 12,
        { width: CONTENT_WIDTH },
      );
  }

  startSection(number: number, title: string) {
    this.doc.addPage();
    this.y = TOP_Y;
    this.sectionHeader(number, title);
  }

  ensureSpace(needed: number) {
    if (this.y + needed > this.doc.page.height - 60) {
      this.doc.addPage();
      this.y = TOP_Y;
    }
  }

  sectionHeader(number: number, title: string) {
    this.doc
      .fillColor(GREY)
      .font("Helvetica-Bold")
      .fontSize(9)
      .text(`SECTION ${String(number).padStart(2, "0")}`, MARGIN_X, this.y, { characterSpacing: 1 });
    this.y += 14;
    this.doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(14).text(title, MARGIN_X, this.y);
    this.y += 20;
    this.doc.moveTo(MARGIN_X, this.y).lineTo(PAGE_RIGHT, this.y).strokeColor(NAVY_LIGHT).lineWidth(1.5).stroke();
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

  note(text: string) {
    this.ensureSpace(14);
    this.doc.fillColor(GREY).font("Helvetica").fontSize(7.5).text(text, MARGIN_X, this.y, { width: CONTENT_WIDTH });
    this.y = this.doc.y + 6;
  }

  keyValueRow(label: string, value: string) {
    this.ensureSpace(16);
    this.doc.fillColor(GREY).font("Helvetica").fontSize(9).text(label, MARGIN_X, this.y, { width: CONTENT_WIDTH, lineBreak: false });
    this.y += 12;
    this.doc.fillColor("#1A2530").font("Helvetica-Bold").fontSize(9.5).text(value, MARGIN_X, this.y, { width: CONTENT_WIDTH });
    this.y = Math.max(this.y + 14, this.doc.y + 6);
  }

  table({ columns, rows, highlightRowIndex }: TableOptions) {
    const headerHeight = 20;
    const rowHeight = 17;
    this.ensureSpace(headerHeight + Math.min(rows.length, 3) * rowHeight);

    let x = MARGIN_X;
    const tableWidth = columns.reduce((sum, c) => sum + c.width, 0);
    const cellTextHeight = 10;

    this.doc.rect(MARGIN_X, this.y, tableWidth, headerHeight).fillColor(NAVY).fill();
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
      const bg = isHighlight ? ROW_ALT : rowIndex % 2 === 0 ? WHITE : ROW_ALT;
      this.doc.rect(MARGIN_X, this.y, tableWidth, rowHeight).fillColor(bg).fill();

      x = MARGIN_X;
      const baseFont = isHighlight ? "Helvetica-Bold" : "Helvetica";
      const baseColor = isHighlight ? NAVY : "#1A2530";
      row.forEach((cell, colIndex) => {
        const col = columns[colIndex];
        this.doc.font(baseFont).fontSize(9).fillColor(baseColor);
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
  }

  summaryBox(title: string, rows: [string, string][]) {
    const rowHeight = 16;
    const pad = 14;
    const boxHeight = 30 + rows.length * rowHeight + pad;
    this.ensureSpace(boxHeight + 8);

    const boxY = this.y;
    this.doc.roundedRect(MARGIN_X, boxY, CONTENT_WIDTH, boxHeight, 6).fillColor(ROW_ALT).fill();
    this.doc.roundedRect(MARGIN_X, boxY, CONTENT_WIDTH, boxHeight, 6).strokeColor(BORDER).lineWidth(1).stroke();
    this.doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(10.5).text(title, MARGIN_X + pad, boxY + 12);

    let rowY = boxY + 34;
    for (const [label, value] of rows) {
      this.doc.fillColor(GREY).font("Helvetica").fontSize(9).text(label, MARGIN_X + pad, rowY, { width: 260, height: 11, ellipsis: true });
      this.doc
        .fillColor(NAVY)
        .font("Helvetica-Bold")
        .fontSize(9.5)
        .text(value, MARGIN_X + pad + 260, rowY, { width: CONTENT_WIDTH - 260 - pad * 2, height: 11, align: "right", ellipsis: true });
      rowY += rowHeight;
    }

    this.y = boxY + boxHeight + 10;
  }

  /** Simple horizontal bar chart — Scope 1 / Scope 2 / Total, proportional bars only, no external chart library. */
  simpleBarChart(items: BarChartItem[], unit: string) {
    const maxValue = Math.max(...items.map((i) => i.value), 1);
    const barHeight = 20;
    const gap = 14;
    const labelWidth = 110;
    const valueWidth = 100;
    const barAreaWidth = CONTENT_WIDTH - labelWidth - valueWidth;
    this.ensureSpace(items.length * (barHeight + gap) + 10);

    for (const item of items) {
      const barWidth = Math.max(2, (item.value / maxValue) * barAreaWidth);
      this.doc
        .fillColor(NAVY)
        .font("Helvetica-Bold")
        .fontSize(9)
        .text(item.label, MARGIN_X, this.y + barHeight / 2 - 5, { width: labelWidth - 8 });
      this.doc.rect(MARGIN_X + labelWidth, this.y, barAreaWidth, barHeight).fillColor(GREY_LIGHT).fill();
      this.doc.rect(MARGIN_X + labelWidth, this.y, barWidth, barHeight).fillColor(item.color).fill();
      this.doc
        .fillColor(NAVY)
        .font("Helvetica-Bold")
        .fontSize(9.5)
        .text(`${item.value.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${unit}`, MARGIN_X + labelWidth + barAreaWidth + 8, this.y + barHeight / 2 - 5, {
          width: valueWidth - 8,
        });
      this.y += barHeight + gap;
    }
  }

  /** A label with a blank underscored line beside it — for the consultant to fill in by hand or in a text editor before sending. */
  filledLine(label: string) {
    this.ensureSpace(24);
    this.doc.fillColor(GREY).font("Helvetica").fontSize(9).text(label, MARGIN_X, this.y, { width: 130, lineBreak: false });
    const lineY = this.y + 12;
    this.doc.moveTo(MARGIN_X + 130, lineY).lineTo(PAGE_RIGHT, lineY).strokeColor(BORDER).lineWidth(1).stroke();
    this.y = lineY + 12;
  }

  private drawFooter(pageNumber: number, total: number) {
    const height = this.doc.page.height;
    this.doc
      .fillColor(GREY)
      .font("Helvetica")
      .fontSize(7.5)
      .text(FOOTER_NOTE, MARGIN_X, height - 40, { width: CONTENT_WIDTH, align: "center", lineBreak: false });
    this.doc
      .fillColor(GREY)
      .font("Helvetica")
      .fontSize(7.5)
      .text(`Page ${pageNumber} of ${total}`, MARGIN_X, height - 28, { width: CONTENT_WIDTH, align: "center", lineBreak: false });
  }

  /** Stamp the footer on every page (including the cover) now that total page count is known. */
  finalize() {
    const range = this.doc.bufferedPageRange();
    const total = range.count;
    for (let i = range.start; i < range.start + range.count; i++) {
      this.doc.switchToPage(i);
      this.drawFooter(i + 1, total);
    }
  }
}
