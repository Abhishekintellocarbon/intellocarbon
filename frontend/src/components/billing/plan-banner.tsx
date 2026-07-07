"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { billingApi } from "@/lib/api";
import type { PlanDefinition, Subscription } from "@/lib/types";

/** Compact "Active Plan: ..." status strip — shown at the top of the dashboard and facilities pages. */
export function PlanBanner({ facilityCount }: { facilityCount: number }) {
  const [subscriptions, setSubscriptions] = useState<Subscription[] | null>(null);
  const [plans, setPlans] = useState<PlanDefinition[] | null>(null);

  useEffect(() => {
    billingApi
      .subscription()
      .then((data) => {
        setSubscriptions(data.subscriptions);
        setPlans(data.plans);
      })
      .catch(() => {
        setSubscriptions([]);
        setPlans([]);
      });
  }, []);

  if (!subscriptions || !plans) return null;

  const activePlanNames = subscriptions
    .filter((s) => s.status === "ACTIVE")
    .map((s) => plans.find((p) => p.tier === s.tier)?.name ?? s.tier.replace(/_/g, " "));

  return (
    <div className="mt-6 flex flex-wrap items-center gap-3 rounded-[12px] border border-surface-border bg-surface-raised/40 px-5 py-3 text-sm">
      {activePlanNames.length > 0 ? (
        <>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-teal-500/30 bg-teal-500/10 px-2.5 py-1 text-xs font-semibold text-teal-500">
            <ShieldCheck className="h-3 w-3" />
            Active Plan
          </span>
          <span className="text-muted-foreground">
            {activePlanNames.join(" + ")} · {facilityCount} facilit{facilityCount === 1 ? "y" : "ies"}
          </span>
        </>
      ) : (
        <span className="text-muted-foreground">
          No active plan —{" "}
          <Link href="/billing" className="font-medium text-teal-500 hover:underline">
            go to Billing to subscribe
          </Link>
          .
        </span>
      )}
    </div>
  );
}
