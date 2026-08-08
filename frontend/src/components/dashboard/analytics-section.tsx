"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { companyApi } from "@/lib/api";
import type { CompanyDashboardAnalytics } from "@/lib/types";
import { ChartSkeleton } from "./shared/chart-skeleton";
import { EmissionsTrendChart } from "./emissions-trend-chart";
import { LiabilityTrendChart } from "./liability-trend-chart";
import { EmissionsCompositionChart } from "./emissions-composition-chart";
import { CctsIntensityGauge } from "./ccts-intensity-gauge";
import { FacilityComparisonChart } from "./facility-comparison-chart";
import { YearOverYearCard } from "./year-over-year-card";
import { EsgBrsrSection } from "./brsr/esg-brsr-section";
import { LivePositionPanel } from "./esg/live-position-panel";

/**
 * Company-wide analytics — inserted below the existing dashboard summary
 * cards (Active Plan, Company info, Facilities list), which this never
 * touches. Fetches its own data independently so a slow/failed analytics
 * call can't block the rest of the dashboard from rendering.
 */
export function AnalyticsSection() {
  const [analytics, setAnalytics] = useState<CompanyDashboardAnalytics | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    companyApi
      .dashboard()
      .then(({ analytics }) => setAnalytics(analytics))
      .catch(() => setError(true));
  }, []);

  if (error) return null;

  return (
    <div className="mt-10">
      <h2 className="text-lg font-semibold">Analytics</h2>
      <p className="mt-1 text-sm text-muted-foreground">Emissions and compliance trends across all your facilities.</p>

      {!analytics ? (
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <ChartSkeleton />
          <ChartSkeleton />
          <ChartSkeleton height={110} />
          <ChartSkeleton height={110} />
        </div>
      ) : (
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <EmissionsTrendChart data={analytics.emissionsTrend} />
          <LiabilityTrendChart data={analytics.liabilityTrend} currentCertificatePrice={analytics.currentCertificatePrice} />
          <EmissionsCompositionChart composition={analytics.emissionsComposition} />
          <CctsIntensityGauge intensity={analytics.cctsIntensity} />
          {analytics.facilityComparison.length >= 2 && (
            <div className="sm:col-span-2">
              <FacilityComparisonChart data={analytics.facilityComparison} />
            </div>
          )}
          <div className="sm:col-span-2">
            <YearOverYearCard yearOverYear={analytics.yearOverYear} />
          </div>
        </div>
      )}

      {/* Company-wide live position — the per-facility dashboard has its own
          RecentActivityFeed, but this level had none. Rendered after the
          charts so the numbers stay above the fold. */}
      {analytics && (
        <div className="mt-10">
          <LivePositionPanel
            items={analytics.livePosition}
            description="What's changed across your CBAM and CCTS position, and what's coming up."
          />
        </div>
      )}

      {analytics?.brsr?.hasReports && (
        <>
          <EsgBrsrSection brsr={analytics.brsr} />
          <Link
            href="/esg/overview"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-teal-500 hover:text-teal-400"
          >
            Open the full ESG Overview
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </>
      )}
    </div>
  );
}
