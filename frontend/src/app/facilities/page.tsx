"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Factory, Loader2, MapPin, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DraftBadge } from "@/components/ui/draft-badge";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppHeader } from "@/components/layout/app-header";
import { facilityApi } from "@/lib/api";
import type { Facility } from "@/lib/types";
import { FACILITY_TYPE_OPTIONS, PRODUCTION_ROUTE_OPTIONS } from "@/lib/constants";

const labelFor = (options: readonly { value: string; label: string }[], value: string) =>
  options.find((o) => o.value === value)?.label ?? value;

function FacilitiesContent() {
  const [facilities, setFacilities] = useState<Facility[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    facilityApi
      .list()
      .then(({ facilities }) => setFacilities(facilities))
      .catch(() => setError("Couldn't load facilities. Please refresh the page."));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Facilities</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Plants and mills where you track activity data and emissions.
            </p>
          </div>
          <Link href="/facilities/new">
            <Button size="sm">
              <Plus className="h-4 w-4" />
              Add facility
            </Button>
          </Link>
        </div>

        {error && <p className="mt-8 text-sm text-danger">{error}</p>}

        {!facilities && !error && (
          <div className="mt-16 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
          </div>
        )}

        {facilities && facilities.length === 0 && (
          <Card className="mt-8 flex flex-col items-center gap-3 p-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-surface-border bg-surface-raised">
              <Factory className="h-5 w-5 text-teal-500" />
            </span>
            <h3 className="font-medium">No facilities yet</h3>
            <p className="max-w-sm text-sm text-muted-foreground">
              Add your first plant or mill to start entering activity data and calculating emissions.
            </p>
            <Link href="/facilities/new" className="mt-2">
              <Button size="sm">
                <Plus className="h-4 w-4" />
                Add facility
              </Button>
            </Link>
          </Card>
        )}

        {facilities && facilities.length > 0 && (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {facilities.map((facility) => (
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
                  <p className="mt-0.5 text-xs text-muted">
                    {facility.productionRoute ? labelFor(PRODUCTION_ROUTE_OPTIONS, facility.productionRoute) : "—"}
                  </p>
                  {(facility.district || facility.state) && (
                    <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {[facility.district, facility.state].filter(Boolean).join(", ")}
                    </p>
                  )}
                  <p className="mt-4 border-t border-surface-border pt-3 text-xs text-muted-foreground">
                    {facility._count?.activityData ?? 0} activity data{" "}
                    {facility._count?.activityData === 1 ? "entry" : "entries"}
                  </p>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default function FacilitiesPage() {
  return (
    <ProtectedRoute>
      <FacilitiesContent />
    </ProtectedRoute>
  );
}
