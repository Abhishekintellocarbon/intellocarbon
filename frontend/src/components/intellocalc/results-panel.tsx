import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function ResultsPanel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-surface-border border-l-4 border-l-teal-500 bg-surface p-6 shadow-card",
        className,
      )}
      {...props}
    />
  );
}

export function ResultLine({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-surface-border py-3 last:border-b-0">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-lg font-semibold text-foreground">{value}</span>
      {sub && <span className="text-xs text-muted">{sub}</span>}
    </div>
  );
}
