"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Check, X, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppHeader } from "@/components/layout/app-header";
import { FacilityCalculator } from "@/components/billing/facility-calculator";
import { useAuth } from "@/context/auth-context";
import { billingApi, ApiError } from "@/lib/api";
import { openRazorpayCheckout } from "@/lib/razorpay";
import type { PlanDefinition, Subscription, SubscriptionTier } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-teal-500/10 text-teal-500 border-teal-500/30",
  PAST_DUE: "bg-danger/10 text-danger border-danger/30",
  INCOMPLETE: "bg-surface-raised text-muted-foreground border-surface-border",
  CANCELED: "bg-surface-raised text-muted-foreground border-surface-border",
};

interface ComparisonRow {
  label: string;
  ccts: boolean;
  cbam: boolean;
  both: boolean;
}

const COMPARISON_FEATURES: ComparisonRow[] = [
  { label: "GHG intensity monitoring", ccts: true, cbam: false, both: true },
  { label: "CCTS BEE format reports", ccts: true, cbam: false, both: true },
  { label: "CCC surplus/deficit tracking", ccts: true, cbam: false, both: true },
  { label: "CBAM Communication Package PDF", ccts: false, cbam: true, both: true },
  { label: "CBAM certificates calculation", ccts: false, cbam: true, both: true },
  { label: "Financial liability in Euros", ccts: false, cbam: true, both: true },
  { label: "EU default value comparison", ccts: false, cbam: true, both: true },
  { label: "Article 9 deduction", ccts: false, cbam: true, both: true },
  { label: "Verification portal", ccts: true, cbam: true, both: true },
  { label: "O3CI submission ready", ccts: false, cbam: true, both: true },
  { label: "Quarterly deadline alerts", ccts: true, cbam: true, both: true },
  { label: "7-year document retention", ccts: true, cbam: true, both: true },
];

const TRUST_SIGNALS = [
  "Founded by an ISO 14064 Lead Verifier",
  "DPIIT-recognised startup",
  "Regulatory basis: EU 2023/956 & S.O. 2825(E) 2023",
  "Data hosted in India — Supabase Mumbai (ap-south-1)",
  "7-year data retention as per EU 2024/3210",
];

const FAQS = [
  {
    question: "What is CBAM and do I need it?",
    answer:
      "CBAM applies if your company exports steel, cement, aluminium, fertilizers, hydrogen, or electricity to the European Union. From January 2026, your EU buyer needs verified emissions data from you.",
  },
  {
    question: "What is CCTS and do I need it?",
    answer:
      "CCTS is India's Carbon Credit Trading Scheme under S.O. 2825(E) 2023. If your facility falls under BEE's obligated sectors — steel, cement, aluminium, fertilizers, and others — you must monitor and report GHG intensity from Q3 2026.",
  },
  {
    question: "What if I need both?",
    answer:
      "Choose CBAM + CCTS. One data entry powers both compliance outputs simultaneously. Your Article 9 deduction is calculated automatically — carbon price paid in India reduces your CBAM certificate obligation.",
  },
];

function ComparisonMark({ ok }: { ok: boolean }) {
  return ok ? (
    <Check className="mx-auto h-4 w-4 text-teal-500" />
  ) : (
    <X className="mx-auto h-4 w-4 text-muted-foreground/40" />
  );
}

function PlanCard({
  plan,
  quantity,
  onQuantityChange,
  isCurrent,
  isSwitchable,
  isLoading,
  onSubscribe,
}: {
  plan: PlanDefinition;
  quantity: number;
  onQuantityChange: (q: number) => void;
  isCurrent: boolean;
  isSwitchable: boolean;
  isLoading: boolean;
  onSubscribe: () => void;
}) {
  return (
    <Card
      className={cn(
        "relative flex flex-col rounded-[12px] p-6",
        plan.highlight ? "border-teal-500/60 shadow-glow" : "",
      )}
    >
      {plan.highlight && (
        <span className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-gradient-teal-blue px-3 py-1 text-xs font-semibold text-[#06120F]">
          <Sparkles className="h-3 w-3" /> Most Popular
        </span>
      )}
      {isCurrent && (
        <span className="mb-3 inline-flex w-fit items-center gap-1 rounded-full bg-teal-500/10 px-2.5 py-1 text-xs font-semibold text-teal-500">
          <Check className="h-3 w-3" /> Current plan
        </span>
      )}

      <h3 className="text-lg font-semibold">{plan.name}</h3>
      <p className="mt-1 text-2xl font-semibold text-gradient">{plan.priceLabel}</p>
      <p className="mt-2 text-sm text-muted-foreground">{plan.forWhom}</p>

      <div className="mt-5">
        <FacilityCalculator pricePerFacility={plan.priceInr ?? 0} quantity={quantity} onChange={onQuantityChange} />
      </div>

      <ul className="mt-5 flex-1 space-y-2.5">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-foreground/90">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-500" />
            {f}
          </li>
        ))}
      </ul>

      <Button
        className="mt-6 w-full rounded-[8px]"
        variant={isCurrent ? "secondary" : "primary"}
        disabled={isCurrent}
        isLoading={isLoading}
        onClick={onSubscribe}
      >
        {isCurrent ? "Active" : isSwitchable ? "Switch plan" : "Get Started"}
      </Button>
    </Card>
  );
}

function BillingContent() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isOnboarding = searchParams.get("onboarding") === "1";

  const [plans, setPlans] = useState<PlanDefinition[] | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<{ facilityCount: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkingOutTier, setCheckingOutTier] = useState<SubscriptionTier | null>(null);
  const [canceling, setCanceling] = useState(false);
  const [devBypassNotice, setDevBypassNotice] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const refresh = () =>
    billingApi
      .subscription()
      .then((data) => {
        setPlans(data.plans);
        setSubscription(data.subscription);
        setUsage(data.usage);
        setQuantities((prev) => {
          const next = { ...prev };
          for (const plan of data.plans) {
            if (next[plan.tier] === undefined) next[plan.tier] = 1;
          }
          return next;
        });
      })
      .catch(() => setError("Couldn't load billing information."));

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubscribe = async (tier: SubscriptionTier) => {
    setError(null);
    setCheckingOutTier(tier);
    try {
      const result = await billingApi.checkout(tier);
      if (result.devBypass) {
        setDevBypassNotice(true);
        setSubscription(result.subscription);
        await refresh();
        if (isOnboarding) router.push("/facilities/new?onboarding=1");
      } else if (result.razorpayKeyId && result.razorpaySubscriptionId) {
        await openRazorpayCheckout({
          key: result.razorpayKeyId,
          subscription_id: result.razorpaySubscriptionId,
          name: "Intellocarbon",
          description: `${tier} plan subscription`,
          prefill: { name: user?.name, email: user?.email },
          theme: { color: "#00D4AA" },
          handler: () => {
            refresh();
            if (isOnboarding) router.push("/facilities/new?onboarding=1");
          },
        });
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't start checkout. Please try again.");
    } finally {
      setCheckingOutTier(null);
    }
  };

  const handleCancel = async () => {
    if (!confirm("Cancel your subscription at the end of the current billing period?")) return;
    setCanceling(true);
    try {
      await billingApi.cancel();
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't cancel subscription.");
    } finally {
      setCanceling(false);
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-semibold">
        {isOnboarding ? "Choose a plan to finish setup" : "Billing & plans"}
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {isOnboarding
          ? "An active subscription is required before you can add facilities."
          : "Simple, direct pricing — priced per facility, no hidden tiers."}
      </p>

      {error && (
        <div className="mt-6">
          <Alert variant="error">{error}</Alert>
        </div>
      )}
      {devBypassNotice && (
        <div className="mt-6">
          <Alert variant="info">
            No Razorpay keys are configured, so checkout ran in simulated dev-bypass mode — your
            subscription was activated immediately without a real payment.
          </Alert>
        </div>
      )}

      {!plans && !error && (
        <div className="mt-16 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
        </div>
      )}

      {subscription && (
        <Card className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-[12px] p-5">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-semibold",
                STATUS_STYLES[subscription.status],
              )}
            >
              {subscription.status.replace(/_/g, " ")}
            </span>
            <span className="text-sm text-muted-foreground">
              {subscription.tier.replace(/_/g, " ")}
              {usage && ` · ${usage.facilityCount} facilit${usage.facilityCount === 1 ? "y" : "ies"} in use`}
              {subscription.cancelAtPeriodEnd && " · cancels at period end"}
            </span>
          </div>
          {subscription.status === "ACTIVE" && !subscription.cancelAtPeriodEnd && (
            <Button variant="secondary" size="sm" onClick={handleCancel} isLoading={canceling}>
              Cancel subscription
            </Button>
          )}
        </Card>
      )}

      {/* Section 1 — plan cards */}
      {plans && (
        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = subscription?.tier === plan.tier && subscription.status === "ACTIVE";
            const isSwitchable = Boolean(subscription?.status === "ACTIVE" && !isCurrent);
            return (
              <PlanCard
                key={plan.tier}
                plan={plan}
                quantity={quantities[plan.tier] ?? 1}
                onQuantityChange={(q) => setQuantities((prev) => ({ ...prev, [plan.tier]: q }))}
                isCurrent={isCurrent}
                isSwitchable={isSwitchable}
                isLoading={checkingOutTier === plan.tier}
                onSubscribe={() => handleSubscribe(plan.tier)}
              />
            );
          })}
        </div>
      )}

      {/* Section 2 — feature comparison table */}
      {plans && (
        <div className="mt-14">
          <h2 className="text-lg font-semibold">Compare plans</h2>
          <Card className="mt-4 overflow-x-auto rounded-[12px] p-0">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-surface-border">
                  <th className="px-5 py-3 text-left font-medium text-muted-foreground">Feature</th>
                  <th className="px-5 py-3 text-center font-medium text-muted-foreground">CCTS Compliance</th>
                  <th className="px-5 py-3 text-center font-medium text-muted-foreground">CBAM Compliance</th>
                  <th className="px-5 py-3 text-center font-medium text-teal-500">CBAM + CCTS</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_FEATURES.map((row, i) => (
                  <tr key={row.label} className={i % 2 === 0 ? "bg-transparent" : "bg-surface-raised/40"}>
                    <td className="px-5 py-3 text-foreground/90">{row.label}</td>
                    <td className="px-5 py-3">
                      <ComparisonMark ok={row.ccts} />
                    </td>
                    <td className="px-5 py-3">
                      <ComparisonMark ok={row.cbam} />
                    </td>
                    <td className="px-5 py-3">
                      <ComparisonMark ok={row.both} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {/* Section 3 — enterprise callout */}
      <Card className="mt-14 flex flex-col items-start justify-between gap-4 rounded-[12px] border-teal-500/20 bg-gradient-radial-glow p-6 sm:flex-row sm:items-center">
        <p className="text-sm text-foreground/90 sm:max-w-2xl">
          For companies with more than 5 facilities or needing EPR modules, ESG reporting, or custom
          integrations — contact us for Enterprise pricing.
        </p>
        <a href="mailto:sales@intellocarbon.com" className="shrink-0">
          <Button variant="secondary" className="rounded-[8px]">
            Contact Us
          </Button>
        </a>
      </Card>

      {/* Section 4 — trust signals */}
      <div className="mt-14 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 border-y border-surface-border py-6 text-center">
        {TRUST_SIGNALS.map((signal) => (
          <span key={signal} className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-teal-500" />
            {signal}
          </span>
        ))}
      </div>

      {/* Section 5 — FAQ */}
      <div className="mt-14 pb-4">
        <h2 className="text-lg font-semibold">Frequently asked questions</h2>
        <div className="mt-4 grid gap-5 sm:grid-cols-3">
          {FAQS.map((faq) => (
            <Card key={faq.question} className="rounded-[12px] p-5">
              <p className="text-sm font-semibold text-foreground">{faq.question}</p>
              <p className="mt-2 text-sm text-muted-foreground">{faq.answer}</p>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}

export default function BillingPage() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <AppHeader />
        <Suspense fallback={null}>
          <BillingContent />
        </Suspense>
      </div>
    </ProtectedRoute>
  );
}
