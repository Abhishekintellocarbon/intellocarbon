"use client";

import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Recycle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DashboardEmptyState } from "../shared/dashboard-empty-state";
import { CHART_COLORS } from "../shared/dashboard-constants";
import type { CircularityPoint, CircularityRollup } from "@/lib/types";

const fmtT = (n: number) => `${n.toLocaleString("en-IN", { maximumFractionDigits: 1 })} t`;

const SOURCE_LABELS: Record<string, string> = {
  GRI_306: "GRI 306 waste disclosure",
  BRSR_CORE: "BRSR Core (Attribute 3)",
};

/**
 * Circularity rate — waste kept out of disposal, as a share of waste
 * generated.
 *
 * The card always states which disclosure the rate came from, because the two
 * sources define diversion differently. A rate from BRSR Core is additionally
 * labelled approximate and says why: under GRI, incineration with energy
 * recovery counts as disposal, while a BRSR preparer may count it as
 * recovered. Showing the percentage without that context would make two
 * facilities look comparable when they are measuring different things.
 */
export function CircularityCard({ circularity }: { circularity: CircularityRollup }) {
  // A rate that rises because a low-diversion site stopped reporting looks
  // exactly like one that rises because diversion improved. The card cannot
  // tell them apart either, so it says the coverage moved rather than
  // implying the performance did.
  const facilityCounts = circularity.trend.map((point) => point.facilityCount);
  const minFacilities = facilityCounts.length > 0 ? Math.min(...facilityCounts) : 0;
  const maxFacilities = facilityCounts.length > 0 ? Math.max(...facilityCounts) : 0;
  const coverageVaries = minFacilities !== maxFacilities;

  const split = [
    { label: "Diverted from disposal", value: circularity.divertedTonnes, color: CHART_COLORS.teal },
    { label: "Directed to disposal", value: circularity.disposalTonnes, color: CHART_COLORS.amber },
  ];

  return (
    <Card className="rounded-[12px] p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Waste circularity</h2>
        {circularity.hasData && circularity.periodLabel && (
          <p className="text-xs text-muted-foreground">{circularity.periodLabel}</p>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Share of waste diverted from disposal through reuse, recycling and other recovery. Reused from waste data
        you have already disclosed — nothing to re-enter.
      </p>

      {circularity.hasData ? (
        <>
          <div className="mt-5 flex flex-col items-center gap-6 sm:flex-row">
            <div className="h-40 w-40 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={split} dataKey="value" nameKey="label" innerRadius={46} outerRadius={68} paddingAngle={2}>
                    {split.map((s) => (
                      <Cell key={s.label} fill={s.color} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [fmtT(Number(value)), String(name)]}
                    contentStyle={{ background: "#162230", border: "1px solid #22303f", borderRadius: 8, fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-3xl font-semibold text-teal-500">{circularity.circularityRatePct}%</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                circularity rate
                {circularity.approximated && <span className="text-amber-500"> · approximate</span>}
              </p>

              <dl className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <dt className="text-xs text-muted-foreground">Generated</dt>
                  <dd className="mt-0.5 text-sm font-medium">{fmtT(circularity.generatedTonnes)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Diverted</dt>
                  <dd className="mt-0.5 text-sm font-medium">{fmtT(circularity.divertedTonnes)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">To disposal</dt>
                  <dd className="mt-0.5 text-sm font-medium">{fmtT(circularity.disposalTonnes)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Hazardous</dt>
                  <dd className="mt-0.5 text-sm font-medium">
                    {circularity.hazardousTonnes != null ? fmtT(circularity.hazardousTonnes) : "Not split"}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          {/* The rate on its own says where you are, not whether you are
              getting better — which is the question a diversion figure is
              usually asked. Rendered only from two points up: a single period
              is the headline figure again, drawn as a dot.

              Same source as the headline by construction (see the trend field
              on CircularityRollup), so the line never steps at a change of
              definition. */}
          {circularity.trend.length >= 2 && (
            <div className="mt-5 border-t border-surface-border pt-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-xs font-medium">Circularity rate over time</p>
                {coverageVaries && (
                  <p className="text-xs text-amber-500">Reporting facilities changed between periods</p>
                )}
              </div>

              <div className="mt-3 h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={circularity.trend} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#22303f" />
                    <XAxis dataKey="periodLabel" stroke="#8AA0B4" fontSize={12} />
                    {/* Fixed 0-100. An auto domain would zoom into a two-point
                        range and turn a one-point move into a cliff. */}
                    <YAxis
                      stroke="#8AA0B4"
                      fontSize={12}
                      width={44}
                      domain={[0, 100]}
                      tickFormatter={(v: number) => `${v}%`}
                    />
                    <Tooltip
                      formatter={(value, _name, entry) => {
                        const point = entry.payload as CircularityPoint;
                        return [
                          `${Number(value)}% — ${fmtT(point.divertedTonnes)} of ${fmtT(point.generatedTonnes)}`,
                          `${point.facilityCount} ${point.facilityCount === 1 ? "facility" : "facilities"}`,
                        ];
                      }}
                      contentStyle={{ background: "#162230", border: "1px solid #22303f", borderRadius: 8, fontSize: 12 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="circularityRatePct"
                      name="Circularity rate"
                      stroke={CHART_COLORS.teal}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {coverageVaries && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Between {minFacilities} and {maxFacilities} facilities reported waste across these periods, so part
                  of any movement is a change in what was counted rather than in how much was diverted.
                </p>
              )}
            </div>
          )}

          {/* The number is never shown without saying what it counted. */}
          <div className="mt-5 border-t border-surface-border pt-4">
            <p className="text-xs text-muted-foreground">
              Source: <span className="font-medium text-foreground">{SOURCE_LABELS[circularity.source ?? ""]}</span>
              {" · "}
              {circularity.facilityCount} {circularity.facilityCount === 1 ? "facility" : "facilities"}
            </p>
            {circularity.approximated && (
              <p className="mt-2 text-xs text-amber-500">
                Approximate. BRSR Core reports a single &ldquo;recovered&rdquo; figure, which is close to but not the
                same as GRI&apos;s diverted from disposal — GRI counts incineration with energy recovery as disposal,
                where a BRSR preparer may count it as recovered. File a GRI 306 disclosure for an exact rate.
              </p>
            )}
          </div>
        </>
      ) : (
        <DashboardEmptyState
          icon={Recycle}
          title="No waste data yet"
          description="Report waste in a GRI 306 disclosure or BRSR Core Attribute 3 and the circularity rate appears here automatically."
          ctaHref="/esg/gri"
          ctaLabel="Start a GRI report"
        />
      )}
    </Card>
  );
}
