import { Check, Loader2, AlertTriangle } from "lucide-react";
import type { AutosaveStatus } from "@/hooks/use-autosave";

export function AutosaveIndicator({ status }: { status: AutosaveStatus }) {
  if (status === "idle") return null;

  if (status === "saving") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Saving...
      </span>
    );
  }

  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-danger">
        <AlertTriangle className="h-3 w-3" />
        Couldn&apos;t save
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#00D4AA]">
      <Check className="h-3 w-3" />
      Saved
    </span>
  );
}
