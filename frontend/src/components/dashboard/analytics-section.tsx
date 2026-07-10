"use client";

import { useEffect, useState } from "react";
import { companyApi } from "@/lib/api";
import type { CompanyDashboardAnalytics } from "@/lib/types";
import { ChartSkeleton } from "./shared/chart-skeleton";
import { EmissionsTrendChart } from "./emissions-trend-chart";
import { LiabilityTrendChart } from "./liability-trend-chart";
import { EmissionsCompositionChart } from "./emissions-composition-chart";
import { CctsIntensityGauge } from "./ccts-intensity-gauge";
import { FacilityComparisonChart } from "./facility-comparison-chart";
import { YearOverYearCard } from "./year-over-year-card";

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
    </div>
  );
}
