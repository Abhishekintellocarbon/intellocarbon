import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { FacilityDashboard } from "@/lib/types";

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" });

const toneFor = (daysRemaining: number): "green" | "amber" | "red" => {
  if (daysRemaining <= 7) return "red";
  if (daysRemaining <= 30) return "amber";
  return "green";
};

const TONE_TEXT: Record<"green" | "amber" | "red", string> = {
  green: "text-teal-500",
  amber: "text-warning",
  red: "text-danger",
};

function DeadlineCard({ label, deadline, daysRemaining }: { label: string; deadline: string; daysRemaining: number }) {
  const tone = toneFor(daysRemaining);
  return (
    <Card className="p-6">
      <h3 className="text-sm font-semibold text-muted-foreground">{label}</h3>
      <p className={cn("mt-3 text-4xl font-bold tabular-nums", TONE_TEXT[tone])}>
        {Math.max(0, daysRemaining)}
        <span className="ml-1.5 text-sm font-medium text-muted-foreground">days left</span>
      </p>
      <p className="mt-2 text-xs text-muted-foreground">{fmtDate(deadline)}</p>
    </Card>
  );
}

export function DeadlineCountdown({ dashboard }: { dashboard: FacilityDashboard }) {
  return (
    <div className="grid gap-5 sm:grid-cols-3">
      <DeadlineCard label="Next CBAM quarterly report" deadline={dashboard.deadlines.cbam.deadline} daysRemaining={dashboard.deadlines.cbam.daysRemaining} />
      <DeadlineCard label="CCTS annual compliance" deadline={dashboard.deadlines.ccts.deadline} daysRemaining={dashboard.deadlines.ccts.daysRemaining} />
      <DeadlineCard label={`BRSR Core (${dashboard.brsr.fyLabel})`} deadline={dashboard.deadlines.brsr.deadline} daysRemaining={dashboard.deadlines.brsr.daysRemaining} />
    </div>
  );
}
