"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Building2, CreditCard, Factory, Loader2, MapPin, Plus, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { DraftBadge } from "@/components/ui/draft-badge";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppHeader } from "@/components/layout/app-header";
import { PlanBanner } from "@/components/billing/plan-banner";
import { AnalyticsSection } from "@/components/dashboard/analytics-section";
import { useAuth } from "@/context/auth-context";
import { billingApi, companyApi, facilityApi } from "@/lib/api";
import type { Company, Facility, Subscription } from "@/lib/types";
import { FACILITY_TYPE_OPTIONS, SECTOR_OPTIONS } from "@/lib/constants";

const labelFor = (options: readonly { value: string; label: string }[], value: string) =>
  options.find((o) => o.value === value)?.label ?? value;

function DashboardContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [showForbiddenBanner, setShowForbiddenBanner] = useState(searchParams.get("error") === "403");
  const [company, setCompany] = useState<Company | null | undefined>(undefined);
  const [facilities, setFacilities] = useState<Facility[] | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[] | undefined>(undefined);

  useEffect(() => {
    companyApi
      .getMine()
      .then(({ company }) => {
        setCompany(company);
        if (company) {
          facilityApi.list().then(({ facilities }) => setFacilities(facilities));
          billingApi.subscription().then(({ subscriptions }) => setSubscriptions(subscriptions));
        }
      })
      .catch(() => setCompany(null));
  }, []);

  const hasActiveSubscription = Boolean(subscriptions?.some((s) => s.status === "ACTIVE"));
  const hasPastDueSubscription = Boolean(subscriptions?.some((s) => s.status === "PAST_DUE"));

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-2xl font-semibold">
          Welcome{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Your compliance and emissions workspace.
        </p>

        {showForbiddenBanner && (
          <div className="mt-6">
            <Alert variant="error">
              <div className="flex items-center justify-between gap-3">
                <span>403 — You don&apos;t have access to the Super Admin dashboard.</span>
                <button
                  type="button"
                  onClick={() => setShowForbiddenBanner(false)}
                  aria-label="Dismiss"
                  className="shrink-0 text-danger transition-opacity hover:opacity-80"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </Alert>
          </div>
        )}

        {company === undefined && (
          <div className="mt-16 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
          </div>
        )}

        {company === null && (
          <Card className="mt-8 flex flex-col items-center gap-3 p-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-surface-border bg-surface-raised">
              <Building2 className="h-5 w-5 text-teal-500" />
            </span>
            <h3 className="text-lg font-medium">Set up your company to get started</h3>
            <p className="max-w-md text-sm text-muted-foreground">
              Tell us about your company and which compliance schemes apply — it takes about two minutes.
            </p>
            <Link href="/onboarding/company" className="mt-2">
              <Button>
                Set up company
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </Card>
        )}

        {company && (
          <>
            <PlanBanner facilityCount={facilities?.length ?? 0} />

            <Card className="mt-8 p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Company</p>
                  <h2 className="text-lg font-semibold">{company.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {labelFor(SECTOR_OPTIONS, company.sector)}
                    {company.subSector ? ` — ${company.subSector}` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  {company.appliesCbam && <SchemeBadge label="EU CBAM" />}
                  {company.appliesCcts && <SchemeBadge label="India CCTS" />}
                  {/* PAT badge removed from UI — out of current product scope. */}
                </div>
              </div>
            </Card>

            {subscriptions !== undefined && !hasActiveSubscription && (
              <Card className="mt-6 flex flex-col items-center gap-3 p-12 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full border border-surface-border bg-surface-raised">
                  <CreditCard className="h-5 w-5 text-teal-500" />
                </span>
                <h3 className="font-medium">Subscribe to add facilities</h3>
                <p className="max-w-sm text-sm text-muted-foreground">
                  {hasPastDueSubscription
                    ? "Your last payment failed. Update your billing details to keep access."
                    : "An active subscription is required before you can add facilities and generate reports."}
                </p>
                <Link href="/billing" className="mt-2">
                  <Button size="sm">
                    View plans
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </Card>
            )}

            <div className="mt-8 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Facilities</h2>
              <Link href="/facilities">
                <Button variant="secondary" size="sm">
                  View all
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>

            {facilities === null && (
              <div className="mt-8 flex justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
              </div>
            )}

            {facilities && facilities.length === 0 && (
              <Card className="mt-4 flex flex-col items-center gap-3 p-12 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full border border-surface-border bg-surface-raised">
                  <Factory className="h-5 w-5 text-teal-500" />
                </span>
                <h3 className="font-medium">Add your first facility</h3>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Facilities are where you enter activity data and calculate CBAM / CCTS emissions.
                </p>
                <Link href="/facilities/new?onboarding=1" className="mt-2">
                  <Button size="sm">
                    <Plus className="h-4 w-4" />
                    Add facility
                  </Button>
                </Link>
              </Card>
            )}

            {facilities && facilities.length > 0 && (
              <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {facilities.slice(0, 3).map((facility) => (
                  <Link key={facility.id} href={`/facilities/${facility.id}`}>
                    <Card className="h-full p-6 transition-colors hover:border-teal-500/40">
                      <div className="flex items-start justify-between">
                        <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-surface-border bg-surface-raised">
                          <Factory className="h-5 w-5 text-teal-500" />
                        </span>
                        {facility.isDraft && <DraftBadge />}
                      </div>
                      <h3 className="mt-4 font-medium">{facility.name}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {facility.facilityType ? labelFor(FACILITY_TYPE_OPTIONS, facility.facilityType) : "—"}
                      </p>
                      {(facility.district || facility.state) && (
                        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {[facility.district, facility.state].filter(Boolean).join(", ")}
                        </p>
                      )}
                    </Card>
                  </Link>
                ))}
              </div>
            )}

            {facilities && facilities.length > 0 && <AnalyticsSection />}
          </>
        )}
      </main>
    </div>
  );
}

function SchemeBadge({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-teal-500/30 bg-teal-500/10 px-2.5 py-1 text-xs font-medium text-teal-500">
      {label}
    </span>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <Suspense fallback={null}>
        <DashboardContent />
      </Suspense>
    </ProtectedRoute>
  );
}
