import Link from "next/link";
import { Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function UpsellCard({ title, priceLabel, valueProposition }: { title: string; priceLabel: string; valueProposition: string }) {
  return (
    <Card className="relative flex flex-col bg-background p-6">
      <Lock className="absolute right-5 top-5 h-4 w-4 text-muted" />
      <span className="inline-flex w-fit items-center rounded-full border border-warning/30 bg-warning/10 px-2.5 py-1 text-xs font-semibold text-warning">
        Not subscribed
      </span>
      <p className="mt-3 pr-6 text-base font-semibold text-foreground">
        Add {title} — {priceLabel}
      </p>
      <p className="mt-2 flex-1 text-sm text-muted-foreground">{valueProposition}</p>
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
