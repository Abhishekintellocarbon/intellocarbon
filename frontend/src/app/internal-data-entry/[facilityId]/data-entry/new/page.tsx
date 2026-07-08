"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ClipboardList, Loader2 } from "lucide-react";
import { InternalRoute } from "@/components/auth/internal-route";
import { AppHeader } from "@/components/layout/app-header";
import { ActivityDataForm } from "@/components/activity-data/activity-data-form";
import { internalDataEntryApi } from "@/lib/api";
import type { Sector } from "@/lib/types";

function NewInternalActivityDataContent() {
  const params = useParams<{ facilityId: string }>();
  const router = useRouter();
  const [sector, setSector] = useState<Sector | null>(null);

  useEffect(() => {
    internalDataEntryApi
      .getFacility(params.facilityId)
      .then(({ facility }) => setSector(facility.sector))
      .catch(() => router.replace("/internal-data-entry"));
  }, [params.facilityId, router]);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-8 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-teal-blue">
            <ClipboardList className="h-5 w-5 text-[#06120F]" />
          </span>
          <div>
            <h1 className="text-xl font-semibold">Add activity data</h1>
            <p className="text-sm text-muted-foreground">
              Enter fuel, material, and production data for a reporting period.
            </p>
          </div>
        </div>

        {sector === null ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
          </div>
        ) : (
          <ActivityDataForm
            facilityId={params.facilityId}
            sectorOverride={sector}
            onSubmitted={() => router.push(`/internal-data-entry/${params.facilityId}`)}
          />
        )}
      </main>
    </div>
  );
}

export default function NewInternalActivityDataPage() {
  return (
    <InternalRoute>
      <NewInternalActivityDataContent />
    </InternalRoute>
  );
}
