import Link from "next/link";
import { Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DashboardAccess } from "./dashboard-access";
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

function LockedDeadlineCard({ label }: { label: string }) {
  return (
    <Card className="relative flex flex-col bg-background p-6">
      <Lock className="absolute right-5 top-5 h-4 w-4 text-muted" />
      <h3 className="pr-6 text-sm font-semibold text-muted-foreground">{label}</h3>
      <span className="mt-3 inline-flex w-fit items-center rounded-full border border-warning/30 bg-warning/10 px-2.5 py-1 text-xs font-semibold text-warning">
        Not subscribed
      </span>
      <p className="mt-3 flex-1 text-sm text-muted-foreground">Upgrade to unlock this deadline countdown.</p>
      <Link href="/billing" className="mt-4">
        <Button
          size="sm"
          variant="secondary"
          className="w-full border-teal-500/50 bg-transparent text-teal-500 hover:border-teal-500 hover:bg-teal-500/10"
        >
          Upgrade
        </Button>
      </Link>
    </Card>
  );
}

export function DeadlineCountdown({ dashboard, access }: { dashboard: FacilityDashboard; access: DashboardAccess }) {
  return (
    <div className="grid gap-5 sm:grid-cols-3">
      {access.hasCbam ? (
        <DeadlineCard label="Next CBAM quarterly report" deadline={dashboard.deadlines.cbam.deadline} daysRemaining={dashboard.deadlines.cbam.daysRemaining} />
      ) : (
        <LockedDeadlineCard label="Next CBAM quarterly report" />
      )}
      {access.hasCcts ? (
        <DeadlineCard label="CCTS annual compliance" deadline={dashboard.deadlines.ccts.deadline} daysRemaining={dashboard.deadlines.ccts.daysRemaining} />
      ) : (
        <LockedDeadlineCard label="CCTS annual compliance" />
      )}
      {access.hasBrsr ? (
        <DeadlineCard label={`BRSR Core (${dashboard.brsr.fyLabel})`} deadline={dashboard.deadlines.brsr.deadline} daysRemaining={dashboard.deadlines.brsr.daysRemaining} />
      ) : (
        <LockedDeadlineCard label={`BRSR Core (${dashboard.brsr.fyLabel})`} />
      )}
    </div>
  );
}
