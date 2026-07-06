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
  "Built on ISO 14064-aligned verification methodology",
  // DPIIT Startup India registration is still pending — do not re-add this claim
  // until it's actually filed and granted.
  "Fully aligned with current CBAM and CCTS regulations — updated automatically as rules change",
  "Data hosted securely in India",
  "Long-term data retention as per regulatory requirements",
];

const FAQS = [
  {
    question: "Can I change plans later?",
    answer:
      "Yes — switch between CCTS Compliance, CBAM Compliance, or CBAM + CCTS at any time from this page. Your new plan takes effect immediately, and billing is prorated for the current cycle.",
  },
  {
    question: "What happens if I add a facility mid-month?",
    answer:
      "Pricing is per facility, per month. Adding a facility increases your monthly charge starting from your next billing cycle — no separate contract or approval needed.",
  },
  {
    question: "Do prices include GST?",
    answer: "Listed prices are exclusive of GST. Applicable GST is added at checkout and shown on your invoice.",
  },
];

const PLAN_ORDER_CLASS: Record<string, string> = {
  CCTS_COMPLIANCE: "sm:order-1",
  CBAM_PLUS_CCTS: "sm:order-2",
  CBAM_COMPLIANCE: "sm:order-3",
  BRSR_CORE_REPORTING: "sm:order-4",
};

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
        PLAN_ORDER_CLASS[plan.tier],
        plan.highlight ? "border-teal-500/60 shadow-glow sm:z-10 sm:-translate-y-2 sm:p-7" : "",
      )}
    >
      {plan.highlight && (
        <span className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-gradient-teal-blue px-3 py-1 text-xs font-semibold text-[#06120F]">
          <Sparkles className="h-3 w-3" /> Most Recommended
        </span>
      )}
      {isCurrent && (
        <span className="mb-3 inline-flex w-fit items-center gap-1 rounded-full bg-teal-500/10 px-2.5 py-1 text-xs font-semibold text-teal-500">
          <Check className="h-3 w-3" /> Current plan
        </span>
      )}

      <div className="flex items-center gap-2">
        <h3 className="text-lg font-semibold">{plan.name}</h3>
        {plan.tier === "BRSR_CORE_REPORTING" && (
          <span className="inline-flex items-center rounded-full border border-teal-500/30 bg-teal-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-500">
            New
          </span>
        )}
      </div>
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
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [usage, setUsage] = useState<{ facilityCount: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkingOutTier, setCheckingOutTier] = useState<SubscriptionTier | null>(null);
  const [cancelingTier, setCancelingTier] = useState<SubscriptionTier | null>(null);
  const [devBypassNotice, setDevBypassNotice] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const refresh = () =>
    billingApi
      .subscription()
      .then((data) => {
        setPlans(data.plans);
        setSubscriptions(data.subscriptions);
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

  const handleCancel = async (tier: SubscriptionTier) => {
    if (!confirm("Cancel this plan at the end of the current billing period?")) return;
    setCancelingTier(tier);
    try {
      await billingApi.cancel(tier);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't cancel subscription.");
    } finally {
      setCancelingTier(null);
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

      {subscriptions.length > 0 && (
        <div className="mt-6 space-y-3">
          {subscriptions.map((subscription) => (
            <Card
              key={subscription.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-[12px] p-5"
            >
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
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleCancel(subscription.tier)}
                  isLoading={cancelingTier === subscription.tier}
                >
                  Cancel plan
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Section 1 — plan cards */}
      {plans && (
        <>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => {
              const isCurrent = subscriptions.some((s) => s.tier === plan.tier && s.status === "ACTIVE");
              const isSwitchable = subscriptions.some((s) => s.status === "ACTIVE") && !isCurrent;
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

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-surface-border bg-surface-raised/40 px-5 py-3 text-sm">
            <span className="text-muted-foreground">
              Have more than 5 facilities? Get in touch — custom enterprise pricing available.
            </span>
            <a href="mailto:sales@intellocarbon.com" className="shrink-0 font-medium text-teal-500 hover:underline">
              Contact us
            </a>
          </div>
        </>
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

      {/* Section 3 — FAQ */}
      <div id="faq" className="mt-14 scroll-mt-24">
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

      {/* Section 4 — trust signals */}
      <div className="mt-14 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 border-y border-surface-border py-6 text-center">
        {TRUST_SIGNALS.map((signal) => (
          <span key={signal} className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-teal-500" />
            {signal}
          </span>
        ))}
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
