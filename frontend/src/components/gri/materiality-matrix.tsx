"use client";

import { GRI_TOPICS, isNegativeImpact } from "@/lib/gri-standards";
import { severityOf, likelihoodOf } from "@/lib/gri-scoring";
import type { GriImpactFormValues } from "@/lib/validations/gri";

/**
 * GRI 3 materiality matrix — severity against likelihood, with the threshold
 * band shaded.
 *
 * Deliberately a hand-rolled SVG rather than a Recharts scatter: the chart has
 * to mirror the PDF's matrix exactly (same axes, same threshold shading, same
 * derivation of severity from the raw attributes), and it is far easier to
 * keep two small pieces of drawing code in step than to keep a chart library's
 * defaults in step with pdfkit output.
 */

const SIZE = { w: 520, h: 340, padL: 46, padB: 44, padT: 12, padR: 92 };

export function MaterialityMatrix({
  impacts,
  threshold,
}: {
  impacts: GriImpactFormValues[];
  threshold: number;
}) {
  const plotW = SIZE.w - SIZE.padL - SIZE.padR;
  const plotH = SIZE.h - SIZE.padT - SIZE.padB;
  const toX = (v: number) => SIZE.padL + ((v - 1) / 4) * plotW;
  const toY = (v: number) => SIZE.padT + plotH - ((v - 1) / 4) * plotH;

  const thresholdY = toY(Math.max(1, Math.min(5, threshold)));

  if (impacts.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center rounded-xl border border-dashed border-surface-border text-sm text-muted-foreground">
        Add impacts below to see the materiality matrix.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${SIZE.w} ${SIZE.h}`} className="h-auto w-full min-w-[460px]" role="img" aria-label="Materiality matrix">
        {/* Threshold band — everything at or above the disclosed threshold */}
        <rect
          x={SIZE.padL}
          y={SIZE.padT}
          width={plotW}
          height={Math.max(0, thresholdY - SIZE.padT)}
          className="fill-teal-500/10"
        />

        {[1, 2, 3, 4, 5].map((v) => (
          <g key={`grid-${v}`}>
            <line x1={SIZE.padL} y1={toY(v)} x2={SIZE.padL + plotW} y2={toY(v)} className="stroke-surface-border" strokeWidth={0.5} />
            <line x1={toX(v)} y1={SIZE.padT} x2={toX(v)} y2={SIZE.padT + plotH} className="stroke-surface-border" strokeWidth={0.5} />
            <text x={SIZE.padL - 8} y={toY(v) + 3} textAnchor="end" className="fill-muted text-[9px]">
              {v}
            </text>
            <text x={toX(v)} y={SIZE.padT + plotH + 14} textAnchor="middle" className="fill-muted text-[9px]">
              {v}
            </text>
          </g>
        ))}

        <rect x={SIZE.padL} y={SIZE.padT} width={plotW} height={plotH} className="fill-none stroke-surface-border" strokeWidth={1} />

        <line
          x1={SIZE.padL}
          y1={thresholdY}
          x2={SIZE.padL + plotW}
          y2={thresholdY}
          className="stroke-teal-500"
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />
        <text x={SIZE.padL + 4} y={thresholdY - 5} className="fill-teal-500 text-[9px] font-semibold">
          Materiality threshold — {threshold.toFixed(2)}
        </text>

        {impacts.map((impact, i) => {
          const cx = toX(Math.max(1, Math.min(5, likelihoodOf(impact))));
          const cy = toY(Math.max(1, Math.min(5, severityOf(impact))));
          const topic = GRI_TOPICS.find((t) => t.code === impact.topicCode);
          const negative = isNegativeImpact(impact.impactType);
          // Alternate label side so points sharing a score don't overprint.
          const left = i % 2 === 1;
          return (
            <g key={`${impact.topicCode}-${i}`}>
              <circle cx={cx} cy={cy} r={4.5} className={negative ? "fill-danger" : "fill-teal-500"} />
              <text
                x={left ? cx - 8 : cx + 8}
                y={cy + 3}
                textAnchor={left ? "end" : "start"}
                className="fill-foreground text-[9px]"
              >
                {topic?.label ?? impact.topicCode}
              </text>
            </g>
          );
        })}

        <text x={SIZE.padL + plotW / 2} y={SIZE.h - 6} textAnchor="middle" className="fill-muted text-[10px] font-semibold">
          Likelihood (1 = remote, 5 = certain / already occurred)
        </text>
        <text
          x={12}
          y={SIZE.padT + plotH / 2}
          textAnchor="middle"
          className="fill-muted text-[10px] font-semibold"
          transform={`rotate(-90 12 ${SIZE.padT + plotH / 2})`}
        >
          Severity / magnitude
        </text>
      </svg>

      <p className="mt-2 text-xs text-muted-foreground">
        Red markers are negative impacts; teal markers are positive impacts. Severity is the mean of the attributes
        that apply — irremediability counts for negative impacts only.
      </p>
    </div>
  );
}
