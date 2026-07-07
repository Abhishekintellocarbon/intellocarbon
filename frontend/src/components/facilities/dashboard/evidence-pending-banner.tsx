import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export function EvidencePendingBanner({ facilityId }: { facilityId: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/10 px-5 py-4 text-sm">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
      <p className="text-foreground/90">
        Supporting documents required before report generation — upload bills and invoices in the{" "}
        <Link href={`/facilities/${facilityId}/documents`} className="font-medium text-warning underline underline-offset-2 hover:text-warning/80">
          Documents section
        </Link>
        .
      </p>
    </div>
  );
}
