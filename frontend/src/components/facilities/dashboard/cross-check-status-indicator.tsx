import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function CrossCheckStatusIndicator({
  facilityId,
  total,
  matched,
}: {
  facilityId: string;
  total: number;
  matched: number;
}) {
  if (total === 0) return null;
  const allMatched = matched === total;

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border px-4 py-2 text-xs",
        allMatched ? "border-success/30 bg-success/10 text-success" : "border-warning/30 bg-warning/10 text-warning",
      )}
    >
      <ClipboardCheck className="h-3.5 w-3.5 shrink-0" />
      <span>
        {matched} of {total} submissions cross-checked
      </span>
      <Link href={`/facilities/${facilityId}/documents`} className="font-medium underline underline-offset-2 hover:opacity-80">
        View documents
      </Link>
    </div>
  );
}
