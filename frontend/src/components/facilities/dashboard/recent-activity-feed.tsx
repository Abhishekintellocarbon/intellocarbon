import { Bell, Clock, FileText, ShieldCheck, Upload } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { FacilityActivityFeedItem, FacilityDashboard } from "@/lib/types";

const KIND_ICON: Record<FacilityActivityFeedItem["kind"], typeof Upload> = {
  SUBMISSION: Upload,
  REPORT: FileText,
  VERIFICATION: ShieldCheck,
  ALERT: Bell,
};

const fmtTimestamp = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function RecentActivityFeed({ dashboard }: { dashboard: FacilityDashboard }) {
  const { recentActivity } = dashboard;

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold">Recent activity</h2>

      {recentActivity.length > 0 ? (
        <ul className="mt-4 space-y-4">
          {recentActivity.map((item) => {
            const Icon = KIND_ICON[item.kind];
            return (
              <li key={item.id} className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-surface-border bg-surface-raised">
                  <Icon className="h-3.5 w-3.5 text-teal-500" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.detail}</p>
                </div>
                <p className="shrink-0 text-xs text-muted">{fmtTimestamp(item.timestamp)}</p>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="mt-4 flex flex-col items-center gap-2 py-6 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-surface-border bg-surface-raised">
            <Clock className="h-4 w-4 text-teal-500" />
          </span>
          <p className="text-sm text-muted-foreground">No activity yet for this facility.</p>
        </div>
      )}
    </Card>
  );
}
