"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Calendar, ClipboardList, FileBarChart, Factory, Loader2, MapPin, Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DraftBadge, SubmittedBadge } from "@/components/ui/draft-badge";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppHeader } from "@/components/layout/app-header";
import { activityDataApi, brsrApi, facilityApi, ApiError } from "@/lib/api";
import type { Facility, ActivityData, BrsrCoreReport } from "@/lib/types";
import { FACILITY_TYPE_OPTIONS, PRODUCTION_ROUTE_OPTIONS } from "@/lib/constants";

const labelFor = (options: readonly { value: string; label: string }[], value: string) =>
  options.find((o) => o.value === value)?.label ?? value;

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

function FacilityDetailContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [facility, setFacility] = useState<Facility | null>(null);
  const [entries, setEntries] = useState<ActivityData[] | null>(null);
  const [brsrReports, setBrsrReports] = useState<BrsrCoreReport[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    Promise.all([facilityApi.get(params.id), activityDataApi.list(params.id), brsrApi.list(params.id)])
      .then(([facilityRes, entriesRes, brsrRes]) => {
        setFacility(facilityRes.facility);
        setEntries(entriesRes.entries);
        setBrsrReports(brsrRes.reports);
      })
      .catch(() => setError("Couldn't load this facility. It may not exist or you may not have access."));
  }, [params.id]);

  const handleDeleteFacility = async () => {
    if (!confirm(`Delete "${facility?.name}"? This removes all its activity data and cannot be undone.`)) {
      return;
    }
    setDeleting(true);
    try {
      await facilityApi.remove(params.id);
      router.push("/facilities");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't delete this facility.");
      setDeleting(false);
    }
  };

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

  if (!facility || !entries || !brsrReports) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-surface-border bg-surface-raised">
              <Factory className="h-5 w-5 text-teal-500" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold">{facility.name}</h1>
                {facility.isDraft && <DraftBadge />}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {facility.facilityType ? labelFor(FACILITY_TYPE_OPTIONS, facility.facilityType) : "—"} ·{" "}
                {facility.productionRoute ? labelFor(PRODUCTION_ROUTE_OPTIONS, facility.productionRoute) : "—"}
              </p>
              {(facility.district || facility.state) && (
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {[facility.district, facility.state, facility.pincode].filter(Boolean).join(", ")}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="danger" size="sm" onClick={handleDeleteFacility} isLoading={deleting}>
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
            <Link href={`/facilities/${facility.id}/edit`}>
              <Button variant="secondary" size="sm">
                Edit
              </Button>
            </Link>
            <Link href={`/facilities/${facility.id}/data-entry/new`}>
              <Button size="sm">
                <Plus className="h-4 w-4" />
                Add data entry
              </Button>
            </Link>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Installed capacity" value={facility.installedCapacityTpa ? `${facility.installedCapacityTpa.toLocaleString("en-IN")} tpa` : "—"} />
          <StatCard label="Commissioned" value={facility.commissioningYear?.toString() ?? "—"} />
          <StatCard label="Data entries" value={entries.length.toString()} />
          <StatCard label="Products" value={facility.productsManufactured.join(", ") || "—"} />
        </div>

        <h2 className="mt-10 mb-4 text-lg font-semibold">Activity data</h2>

        {entries.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 p-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-surface-border bg-surface-raised">
              <ClipboardList className="h-5 w-5 text-teal-500" />
            </span>
            <h3 className="font-medium">No activity data yet</h3>
            <p className="max-w-sm text-sm text-muted-foreground">
              Add fuel, process material, precursor, and production data for a reporting period to calculate
              CBAM and CCTS emissions.
            </p>
            <Link href={`/facilities/${facility.id}/data-entry/new`} className="mt-2">
              <Button size="sm">
                <Plus className="h-4 w-4" />
                Add data entry
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => {
              const isDraft = entry.status === "DRAFT";
              const href = isDraft
                ? `/facilities/${facility.id}/data-entry/${entry.id}/edit`
                : `/facilities/${facility.id}/data-entry/${entry.id}`;
              return (
                <Link key={entry.id} href={href}>
                  <Card className="flex flex-col gap-3 p-5 transition-colors hover:border-teal-500/40 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <Calendar className="h-3.5 w-3.5 text-muted" />
                        {formatDate(entry.periodStart)} – {formatDate(entry.periodEnd)}
                        {isDraft ? <DraftBadge /> : <SubmittedBadge />}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {entry.productCategory ?? "Untitled"} ·{" "}
                        {entry.productionQuantityT != null ? entry.productionQuantityT.toLocaleString("en-IN") : "—"}{" "}
                        t produced
                      </p>
                    </div>
                    {entry.calculationResult ? (
                      <div className="flex gap-6">
                        <Metric label="CBAM SEE" value={`${entry.calculationResult.specificEmbeddedEmissionsCbam.toFixed(3)} tCO2e/t`} />
                        <Metric label="CCTS intensity" value={`${entry.calculationResult.ghgIntensityCcts.toFixed(3)} tCO2e/t`} />
                      </div>
                    ) : (
                      <span className="text-xs text-muted">{isDraft ? "Not yet submitted" : "Not yet calculated"}</span>
                    )}
                  </Card>
                </Link>
              );
            })}
          </div>
        )}

        <div className="mt-10 mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">BRSR Core disclosures</h2>
          <Link href={`/facilities/${facility.id}/brsr/new`}>
            <Button size="sm" variant="secondary">
              <Plus className="h-4 w-4" />
              Add BRSR Core disclosure
            </Button>
          </Link>
        </div>

        {brsrReports.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 p-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-surface-border bg-surface-raised">
              <FileBarChart className="h-5 w-5 text-teal-500" />
            </span>
            <h3 className="font-medium">No BRSR Core disclosures yet</h3>
            <p className="max-w-sm text-sm text-muted-foreground">
              Disclose the 9 BRSR Core ESG attributes for a financial year — the GHG figure is reused automatically
              from this facility&apos;s activity data above.
            </p>
            <Link href={`/facilities/${facility.id}/brsr/new`} className="mt-2">
              <Button size="sm" variant="secondary">
                <Plus className="h-4 w-4" />
                Add BRSR Core disclosure
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="space-y-3">
            {brsrReports.map((report) => {
              const isDraft = report.status === "DRAFT";
              const href = isDraft
                ? `/facilities/${facility.id}/brsr/${encodeURIComponent(report.reportingPeriod)}/edit`
                : `/facilities/${facility.id}/brsr/${encodeURIComponent(report.reportingPeriod)}`;
              return (
                <Link key={report.id} href={href}>
                  <Card className="flex flex-col gap-3 p-5 transition-colors hover:border-teal-500/40 sm:flex-row sm:items-center sm:justify-between">
                    <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <FileBarChart className="h-3.5 w-3.5 text-muted" />
                      {report.reportingPeriod}
                      {isDraft ? <DraftBadge /> : <SubmittedBadge />}
                    </p>
                    <span className="text-xs text-muted">{isDraft ? "Not yet submitted" : "View report & download PDF"}</span>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-medium text-foreground">{value}</p>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-teal-500">{value}</p>
    </div>
  );
}

export default function FacilityDetailPage() {
  return (
    <ProtectedRoute>
      <FacilityDetailContent />
    </ProtectedRoute>
  );
}
