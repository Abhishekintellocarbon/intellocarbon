"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Factory, Loader2 } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppHeader } from "@/components/layout/app-header";
import { ComplianceStatusStrip } from "@/components/facilities/dashboard/compliance-status-strip";
import { DeadlineCountdown } from "@/components/facilities/dashboard/deadline-countdown";
import { EmissionsBreakdownChart } from "@/components/facilities/dashboard/emissions-breakdown-chart";
import { LiabilityTrendChart } from "@/components/facilities/dashboard/liability-trend-chart";
import { IntensityTrendChart } from "@/components/facilities/dashboard/intensity-trend-chart";
import { RecentActivityFeed } from "@/components/facilities/dashboard/recent-activity-feed";
import { GenerateReportButton } from "@/components/facilities/dashboard/generate-report-button";
import { EvidencePendingBanner } from "@/components/facilities/dashboard/evidence-pending-banner";
import { OpenQueriesSection } from "@/components/facilities/dashboard/open-queries-section";
import { computeDashboardAccess } from "@/components/facilities/dashboard/dashboard-access";
import { billingApi, facilityApi } from "@/lib/api";
import type { Facility, FacilityDashboard as FacilityDashboardData, PlanDefinition, Subscription } from "@/lib/types";

function FacilityDashboardContent() {
  const params = useParams<{ id: string }>();
  const [facility, setFacility] = useState<Facility | null>(null);
  const [dashboard, setDashboard] = useState<FacilityDashboardData | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[] | null>(null);
  const [plans, setPlans] = useState<PlanDefinition[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([facilityApi.get(params.id), facilityApi.dashboard(params.id), billingApi.subscription()])
      .then(([facilityRes, dashboardRes, billingRes]) => {
        setFacility(facilityRes.facility);
        setDashboard(dashboardRes.dashboard);
        setSubscriptions(billingRes.subscriptions);
        setPlans(billingRes.plans);
      })
      .catch(() => setError("Couldn't load this facility's dashboard. It may not exist or you may not have access."));
  }, [params.id]);

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="mx-auto max-w-6xl px-6 py-10">
          <p className="text-sm text-danger">{error}</p>
          <Link href="/facilities" className="mt-4 inline-block text-sm text-teal-500 hover:text-teal-400">
            Back to facilities
          </Link>
        </main>
      </div>
    );
  }

  if (!facility || !dashboard || !subscriptions || !plans) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
        </div>
      </div>
    );
  }

  const access = computeDashboardAccess(subscriptions);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-surface-border bg-surface-raised">
              <Factory className="h-5 w-5 text-teal-500" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold">{facility.name} — Dashboard</h1>
              <p className="mt-1 text-sm text-muted-foreground">Compliance status, deadlines, and emissions trends for this facility.</p>
            </div>
          </div>
          <GenerateReportButton facilityId={facility.id} disabled={dashboard.hasEvidencePendingSubmissions} />
        </div>
        <Link href={`/facilities/${facility.id}`} className="mt-2 inline-block text-sm text-teal-500 hover:text-teal-400">
          Back to facility
        </Link>

        {dashboard.hasEvidencePendingSubmissions && (
          <div className="mt-6">
            <EvidencePendingBanner facilityId={facility.id} />
          </div>
        )}

        <div className="mt-8 space-y-8">
          <OpenQueriesSection facilityId={facility.id} />
          <ComplianceStatusStrip dashboard={dashboard} facilityId={facility.id} access={access} plans={plans} />
          <DeadlineCountdown dashboard={dashboard} access={access} />
          <EmissionsBreakdownChart dashboard={dashboard} facilityId={facility.id} />
          <LiabilityTrendChart dashboard={dashboard} facilityId={facility.id} />
          <IntensityTrendChart dashboard={dashboard} facilityId={facility.id} />
          <RecentActivityFeed dashboard={dashboard} />
        </div>
      </main>
    </div>
  );
}

export default function FacilityDashboardPage() {
  return (
    <ProtectedRoute>
      <FacilityDashboardContent />
    </ProtectedRoute>
  );
}
