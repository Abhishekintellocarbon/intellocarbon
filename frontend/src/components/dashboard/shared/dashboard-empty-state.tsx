import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DashboardEmptyState({
  icon: Icon,
  title,
  description,
  ctaHref,
  ctaLabel,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  ctaHref: string;
  ctaLabel: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2.5 py-8 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full border border-surface-border bg-surface-raised">
        <Icon className="h-4 w-4 text-teal-500" />
      </span>
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      <p className="max-w-xs text-xs text-muted-foreground">{description}</p>
      <Link href={ctaHref} className="mt-1.5">
        <Button size="sm" variant="secondary">
          {ctaLabel}
        </Button>
      </Link>
    </div>
  );
}
