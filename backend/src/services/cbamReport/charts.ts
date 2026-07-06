/**
 * Shared vector chart primitives for the CBAM / CCTS / BRSR PDF reports.
 * Pure pdfkit path/rect drawing — no external chart library, no images.
 * Every function takes already-computed numbers from the caller (never
 * hardcodes a value) and returns the y-coordinate immediately below
 * whatever it drew, so callers can chain `pb.y = someChart(...)`.
 *
 * PDFKit has no center/angle arc primitive, so donut segments are built by
 * sampling points along the arc (polar coordinates, 0 = 12 o'clock,
 * increasing clockwise) and filling the resulting annular-sector polygon.
 */
import { TEAL, TEAL_DARK, NAVY, MUTED, BORDER, ROW_ALT, WHITE, fmt } from "./theme";

export const CHART_BLUE = "#4A9EFF";
export const CHART_AMBER = "#F5A623";
export const CHART_RED = "#FF6B6B";
export const CHART_SECONDARY_TEXT = "#8AA0B4";
export const CHART_SLATE = "#5B6B7A";
export const CHART_TEAL_BG = "#E0FBF4";
export const CHART_RED_BG = "#FBEAEA";

interface LegendItem {
  color: string;
  label: string;
}

/** Small color-swatch + label list — the auditability legend required under every chart. */
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

/** Donut chart with a centered total and a color-swatch legend to the right. Segment order determines draw order, clockwise from 12 o'clock. */
export function donutChart(
  doc: PDFKit.PDFDocument,
  opts: {
    x: number;
    y: number;
    diameter: number;
    segments: DonutSegment[];
    unit: string;
    centerLabel?: string;
    legendGap?: number;
  },
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
      .fillColor(MUTED)
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
    .fillColor(MUTED)
    .font("Helvetica")
    .fontSize(7)
    .text(unit, x, cy + 9, { width: diameter, align: "center", lineBreak: false });

  const legendX = x + diameter + (opts.legendGap ?? 20);
  const legendWidth = 495 - (legendX - 50); // CONTENT_WIDTH-relative fallback width; callers keep legend within their own column budget
  const legendItems: LegendItem[] = segments.map((seg) => ({
    color: seg.color,
    label: `${seg.label} — ${fmt(seg.value, 2)} ${unit} (${total > 0 ? fmt((seg.value / total) * 100, 1) : "0.0"}%)`,
  }));
  const legendBottom = drawLegend(doc, legendX, y + (diameter - segments.length * 14) / 2, Math.max(legendWidth, 150), legendItems);

  return Math.max(y + diameter, legendBottom) + 10;
}

/** Horizontal actual-vs-reference comparison bar with a marker line for the reference value and a variance callout. */
export function horizontalBarComparison(
  doc: PDFKit.PDFDocument,
  opts: {
    x: number;
    y: number;
    width: number;
    actualValue: number;
    actualLabel: string;
    referenceValue: number;
    referenceLabel: string;
    unit: string;
    /** Lower is better (e.g. emissions intensity vs a default). Defaults to true. */
    lowerIsBetter?: boolean;
  },
): number {
  const { x, y, width, actualValue, actualLabel, referenceValue, referenceLabel, unit } = opts;
  const lowerIsBetter = opts.lowerIsBetter ?? true;
  const barHeight = 24;
  const maxScale = Math.max(actualValue, referenceValue, 0.0001) * 1.25;
  const trackY = y + 14;

  doc
    .fillColor(MUTED)
    .font("Helvetica-Bold")
    .fontSize(8)
    .text(`${actualLabel.toUpperCase()} VS ${referenceLabel.toUpperCase()}`, x, y, { characterSpacing: 0.4 });

  doc.roundedRect(x, trackY, width, barHeight, 4).fillColor(ROW_ALT).fill();

  const isBetter = lowerIsBetter ? actualValue <= referenceValue : actualValue >= referenceValue;
  const barColor = isBetter ? TEAL : CHART_RED;
  const actualWidth = Math.max(6, Math.min(width, (actualValue / maxScale) * width));
  doc.roundedRect(x, trackY, actualWidth, barHeight, 4).fillColor(barColor).fill();
  doc
    .fillColor(actualWidth > 70 ? WHITE : NAVY)
    .font("Helvetica-Bold")
    .fontSize(9.5)
    .text(`${fmt(actualValue)} ${unit}`, x + 10, trackY + 7, { lineBreak: false });

  const markerX = x + (referenceValue / maxScale) * width;
  doc.moveTo(markerX, trackY - 5).lineTo(markerX, trackY + barHeight + 5).strokeColor(CHART_AMBER).lineWidth(2).stroke();

  const variance = referenceValue - actualValue;
  const varianceLabel = `Variance: ${variance >= 0 ? "+" : ""}${fmt(variance)} ${unit} (${isBetter ? "better than" : "above"} ${referenceLabel})`;

  const legendY = trackY + barHeight + 14;
  const legendBottom = drawLegend(doc, x, legendY, width, [
    { color: barColor, label: `${actualLabel}: ${fmt(actualValue)} ${unit}` },
    { color: CHART_AMBER, label: `${referenceLabel}: ${fmt(referenceValue)} ${unit}` },
  ]);
  doc
    .fillColor(isBetter ? TEAL_DARK : CHART_RED)
    .font("Helvetica-Bold")
    .fontSize(8.5)
    .text(varianceLabel, x, legendBottom + 2, { width });

  return legendBottom + 2 + 14;
}

export interface BarDatum {
  label: string;
  value: number;
  color?: string;
}

/** Reserved above the tallest possible bar so its value label never collides with whatever precedes the chart. */
const BAR_LABEL_MARGIN = 20;

/** Vertical bar chart — one bar per datum, value label on top, category label below. */
export function verticalBarChart(
  doc: PDFKit.PDFDocument,
  opts: { x: number; y: number; width: number; height: number; data: BarDatum[]; unit: string; defaultColor?: string },
): number {
  const { x, y, width, height, data, unit, defaultColor = TEAL } = opts;
  const maxVal = Math.max(...data.map((d) => d.value), 0.0001);
  const gap = 14;
  const barWidth = Math.max(8, (width - gap * (data.length - 1)) / data.length);
  const baseline = y + height;
  const usableHeight = height - BAR_LABEL_MARGIN;

  data.forEach((d, i) => {
    const barX = x + i * (barWidth + gap);
    const barH = Math.max(2, (d.value / maxVal) * usableHeight);
    const barY = baseline - barH;
    doc.rect(barX, barY, barWidth, barH).fillColor(d.color ?? defaultColor).fill();
    doc
      .fillColor(NAVY)
      .font("Helvetica-Bold")
      .fontSize(8)
      .text(fmt(d.value, 2), barX - 8, barY - 12, { width: barWidth + 16, align: "center", lineBreak: false });
    doc
      .fillColor(MUTED)
      .font("Helvetica")
      .fontSize(7.5)
      .text(d.label, barX - 8, baseline + 6, { width: barWidth + 16, align: "center" });
  });

  doc.moveTo(x, baseline).lineTo(x + width, baseline).strokeColor(BORDER).lineWidth(1).stroke();

  const legendBottom = drawLegend(
    doc,
    x,
    baseline + 34,
    width,
    data.map((d) => ({ color: d.color ?? defaultColor, label: `${d.label}: ${fmt(d.value, 2)} ${unit}` })),
  );

  return legendBottom + 6;
}

/** Three-bar waterfall — gross (from 0), a floating deduction bar, and net (from 0). Purpose-built for the CBAM liability walk. */
export function waterfallChart(
  doc: PDFKit.PDFDocument,
  opts: {
    x: number;
    y: number;
    width: number;
    height: number;
    grossLabel: string;
    grossValue: number;
    deductionLabel: string;
    deductionValue: number;
    netLabel: string;
    netValue: number;
    formatValue: (n: number) => string;
  },
): number {
  const { x, y, width, height, grossLabel, grossValue, deductionLabel, deductionValue, netLabel, netValue, formatValue } = opts;
  const maxVal = Math.max(grossValue, netValue, 0.0001);
  const barGap = 28;
  const barWidth = (width - barGap * 2) / 3;
  const baseline = y + height;
  const usableHeight = height - BAR_LABEL_MARGIN;
  const scale = (v: number) => Math.max(2, (v / maxVal) * usableHeight);

  const labelBar = (barX: number, barTop: number, label: string, valueLabel: string) => {
    doc
      .fillColor(NAVY)
      .font("Helvetica-Bold")
      .fontSize(9)
      .text(valueLabel, barX - 12, barTop - 14, { width: barWidth + 24, align: "center", lineBreak: false });
    doc
      .fillColor(MUTED)
      .font("Helvetica")
      .fontSize(7.5)
      .text(label, barX - 12, baseline + 6, { width: barWidth + 24, align: "center" });
  };

  // Gross — full bar from baseline
  const grossX = x;
  const grossH = scale(grossValue);
  doc.rect(grossX, baseline - grossH, barWidth, grossH).fillColor(CHART_BLUE).fill();
  labelBar(grossX, baseline - grossH, grossLabel, formatValue(grossValue));

  // Deduction — floating bar between net and gross
  const deductionX = grossX + barWidth + barGap;
  const floatTop = baseline - scale(grossValue);
  const floatBottom = baseline - scale(netValue);
  doc.rect(deductionX, floatTop, barWidth, Math.max(2, floatBottom - floatTop)).fillColor(TEAL).fill();
  labelBar(deductionX, floatTop, deductionLabel, `- ${formatValue(deductionValue)}`);

  // Net — full bar from baseline, dark fill with teal border
  const netX = deductionX + barWidth + barGap;
  const netH = scale(netValue);
  doc.rect(netX, baseline - netH, barWidth, netH).fillColor(NAVY).fill();
  doc.rect(netX, baseline - netH, barWidth, netH).strokeColor(TEAL).lineWidth(1.5).stroke();
  labelBar(netX, baseline - netH, netLabel, formatValue(netValue));

  doc.moveTo(x, baseline).lineTo(x + width, baseline).strokeColor(BORDER).lineWidth(1).stroke();

  const legendBottom = drawLegend(doc, x, baseline + 24, width, [
    { color: CHART_BLUE, label: `${grossLabel}: ${formatValue(grossValue)}` },
    { color: TEAL, label: `${deductionLabel}: ${formatValue(deductionValue)}` },
    { color: NAVY, label: `${netLabel}: ${formatValue(netValue)}` },
  ]);

  return legendBottom + 6;
}

/** Actual-vs-target gauge with shaded surplus/deficit zones either side of the target marker. */
export function gaugeBar(
  doc: PDFKit.PDFDocument,
  opts: {
    x: number;
    y: number;
    width: number;
    unit: string;
    pending?: boolean;
    actualValue?: number;
    targetValue?: number;
  },
): number {
  const { x, y, width, unit } = opts;
  const barHeight = 22;

  if (opts.pending || opts.actualValue == null || opts.targetValue == null) {
    doc.roundedRect(x, y, width, barHeight, 4).fillColor(ROW_ALT).fill();
    doc.roundedRect(x, y, width * 0.55, barHeight, 4).fillColor(BORDER).fill();
    doc
      .fillColor(NAVY)
      .font("Helvetica-Bold")
      .fontSize(9.5)
      .text(`${fmt(opts.actualValue ?? 0)} ${unit}`, x + 10, y + 6, { lineBreak: false });
    doc
      .fillColor(CHART_AMBER)
      .font("Helvetica-Bold")
      .fontSize(7.5)
      .text("TARGET PENDING BEE NOTIFICATION", x + width, y - 2, { width: 200, align: "right", lineBreak: false });
    return y + barHeight + 20;
  }

  const { actualValue, targetValue } = opts;
  const maxScale = Math.max(actualValue, targetValue, 0.0001) * 1.3;
  const targetX = x + (targetValue / maxScale) * width;

  // Surplus zone (below target — favourable for an intensity metric) / deficit zone (above target)
  doc.rect(x, y, targetX - x, barHeight).fillColor(CHART_TEAL_BG).fill();
  doc.rect(targetX, y, x + width - targetX, barHeight).fillColor(CHART_RED_BG).fill();

  const isSurplus = actualValue <= targetValue;
  const actualWidth = Math.max(4, (actualValue / maxScale) * width);
  doc.rect(x, y, actualWidth, barHeight).fillColor(isSurplus ? TEAL : CHART_RED).fill();

  doc.moveTo(targetX, y - 5).lineTo(targetX, y + barHeight + 5).strokeColor(CHART_AMBER).lineWidth(2).stroke();

  doc
    .fillColor(actualWidth > 70 ? WHITE : NAVY)
    .font("Helvetica-Bold")
    .fontSize(9)
    .text(`${fmt(actualValue)} ${unit}`, x + 8, y + 6, { lineBreak: false });

  const legendBottom = drawLegend(doc, x, y + barHeight + 14, width, [
    { color: isSurplus ? TEAL : CHART_RED, label: `Actual: ${fmt(actualValue)} ${unit}` },
    { color: CHART_AMBER, label: `Notified target: ${fmt(targetValue)} ${unit}` },
    { color: CHART_TEAL_BG, label: "Surplus zone (below target)" },
    { color: CHART_RED_BG, label: "Deficit zone (above target)" },
  ]);

  return legendBottom + 6;
}

export interface GroupedBarDatum {
  label: string;
  value: number;
  unit: string;
  color: string;
}

/** Grouped horizontal bars sharing one scale — e.g. water withdrawn / discharged / consumed. */
export function horizontalGroupedBars(
  doc: PDFKit.PDFDocument,
  opts: { x: number; y: number; width: number; data: GroupedBarDatum[]; barHeight?: number; gap?: number },
): number {
  const { x, y, width, data } = opts;
  const barHeight = opts.barHeight ?? 20;
  const gap = opts.gap ?? 12;
  const maxVal = Math.max(...data.map((d) => d.value), 0.0001) * 1.15;
  const labelWidth = 130;
  const barAreaWidth = width - labelWidth;

  let rowY = y;
  for (const d of data) {
    doc
      .fillColor(NAVY)
      .font("Helvetica")
      .fontSize(8.5)
      .text(d.label, x, rowY + barHeight / 2 - 5, { width: labelWidth - 8, lineBreak: false });

    doc.roundedRect(x + labelWidth, rowY, barAreaWidth, barHeight, 3).fillColor(ROW_ALT).fill();
    const barW = Math.max(6, (d.value / maxVal) * barAreaWidth);
    doc.roundedRect(x + labelWidth, rowY, barW, barHeight, 3).fillColor(d.color).fill();
    doc
      .fillColor(barW > 60 ? WHITE : NAVY)
      .font("Helvetica-Bold")
      .fontSize(8.5)
      .text(`${fmt(d.value, 2)} ${d.unit}`, x + labelWidth + 8, rowY + barHeight / 2 - 4.5, { lineBreak: false });

    rowY += barHeight + gap;
  }

  return rowY - gap + 6;
}
