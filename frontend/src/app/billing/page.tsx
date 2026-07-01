"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Check, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppHeader } from "@/components/layout/app-header";
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

  const refresh = () =>
    billingApi
      .subscription()
      .then((data) => {
        setPlans(data.plans);
        setSubscription(data.subscription);
        setUsage(data.usage);
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
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-2xl font-semibold">
          {isOnboarding ? "Choose a plan to finish setup" : "Billing & plans"}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {isOnboarding
            ? "An active subscription is required before you can add facilities."
            : "Manage your Intellocarbon subscription."}
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
          <Card className="mt-6 flex flex-wrap items-center justify-between gap-4 p-5">
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
                {subscription.tier} plan
                {usage && ` · ${usage.facilityCount} facilit${usage.facilityCount === 1 ? "y" : "ies"} used`}
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

        {plans && (
          <div className="mt-8 grid gap-5 sm:grid-cols-3">
            {plans.map((plan) => {
              const isCurrent = subscription?.tier === plan.tier && subscription.status === "ACTIVE";
              return (
                <Card
                  key={plan.tier}
                  className={cn("flex flex-col p-6", isCurrent && "border-teal-500/50 shadow-glow")}
                >
                  {isCurrent && (
                    <span className="mb-3 inline-flex w-fit items-center gap-1 rounded-full bg-teal-500/10 px-2.5 py-1 text-xs font-semibold text-teal-500">
                      <Check className="h-3 w-3" /> Current plan
                    </span>
                  )}
                  <h3 className="text-lg font-semibold">{plan.name}</h3>
                  <p className="mt-1 text-2xl font-semibold text-gradient">{plan.priceLabel}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>
                  <ul className="mt-5 flex-1 space-y-2.5">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-foreground/90">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-500" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  {plan.priceInr === null ? (
                    <a href="mailto:sales@intellocarbon.com" className="mt-6">
                      <Button variant="secondary" className="w-full">
                        Contact sales
                      </Button>
                    </a>
                  ) : (
                    <Button
                      className="mt-6 w-full"
                      variant={isCurrent ? "secondary" : "primary"}
                      disabled={isCurrent}
                      isLoading={checkingOutTier === plan.tier}
                      onClick={() => handleSubscribe(plan.tier)}
                    >
                      {isCurrent ? "Active" : subscription?.status === "ACTIVE" ? "Switch plan" : "Subscribe"}
                    </Button>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

export default function BillingPage() {
  return (
    <ProtectedRoute>
      <Suspense fallback={null}>
        <BillingContent />
      </Suspense>
    </ProtectedRoute>
  );
}
