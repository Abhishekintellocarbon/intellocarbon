import { AlertTriangle } from "lucide-react";

export function EvidencePendingBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[11px] font-semibold text-warning">
      <AlertTriangle className="h-2.5 w-2.5" />
      Evidence Pending
    </span>
  );
}
