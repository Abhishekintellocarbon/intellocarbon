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
  PAGE_HEIGHT,
  COVER_GRADIENT_FROM,
  COVER_GRADIENT_TO,
  STATUS_COLORS,
  type StatusTone,
} from "./theme";

const PAGE_RIGHT = MARGIN_X + CONTENT_WIDTH;
const FOOTER_NOTE = "Intellocarbon Solutions Private Limited  |  intellocarbon.com  |  Confidential";
const COVER_BAND_HEIGHT = 340;

/** Small rounded label chip — used for status/tone indicators and reference/doc-id badges. */
export function drawPill(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  opts: {
    bg: string;
    color: string;
    fontSize?: number;
    bold?: boolean;
    paddingX?: number;
    paddingY?: number;
    align?: "left" | "right";
  },
): number {
  const fontSize = opts.fontSize ?? 8;
  const paddingX = opts.paddingX ?? 8;
  const paddingY = opts.paddingY ?? 4;
  doc.font(opts.bold === false ? "Helvetica" : "Helvetica-Bold").fontSize(fontSize);
  const textWidth = doc.widthOfString(text);
  const width = textWidth + paddingX * 2;
  const height = fontSize + paddingY * 2;
  const drawX = opts.align === "right" ? x - width : x;
  doc.roundedRect(drawX, y, width, height, height / 2).fillColor(opts.bg).fill();
  doc
    .fillColor(opts.color)
    .font(opts.bold === false ? "Helvetica" : "Helvetica-Bold")
    .fontSize(fontSize)
    .text(text, drawX + paddingX, y + paddingY + 0.5, { lineBreak: false });
  return width;
}

/**
 * Small vector up/down/flat marker drawn as a filled triangle (or dot for
 * "pending") centred at (cx, cy) — standard PDF fonts only cover WinAnsi, so
 * unicode arrow glyphs (▲▼●) render as garbage and must be drawn as shapes.
 */
function drawTrendMarker(doc: PDFKit.PDFDocument, tone: StatusTone, cx: number, cy: number, color: string) {
  const r = 4.5;
  doc.fillColor(color);
  if (tone === "amber") {
    doc.circle(cx, cy, r * 0.7).fill();
  } else if (tone === "red") {
    doc
      .polygon([cx - r, cy + r * 0.6], [cx + r, cy + r * 0.6], [cx, cy - r * 0.8])
      .fill();
  } else {
    doc
      .polygon([cx - r, cy - r * 0.6], [cx + r, cy - r * 0.6], [cx, cy + r * 0.8])
      .fill();
  }
}

export interface CoverShellOptions {
  logoPath: string;
  logoWidth?: number;
  eyebrow: string;
  title: string;
  subtitle: string;
  heroLabel: string;
  heroValue: string;
  heroDelta?: { text: string; tone: StatusTone };
  referenceBadge: string;
  controlTitle: string;
  controlRows: [string, string][];
  qrPngBuffer: Buffer;
  qrCaption: string;
  qrUrl: string;
  docIdBadge: string;
  confidentialityText: string;
}

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
  private logoPath: string;

  constructor(doc: PDFKit.PDFDocument, reportReference: string, logoPath: string) {
    this.doc = doc;
    this.reportReference = reportReference;
    this.logoPath = logoPath;
  }

  private currentPageIndex() {
    return this.doc.bufferedPageRange().count - 1;
  }

  /** Call once, immediately, for the auto-created first page (the cover). */
  startCover() {
    this.coverPageIndex = this.currentPageIndex();
    this.y = 0;
  }

  /**
   * Full premium cover treatment shared by both reports: gradient hero band with
   * headline stat, document control panel + verification QR beneath it, and a
   * confidentiality strip at the foot of the page. Keeping this in one place is
   * what guarantees the two report covers are pixel-consistent with each other.
   */
  coverShell(opts: CoverShellOptions) {
    const doc = this.doc;
    this.startCover();

    const gradient = doc.linearGradient(0, 0, PAGE_WIDTH, COVER_BAND_HEIGHT);
    gradient.stop(0, COVER_GRADIENT_FROM).stop(1, COVER_GRADIENT_TO);
    doc.rect(0, 0, PAGE_WIDTH, COVER_BAND_HEIGHT).fill(gradient);

    const logoWidth = opts.logoWidth ?? 168;
    doc.image(opts.logoPath, MARGIN_X, 40, { width: logoWidth });

    drawPill(doc, opts.referenceBadge, PAGE_RIGHT, 44, {
      bg: "#0A1A22",
      color: WHITE,
      fontSize: 8,
      align: "right",
    });

    doc
      .fillColor("#9FEAD8")
      .font("Helvetica-Bold")
      .fontSize(9)
      .text(opts.eyebrow.toUpperCase(), MARGIN_X, 96, { characterSpacing: 1.2 });

    doc.fillColor(WHITE).font("Helvetica-Bold").fontSize(27).text(opts.title, MARGIN_X, 112, { width: CONTENT_WIDTH });
    const titleBottom = doc.y;
    doc
      .fillColor("#CFEFE6")
      .font("Helvetica")
      .fontSize(11)
      .text(opts.subtitle, MARGIN_X, titleBottom + 6, { width: CONTENT_WIDTH });

    doc
      .moveTo(MARGIN_X, doc.y + 16)
      .lineTo(MARGIN_X + 90, doc.y + 16)
      .strokeColor(TEAL)
      .lineWidth(2)
      .stroke();

    const heroY = doc.y + 34;
    doc
      .fillColor("#9FEAD8")
      .font("Helvetica-Bold")
      .fontSize(9.5)
      .text(opts.heroLabel.toUpperCase(), MARGIN_X, heroY, { characterSpacing: 1 });
    doc.fillColor(WHITE).font("Helvetica-Bold").fontSize(38).text(opts.heroValue, MARGIN_X, heroY + 15, {
      width: CONTENT_WIDTH,
    });

    if (opts.heroDelta) {
      const tone = STATUS_COLORS[opts.heroDelta.tone];
      const chipY = heroY + 62;
      drawTrendMarker(doc, opts.heroDelta.tone, MARGIN_X + 5, chipY + 11, tone.fg);
      drawPill(doc, opts.heroDelta.text, MARGIN_X + 22, chipY, {
        bg: tone.bg,
        color: tone.fg,
        fontSize: 9,
        paddingX: 10,
        paddingY: 5,
      });
    }

    const panelY = COVER_BAND_HEIGHT + 34;
    const controlWidth = 290;
    const gap = 25;
    const qrWidth = CONTENT_WIDTH - controlWidth - gap;
    const qrX = MARGIN_X + controlWidth + gap;
    const panelHeaderHeight = 24;
    const rowHeight = 26;
    const panelHeight = panelHeaderHeight + opts.controlRows.length * rowHeight + 12;

    // Document control panel
    doc.roundedRect(MARGIN_X, panelY, controlWidth, panelHeight, 6).strokeColor(BORDER).lineWidth(1).stroke();
    doc.rect(MARGIN_X, panelY, controlWidth, panelHeaderHeight).fillColor(NAVY).fill();
    doc
      .fillColor(WHITE)
      .font("Helvetica-Bold")
      .fontSize(8.5)
      .text(opts.controlTitle.toUpperCase(), MARGIN_X + 14, panelY + 7, { characterSpacing: 0.8 });

    let rowY = panelY + panelHeaderHeight + 7;
    for (const [label, value] of opts.controlRows) {
      doc
        .fillColor(MUTED)
        .font("Helvetica")
        .fontSize(7.5)
        .text(label.toUpperCase(), MARGIN_X + 14, rowY, { width: controlWidth - 28, characterSpacing: 0.3 });
      doc
        .fillColor(NAVY)
        .font("Helvetica-Bold")
        .fontSize(9)
        .text(value, MARGIN_X + 14, rowY + 10, { width: controlWidth - 28, height: 12, ellipsis: true });
      rowY += rowHeight;
    }

    // Verification QR card
    doc.roundedRect(qrX, panelY, qrWidth, panelHeight, 6).strokeColor(BORDER).lineWidth(1).stroke();
    const qrSize = Math.min(qrWidth - 30, 96);
    const qrImgX = qrX + (qrWidth - qrSize) / 2;
    doc.image(opts.qrPngBuffer, qrImgX, panelY + 14, { width: qrSize, height: qrSize });
    doc
      .fillColor(NAVY)
      .font("Helvetica-Bold")
      .fontSize(8)
      .text(opts.qrCaption, qrX, panelY + 14 + qrSize + 8, { width: qrWidth, align: "center" });
    doc
      .fillColor(MUTED)
      .font("Helvetica")
      .fontSize(6.5)
      .text(opts.qrUrl, qrX + 8, panelY + 14 + qrSize + 20, { width: qrWidth - 16, align: "center" });

    // Confidentiality strip
    const footY = PAGE_HEIGHT - 90;
    doc.moveTo(MARGIN_X, footY).lineTo(PAGE_RIGHT, footY).strokeColor(BORDER).lineWidth(1).stroke();
    doc
      .fillColor(MUTED)
      .font("Helvetica-Oblique")
      .fontSize(7.5)
      .text(opts.confidentialityText, MARGIN_X, footY + 12, { width: CONTENT_WIDTH, align: "center" });
    const badgeWidth = doc.font("Helvetica-Bold").fontSize(8).widthOfString(opts.docIdBadge) + 20;
    drawPill(doc, opts.docIdBadge, MARGIN_X + (CONTENT_WIDTH - badgeWidth) / 2, footY + 34, {
      bg: ROW_ALT,
      color: NAVY,
      fontSize: 8,
      paddingX: 10,
      paddingY: 5,
    });
  }

  /** Inline status chip — favourable/pending/unfavourable, used inline within body copy. */
  statusBadge(text: string, tone: StatusTone, x: number, y: number) {
    const colors = STATUS_COLORS[tone];
    return drawPill(this.doc, text, x, y, { bg: colors.bg, color: colors.fg, fontSize: 8.5, paddingX: 9, paddingY: 4 });
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
      const baseFont = isHighlight ? "Helvetica-Bold" : "Helvetica";
      const baseColor = isHighlight ? TEAL_DARK : "#1A2530";
      row.forEach((cell, colIndex) => {
        const col = columns[colIndex];
        // Trailing `^n` on a cell renders as a small superscript citation
        // badge linking to the numbered methodology reference — a rigour
        // signal next to the raw emission-factor value rather than only in a
        // separate source column.
        const raw = String(cell);
        const citation = raw.match(/\^(\d+)$/);
        const text = citation ? raw.slice(0, citation.index) : raw;

        this.doc.font(baseFont).fontSize(9).fillColor(baseColor);
        this.doc.text(text, x + 6, this.y + 5, {
          width: col.width - (citation ? 16 : 10),
          height: cellTextHeight,
          align: col.align ?? "left",
          ellipsis: true,
        });

        if (citation) {
          const textWidth = this.doc.font(baseFont).fontSize(9).widthOfString(text);
          const badgeX =
            col.align === "right" ? x + col.width - 8 - this.doc.widthOfString(citation[1]) : x + 8 + textWidth;
          this.doc.font("Helvetica-Bold").fontSize(6.5).fillColor(TEAL_DARK).text(citation[1], badgeX, this.y + 4, {
            lineBreak: false,
          });
        }

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
    this.doc.image(this.logoPath, MARGIN_X, 26, { width: 78 });
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
