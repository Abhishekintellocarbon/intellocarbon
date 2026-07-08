/**
 * Vector chart primitives for the GHG Runner PDF — same pdfkit techniques
 * (polar-sampled donut segments, proportional rounded-rect bars) as
 * cbamReport/charts.ts, but reimplemented against this report's own theme
 * rather than imported directly: that file's `fmt` is en-IN and its
 * palette includes teal, both wrong for this unbranded, en-US deliverable.
 * See the "why separate" note atop ./theme.ts — same reasoning here.
 */
import { NAVY, GREY, GREY_LIGHT, WHITE, MARGIN_X, CONTENT_WIDTH, fmt } from "./theme";

const PAGE_RIGHT = MARGIN_X + CONTENT_WIDTH;

interface LegendItem {
  color: string;
  label: string;
}

function drawLegend(doc: PDFKit.PDFDocument, x: number, y: number, width: number, items: LegendItem[]): number {
  const rowHeight = 14;
  let rowY = y;
  for (const item of items) {
    doc.rect(x, rowY + 2, 8, 8).fillColor(item.color).fill();
    doc
      .fillColor(NAVY)
      .font("Helvetica")
      .fontSize(8)
      .text(item.label, x + 14, rowY, { width: width - 14, lineBreak: false });
    rowY += rowHeight;
  }
  return rowY;
}

const polar = (cx: number, cy: number, r: number, theta: number): [number, number] => [
  cx + r * Math.sin(theta),
  cy - r * Math.cos(theta),
];

function drawDonutSegment(
  doc: PDFKit.PDFDocument,
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startAngle: number,
  endAngle: number,
  color: string,
) {
  const span = endAngle - startAngle;
  if (span <= 0) return;
  const steps = Math.max(1, Math.ceil((span / (Math.PI * 2)) * 90));
  const outerPts: [number, number][] = [];
  const innerPts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = startAngle + (span * i) / steps;
    outerPts.push(polar(cx, cy, outerR, t));
    innerPts.push(polar(cx, cy, innerR, t));
  }
  doc.moveTo(outerPts[0][0], outerPts[0][1]);
  for (const [px, py] of outerPts.slice(1)) doc.lineTo(px, py);
  for (const [px, py] of innerPts.reverse()) doc.lineTo(px, py);
  doc.closePath();
  doc.fillColor(color).fill();
}

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

/** Donut with a centered total and a color-swatch legend (value + % share) to the right. */
export function donutChart(
  doc: PDFKit.PDFDocument,
  opts: { x: number; y: number; diameter: number; segments: DonutSegment[]; unit: string; centerLabel?: string; legendGap?: number },
): number {
  const { x, y, diameter, segments, unit, centerLabel } = opts;
  const total = segments.reduce((sum, seg) => sum + seg.value, 0);
  const outerR = diameter / 2;
  const innerR = outerR * 0.55;
  const cx = x + outerR;
  const cy = y + outerR;

  let angle = 0;
  for (const seg of segments) {
    const sweep = total > 0 ? (seg.value / total) * Math.PI * 2 : 0;
    drawDonutSegment(doc, cx, cy, outerR, innerR, angle, angle + sweep, seg.color);
    angle += sweep;
  }

  if (centerLabel) {
    doc
      .fillColor(GREY)
      .font("Helvetica")
      .fontSize(7)
      .text(centerLabel, x, cy - 17, { width: diameter, align: "center", lineBreak: false });
  }
  doc
    .fillColor(NAVY)
    .font("Helvetica-Bold")
    .fontSize(12)
    .text(fmt(total, 2), x, cy - 6, { width: diameter, align: "center", lineBreak: false });
  doc
    .fillColor(GREY)
    .font("Helvetica")
    .fontSize(7)
    .text(unit, x, cy + 9, { width: diameter, align: "center", lineBreak: false });

  const legendX = x + diameter + (opts.legendGap ?? 20);
  const legendWidth = Math.max(PAGE_RIGHT - legendX, 150);
  const legendItems: LegendItem[] = segments.map((seg) => ({
    color: seg.color,
    label: `${seg.label} — ${fmt(seg.value, 2)} ${unit} (${total > 0 ? fmt((seg.value / total) * 100, 1) : "0.0"}%)`,
  }));
  const legendBottom = drawLegend(doc, legendX, y + (diameter - segments.length * 14) / 2, legendWidth, legendItems);

  return Math.max(y + diameter, legendBottom) + 10;
}

export interface SourceBarDatum {
  label: string;
  value: number;
}

/**
 * One full-width proportional bar per source, label on its own line above
 * the bar. Fuel/source names run long (e.g. "Alternative fuels (RDF / tyre
 * chips / etc.)") so labels get the full content width rather than a fixed
 * side column — only truncated by ellipsis as a last resort.
 */
export function sourceBarChart(
  doc: PDFKit.PDFDocument,
  opts: { x: number; y: number; width: number; data: SourceBarDatum[]; unit: string; color: string },
): number {
  const { x, y, width, data, unit, color } = opts;
  const barHeight = 16;
  const gap = 16;
  const maxVal = Math.max(...data.map((d) => d.value), 0.0001);

  let rowY = y;
  for (const d of data) {
    doc
      .fillColor(NAVY)
      .font("Helvetica-Bold")
      .fontSize(8.5)
      .text(d.label, x, rowY, { width, lineBreak: false, ellipsis: true });
    const barY = rowY + 13;
    doc.roundedRect(x, barY, width, barHeight, 3).fillColor(GREY_LIGHT).fill();
    const barW = Math.max(6, (d.value / maxVal) * width);
    doc.roundedRect(x, barY, barW, barHeight, 3).fillColor(color).fill();
    doc
      .fillColor(barW > 90 ? WHITE : NAVY)
      .font("Helvetica-Bold")
      .fontSize(8)
      .text(`${fmt(d.value, 2)} ${unit}`, x + 8, barY + 4, { lineBreak: false });
    rowY = barY + barHeight + gap;
  }

  return rowY - gap + 6;
}
