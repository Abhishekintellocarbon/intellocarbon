"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CreditCard, Leaf } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppHeader } from "@/components/layout/app-header";
import { ChartSkeleton } from "@/components/dashboard/shared/chart-skeleton";
import { DisclosureCompletenessStrip } from "@/components/dashboard/esg/disclosure-completeness-strip";
import { LivePositionPanel } from "@/components/dashboard/esg/live-position-panel";
import { IssbSummaryCard } from "@/components/dashboard/esg/issb-summary-card";
import { GriSummaryCard } from "@/components/dashboard/esg/gri-summary-card";
import { Scope3BreakdownChart } from "@/components/dashboard/esg/scope3-breakdown-chart";
import { WaterFootprintCard } from "@/components/dashboard/esg/water-footprint-card";
import { CircularityCard } from "@/components/dashboard/esg/circularity-card";
import { EnergyMixTrendCard } from "@/components/dashboard/esg/energy-mix-trend-card";
import { OffsetsSummaryCard } from "@/components/dashboard/esg/offsets-summary-card";
import { WaterTrendChart } from "@/components/dashboard/brsr/water-trend-chart";
import { WasteTrendChart } from "@/components/dashboard/brsr/waste-trend-chart";
import { EnergyCompositionChart } from "@/components/dashboard/brsr/energy-composition-chart";
import { GenderDiversityChart } from "@/components/dashboard/brsr/gender-diversity-chart";
import { SafetyIncidentCard } from "@/components/dashboard/brsr/safety-incident-card";
import { BrsrFacilityComparisonChart } from "@/components/dashboard/brsr/facility-comparison-chart";
import { ApiError, companyApi } from "@/lib/api";
import type { EsgOverview } from "@/lib/types";

/**
 * Unified ESG Overview — the default landing view for a company on the ESG
 * Disclosure Bundle, compiling BRSR Core, ISSB IFRS S1/S2, GRI Standards
 * 2021 and Scope 3 into one command center.
 *
 * Every chart here is an existing component rendered against an existing
 * aggregate; this page adds composition and the cross-framework completeness
 * strip, not new analytics. The per-framework pages remain reachable as
 * drill-downs from the strip's cards.
 */

function NotSubscribed() {
  return (
    <Card className="mt-8 flex flex-col items-center gap-3 p-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full border border-surface-border bg-surface-raised">
        <CreditCard className="h-5 w-5 text-teal-500" />
      </span>
      <h3 className="font-medium">ESG Disclosure Bundle required</h3>
      <p className="max-w-sm text-sm text-muted-foreground">
        BRSR Core, ISSB IFRS S1/S2, GRI Standards 2021 and Scope 3 reporting are covered by the ESG Disclosure
        Bundle. Subscribe to unlock this overview.
      </p>
      <Link href="/billing" className="mt-2">
        <Button size="sm">
          View plans
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </Link>
    </Card>
  );
}

function EsgOverviewContent() {
  const [overview, setOverview] = useState<EsgOverview | null>(null);
  const [notSubscribed, setNotSubscribed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    companyApi
      .esgOverview()
      .then(({ overview }) => setOverview(overview))
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.code === "ESG_BUNDLE_NOT_SUBSCRIBED") {
          setNotSubscribed(true);
          return;
        }
        setError("Couldn't load your ESG overview. Please refresh the page.");
      });
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-teal-blue">
            <Leaf className="h-5 w-5 text-[#06120F]" />
          </span>
          <div>
            <h1 className="text-xl font-semibold">ESG Overview</h1>
            <p className="text-sm text-muted-foreground">
              BRSR Core, ISSB IFRS S1/S2, GRI Standards and Scope 3 across all your facilities.
            </p>
          </div>
        </div>

        {error && <p className="mt-8 text-sm text-danger">{error}</p>}
        {notSubscribed && <NotSubscribed />}

        {!overview && !error && !notSubscribed && (
          <div className="mt-8 grid gap-5 sm:grid-cols-3">
            <ChartSkeleton height={140} />
            <ChartSkeleton height={140} />
            <ChartSkeleton height={140} />
          </div>
        )}

        {overview && (
          <div className="mt-8 space-y-10">
            <DisclosureCompletenessStrip
              completeness={overview.completeness}
              currentFyLabel={overview.currentFyLabel}
            />

            <LivePositionPanel
              items={overview.livePosition}
              description="What's changed across your ESG disclosures, and what's coming up."
            />

            <section>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold">BRSR Core</h2>
                <Link href="/esg/brsr" className="text-sm font-medium text-teal-500 hover:text-teal-400">
                  Open BRSR Core
                </Link>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Water, waste, energy, and workforce trends across all your facilities.
              </p>

              <div className="mt-4 grid gap-5 sm:grid-cols-2">
                <WaterTrendChart data={overview.brsr.waterTrend} />
                <WasteTrendChart data={overview.brsr.wasteTrend} />
                <EnergyCompositionChart energy={overview.brsr.energyComposition} />
                <GenderDiversityChart gender={overview.brsr.genderDiversity} />
                <div className="sm:col-span-2">
                  <SafetyIncidentCard safety={overview.brsr.safetyIncidentRate} />
                </div>
                {overview.brsr.facilityComparison.length >= 2 && (
                  <div className="sm:col-span-2">
                    <BrsrFacilityComparisonChart data={overview.brsr.facilityComparison} />
                  </div>
                )}
              </div>
            </section>

            <section>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold">Water footprint</h2>
                <span className="text-xs text-muted-foreground">ISO 14046</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Withdrawal, consumption and discharge from the water inventory captured alongside your activity
                data — same reporting periods and production quantities as your GHG figures.
              </p>

              <div className="mt-4">
                <WaterFootprintCard water={overview.water} />
              </div>
            </section>

            <section>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold">Waste and circularity</h2>
                <span className="text-xs text-muted-foreground">GRI 306 / BRSR Core</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                How much of your waste is kept out of disposal, reused from the waste figures you have already
                disclosed. The card states which disclosure the rate was computed from.
              </p>

              <div className="mt-4">
                <CircularityCard circularity={overview.circularity} />
              </div>
            </section>

            <section>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold">Energy mix</h2>
                <span className="text-xs text-muted-foreground">BRSR Core / activity data</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Which way your renewable share is moving, not just where it stands today. The card states which
                energy basis the share was computed on.
              </p>

              <div className="mt-4">
                <EnergyMixTrendCard energyMix={overview.energyMix} />
              </div>
            </section>

            <section>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold">Climate-related disclosure</h2>
                <Link href="/esg/issb" className="text-sm font-medium text-teal-500 hover:text-teal-400">
                  Open ISSB IFRS S1/S2
                </Link>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                IFRS S1/S2 metrics and your Scope 3 value-chain inventory.
              </p>

              <div className="mt-4 grid gap-5 lg:grid-cols-2">
                <IssbSummaryCard issb={overview.issb} />
                <Scope3BreakdownChart scope3={overview.scope3} />
                <div className="lg:col-span-2">
                  <OffsetsSummaryCard offsets={overview.offsets} />
                </div>
              </div>
            </section>

            <section>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold">Sustainability reporting</h2>
                <Link href="/esg/gri" className="text-sm font-medium text-teal-500 hover:text-teal-400">
                  Open GRI Standards 2021
                </Link>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Material topics and content-index status per facility. Topic counts are shown as a union across
                facilities rather than a total — each facility&apos;s materiality assessment decides its own topics,
                so they are not additive.
              </p>

              <div className="mt-4">
                <GriSummaryCard gri={overview.gri} />
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

export default function EsgOverviewPage() {
  return (
    <ProtectedRoute>
      <EsgOverviewContent />
    </ProtectedRoute>
  );
}
