"use client";

import { getEsrsStandard } from "@/lib/esrs-standards";
import { previewImpactScore, previewFinancialScore, type CsrdScorableIro } from "@/lib/csrd-scoring";

/**
 * The double materiality matrix — financial materiality on the horizontal
 * axis, impact materiality on the vertical.
 *
 * The two shaded bands are the point of the chart. Anything in either band is
 * material, because ESRS makes a matter material if it clears the threshold on
 * either axis; the darker overlap in the upper right is material on both. That
 * reading only works because the bands are drawn with the same translucent
 * fill and allowed to compose, rather than as three separately-coloured
 * quadrants.
 *
 * Hand-rolled SVG rather than a chart library, for the same reason as GRI's:
 * it has to mirror the PDF's matrix exactly, and two small pieces of drawing
 * code are easier to keep in step than a library's defaults against pdfkit.
 */

const SIZE = { w: 540, h: 380, padL: 52, padB: 50, padT: 14, padR: 96 };

export function DoubleMaterialityMatrix({
  iros,
  impactThreshold,
  financialThreshold,
}: {
  iros: (CsrdScorableIro & { standardCode: string })[];
  impactThreshold: number;
  financialThreshold: number;
}) {
  const plotW = SIZE.w - SIZE.padL - SIZE.padR;
  const plotH = SIZE.h - SIZE.padT - SIZE.padB;
  const toX = (v: number) => SIZE.padL + ((v - 1) / 4) * plotW;
  const toY = (v: number) => SIZE.padT + plotH - ((v - 1) / 4) * plotH;

  const clamp = (v: number) => Math.max(1, Math.min(5, v));
  const thresholdY = toY(clamp(impactThreshold));
  const thresholdX = toX(clamp(financialThreshold));

  const scored = iros
    .map((iro) => ({
      iro,
      impact: previewImpactScore(iro),
      financial: previewFinancialScore(iro),
    }))
    .filter((s) => s.impact != null || s.financial != null);

  if (scored.length === 0) {
    return (
      <div className="flex h-[240px] items-center justify-center rounded-xl border border-dashed border-surface-border text-sm text-muted-foreground">
        Score at least one impact, risk or opportunity to see the matrix.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${SIZE.w} ${SIZE.h}`}
        className="h-auto w-full min-w-[500px]"
        role="img"
        aria-label="Double materiality matrix"
      >
        {/* Material-on-impact band, then material-on-financial band. They
            overlap in the upper right, which is material on both. */}
        <rect
          x={SIZE.padL}
          y={SIZE.padT}
          width={plotW}
          height={Math.max(0, thresholdY - SIZE.padT)}
          className="fill-teal-500/10"
        />
        <rect
          x={thresholdX}
          y={SIZE.padT}
          width={Math.max(0, SIZE.padL + plotW - thresholdX)}
          height={plotH}
          className="fill-teal-500/10"
        />

        {[1, 2, 3, 4, 5].map((v) => (
          <g key={`grid-${v}`}>
            <line x1={SIZE.padL} y1={toY(v)} x2={SIZE.padL + plotW} y2={toY(v)} className="stroke-surface-border" strokeWidth={0.5} />
            <line x1={toX(v)} y1={SIZE.padT} x2={toX(v)} y2={SIZE.padT + plotH} className="stroke-surface-border" strokeWidth={0.5} />
            <text x={SIZE.padL - 8} y={toY(v) + 3} textAnchor="end" className="fill-muted text-[9px]">{v}</text>
            <text x={toX(v)} y={SIZE.padT + plotH + 14} textAnchor="middle" className="fill-muted text-[9px]">{v}</text>
          </g>
        ))}

        <rect x={SIZE.padL} y={SIZE.padT} width={plotW} height={plotH} className="fill-none stroke-surface-border" strokeWidth={1} />

        <line x1={SIZE.padL} y1={thresholdY} x2={SIZE.padL + plotW} y2={thresholdY} className="stroke-teal-500" strokeWidth={1.5} strokeDasharray="4 3" />
        <line x1={thresholdX} y1={SIZE.padT} x2={thresholdX} y2={SIZE.padT + plotH} className="stroke-teal-500" strokeWidth={1.5} strokeDasharray="4 3" />
        <text x={SIZE.padL + 4} y={thresholdY - 5} className="fill-teal-500 text-[9px] font-semibold">
          Impact threshold {impactThreshold.toFixed(2)}
        </text>
        <text x={thresholdX + 4} y={SIZE.padT + 12} className="fill-teal-500 text-[9px] font-semibold">
          Financial {financialThreshold.toFixed(2)}
        </text>

        {scored.map(({ iro, impact, financial }, i) => {
          // A matter scored on one axis only is plotted at the axis minimum on
          // the other, so it still appears rather than being dropped.
          const cx = toX(clamp(financial ?? 1));
          const cy = toY(clamp(impact ?? 1));
          const standard = getEsrsStandard(iro.standardCode);
          const bothAxes = impact != null && financial != null;
          const fill = bothAxes ? "fill-teal-500" : financial != null ? "fill-[#4A9EFF]" : "fill-danger";
          const left = i % 2 === 1;
          return (
            <g key={`${iro.standardCode}-${i}`}>
              <circle cx={cx} cy={cy} r={4.5} className={fill} />
              <text
                x={left ? cx - 8 : cx + 8}
                y={cy + 3}
                textAnchor={left ? "end" : "start"}
                className="fill-foreground text-[9px]"
              >
                {standard?.label.replace("ESRS ", "") ?? iro.standardCode}
              </text>
            </g>
          );
        })}

        <text x={SIZE.padL + plotW / 2} y={SIZE.h - 6} textAnchor="middle" className="fill-muted text-[10px] font-semibold">
          Financial materiality (magnitude × likelihood)
        </text>
        <text
          x={14}
          y={SIZE.padT + plotH / 2}
          textAnchor="middle"
          className="fill-muted text-[10px] font-semibold"
          transform={`rotate(-90 14 ${SIZE.padT + plotH / 2})`}
        >
          Impact materiality (severity)
        </text>
      </svg>

      <p className="mt-2 text-xs text-muted-foreground">
        Teal markers are scored on both axes, blue on financial materiality only, red on impact materiality only.
        Anything inside either shaded band is material; the darker overlap is material on both.
      </p>
    </div>
  );
}
