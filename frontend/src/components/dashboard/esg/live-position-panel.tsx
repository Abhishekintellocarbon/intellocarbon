import Link from "next/link";
import { CalendarClock, IndianRupee, TrendingDown, TrendingUp, Upload } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { LivePositionItem } from "@/lib/types";

/**
 * Recent Activity / Live Position strip — the frequently-changing facts that
 * make the dashboard worth opening between reporting deadlines.
 *
 * Every item here is computed from real data by the backend, which omits
 * anything it can't compute. That's why this component has no placeholder
 * branch: if there's nothing genuinely dynamic to say yet, it says exactly
 * that rather than inventing a deadline or a delta.
 *
 * Shared by the unified ESG Overview and the company-wide CBAM/CCTS
 * dashboard, which had no equivalent (the per-facility dashboard already has
 * its own RecentActivityFeed).
 */

const KIND_ICON: Record<LivePositionItem["kind"], typeof Upload> = {
  DATA_UPDATE: Upload,
  DEADLINE: CalendarClock,
  TREND: TrendingUp,
  PRICE: IndianRupee,
};

const fmtTimestamp = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

/**
 * Green when the metric moved the way the company wants it to, amber when it
 * moved against them. Direction alone isn't enough — a fall in waste is good,
 * a fall in renewable share would not be — so `lowerIsBetter` decides.
 */
const trendTone = (item: LivePositionItem): string => {
  if (item.deltaPct == null || item.lowerIsBetter == null) return "text-muted-foreground";
  const improved = item.lowerIsBetter ? item.deltaPct < 0 : item.deltaPct > 0;
  return improved ? "text-teal-500" : "text-[#F5A623]";
};

function ItemRow({ item }: { item: LivePositionItem }) {
  const fell = item.deltaPct != null && item.deltaPct < 0;
  const Icon = item.kind === "TREND" ? (fell ? TrendingDown : TrendingUp) : KIND_ICON[item.kind];
  const tone = item.kind === "TREND" ? trendTone(item) : "text-teal-500";

  const body = (
    <>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-surface-border bg-surface-raised">
        <Icon className={`h-3.5 w-3.5 ${tone}`} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{item.label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p>
      </div>
      {item.timestamp && <p className="shrink-0 text-xs text-muted">{fmtTimestamp(item.timestamp)}</p>}
    </>
  );

  return (
    <li>
      {item.href ? (
        <Link href={item.href} className="flex items-start gap-3 rounded-lg transition-colors hover:bg-surface-raised/60">
          {body}
        </Link>
      ) : (
        <div className="flex items-start gap-3">{body}</div>
      )}
    </li>
  );
}

export function LivePositionPanel({
  items,
  description,
}: {
  items: LivePositionItem[];
  description: string;
}) {
  return (
    <Card className="rounded-[12px] p-6">
      <h2 className="text-lg font-semibold">Recent activity</h2>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>

      {items.length > 0 ? (
        <ul className="mt-4 space-y-4">
          {items.map((item) => (
            <ItemRow key={item.id} item={item} />
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          Nothing new since your last visit. Activity appears here as data is submitted, deadlines approach, and
          period-over-period trends become computable.
        </p>
      )}
    </Card>
  );
}
