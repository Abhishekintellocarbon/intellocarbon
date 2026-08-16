"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Globe2, Factory, Loader2, MapPin, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppHeader } from "@/components/layout/app-header";
import { facilityApi } from "@/lib/api";
import type { Facility } from "@/lib/types";

function CsrdFacilitySelectorContent() {
  const router = useRouter();
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

      <main className="mx-auto max-w-4xl px-6 py-10">
        <Link
          href="/esg/overview"
          className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-teal-500"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to ESG Overview
        </Link>

        <div className="mb-8 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-teal-blue">
            <Globe2 className="h-5 w-5 text-[#06120F]" />
          </span>
          <div>
            <h1 className="text-xl font-semibold">GRI Standards 2021 report</h1>
            <p className="text-sm text-muted-foreground">
              Pick a facility. You&apos;ll start with the GRI 3 materiality assessment, which determines which Topic
              Standards the report covers.
            </p>
          </div>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        {!facilities && !error && (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
          </div>
        )}

        {facilities && facilities.length === 0 && (
          <Card className="flex flex-col items-center gap-3 p-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-surface-border bg-surface-raised">
              <Factory className="h-5 w-5 text-teal-500" />
            </span>
            <h3 className="font-medium">No facilities yet</h3>
            <p className="max-w-sm text-sm text-muted-foreground">
              Add a facility first — GRI reports are prepared per facility, and reuse that facility&apos;s existing
              emissions, energy and water data automatically.
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
          <div className="grid gap-4 sm:grid-cols-2">
            {facilities.map((facility) => (
              <Card
                key={facility.id}
                role="button"
                tabIndex={0}
                onClick={() => router.push(`/facilities/${facility.id}/csrd/new`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") router.push(`/facilities/${facility.id}/csrd/new`);
                }}
                className="cursor-pointer p-6 transition-colors hover:border-teal-500/40"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-surface-border bg-surface-raised">
                    <Factory className="h-4 w-4 text-teal-500" />
                  </span>
                  <div>
                    <h3 className="font-medium">{facility.name}</h3>
                    {(facility.district || facility.state) && (
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {[facility.district, facility.state].filter(Boolean).join(", ")}
                      </p>
                    )}
                  </div>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Already have a GRI report for this facility?{" "}
                  <Link
                    href={`/facilities/${facility.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="font-medium text-teal-500 hover:text-teal-400"
                  >
                    View them
                  </Link>
                </p>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default function CsrdFacilitySelectorPage() {
  return (
    <ProtectedRoute>
      <CsrdFacilitySelectorContent />
    </ProtectedRoute>
  );
}
