"use client";

import { BarChart3, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { BenchmarkSet, SectorBenchmark } from "@/lib/types";

const fmt = (n: number | null, digits = 3) =>
  n == null ? "—" : n.toLocaleString("en-IN", { maximumFractionDigits: digits });

const COMPARISON_COPY: Record<string, string> = {
  BETTER: "below the sector median",
  WORSE: "above the sector median",
  SIMILAR: "in line with the sector median",
};

/**
 * Comparison against a sector benchmark, shown only where a real public
 * figure exists to cite.
 *
 * The unavailable state is a first-class rendering here, not an empty state to
 * be skipped past. It states why no benchmark exists and never leaves a
 * number-shaped gap that a reader might fill in themselves. Every value that
 * does appear carries its source directly beneath it.
 */
function BenchmarkRow({ benchmark }: { benchmark: SectorBenchmark }) {
  if (benchmark.status !== "AVAILABLE") {
    return (
      <div className="rounded-xl border border-surface-border p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-medium">{benchmark.label}</p>
          <span className="text-xs text-muted-foreground">{benchmark.unit}</span>
        </div>
        {/* No bar, no placeholder value — nothing that could be read as a figure. */}
        <p className="mt-2 text-xs text-muted-foreground">{benchmark.unavailableReason}</p>
        {benchmark.companyValue != null && (
          <p className="mt-2 text-xs text-muted-foreground">
            Your own figure: <span className="font-medium text-foreground">{fmt(benchmark.companyValue)}</span>{" "}
            {benchmark.unit}
          </p>
        )}
      </div>
    );
  }

  const company = benchmark.companyValue ?? 0;
  const bench = benchmark.benchmarkValue ?? 0;
  const scale = Math.max(company, bench) || 1;

  return (
    <div className="rounded-xl border border-surface-border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium">{benchmark.label}</p>
        <span className="text-xs text-muted-foreground">{benchmark.unit}</span>
      </div>

      <div className="mt-3 space-y-2">
        <div>
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className="text-muted-foreground">Your company</span>
            <span className="font-medium text-foreground">{fmt(company)}</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-raised">
            <div className="h-full rounded-full bg-teal-500" style={{ width: `${(company / scale) * 100}%` }} />
          </div>
        </div>
        <div>
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className="text-muted-foreground">Sector median</span>
            <span className="font-medium text-foreground">{fmt(bench)}</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-raised">
            <div className="h-full rounded-full bg-[#4A9EFF]" style={{ width: `${(bench / scale) * 100}%` }} />
          </div>
        </div>
      </div>

      {benchmark.differencePct != null && (
        <p className="mt-3 text-xs">
          <span className={benchmark.comparison === "WORSE" ? "text-amber-500" : "text-teal-500"}>
            {Math.abs(benchmark.differencePct)}% {COMPARISON_COPY[benchmark.comparison ?? "SIMILAR"]}
          </span>
        </p>
      )}

      {/* The citation sits with the number it supports. */}
      <p className="mt-2 text-xs text-muted-foreground">{benchmark.source}</p>
    </div>
  );
}

export function SectorBenchmarkCard({ benchmarks }: { benchmarks: BenchmarkSet }) {
  return (
    <Card className="rounded-[12px] p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Sector comparison</h2>
        <span className="text-xs text-muted-foreground">{benchmarks.sector}</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Your position against public sector figures, shown only where one exists to cite.
      </p>

      <div className="mt-5 space-y-3">
        {benchmarks.benchmarks.map((b) => (
          <BenchmarkRow key={b.metricKey} benchmark={b} />
        ))}
      </div>

      {benchmarks.unsourced.length > 0 && (
        <div className="mt-5 border-t border-surface-border pt-4">
          <h3 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Info className="h-3.5 w-3.5" />
            No public benchmark exists for these
          </h3>
          {/* Declared rather than omitted: a missing card reads as "not built
              yet", which invites the question again. */}
          <ul className="mt-3 space-y-2.5">
            {benchmarks.unsourced.map((m) => (
              <li key={m.metricKey}>
                <p className="text-sm">{m.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{m.why}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-4 flex items-start gap-1.5 border-t border-surface-border pt-4 text-xs text-muted-foreground">
        <BarChart3 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>{benchmarks.notice}</span>
      </p>
    </Card>
  );
}
