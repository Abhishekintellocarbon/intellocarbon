"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ClipboardList, Loader2 } from "lucide-react";
import { InternalRoute } from "@/components/auth/internal-route";
import { AppHeader } from "@/components/layout/app-header";
import { ActivityDataForm } from "@/components/activity-data/activity-data-form";
import { DraftBadge } from "@/components/ui/draft-badge";
import { activityDataApi } from "@/lib/api";
import type { ActivityData } from "@/lib/types";

function ContinueInternalActivityDataContent() {
  const params = useParams<{ facilityId: string; dataId: string }>();
  const router = useRouter();
  const [entry, setEntry] = useState<ActivityData | null>(null);

  useEffect(() => {
    activityDataApi
      .get(params.facilityId, params.dataId)
      .then(({ entry }) => setEntry(entry))
      .catch(() => router.replace(`/internal-data-entry/${params.facilityId}`));
  }, [params.facilityId, params.dataId, router]);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-8 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-teal-blue">
            <ClipboardList className="h-5 w-5 text-[#06120F]" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold">Continue activity data</h1>
              <DraftBadge />
            </div>
            <p className="text-sm text-muted-foreground">
              Pick up where you left off — everything you&apos;ve entered so far is already filled in.
            </p>
          </div>
        </div>

        {!entry ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
          </div>
        ) : (
          <ActivityDataForm
            facilityId={params.facilityId}
            existingEntry={entry}
            onSubmitted={() => router.push(`/internal-data-entry/${params.facilityId}`)}
          />
        )}
      </main>
    </div>
  );
}

export default function ContinueInternalActivityDataPage() {
  return (
    <InternalRoute>
      <ContinueInternalActivityDataContent />
    </InternalRoute>
  );
}
