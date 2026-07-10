import { Card } from "@/components/ui/card";

/** Placeholder shown while a dashboard chart's data is still loading — a pulsing outline of the real card, not a spinner. */
export function ChartSkeleton({ height = 240 }: { height?: number }) {
  return (
    <Card className="rounded-[12px] p-6">
      <div className="h-4 w-40 animate-pulse rounded bg-surface-raised" />
      <div className="mt-2 h-3 w-64 animate-pulse rounded bg-surface-raised" />
      <div className="mt-5 animate-pulse rounded-lg bg-surface-raised" style={{ height }} />
    </Card>
  );
}
