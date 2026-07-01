"use client";

import { useParams } from "next/navigation";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppHeader } from "@/components/layout/app-header";
import { ResultsView } from "@/components/activity-data/results-view";

function DataEntryResultsContent() {
  const params = useParams<{ id: string; dataId: string }>();

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <ResultsView facilityId={params.id} dataId={params.dataId} />
      </main>
    </div>
  );
}

export default function DataEntryResultsPage() {
  return (
    <ProtectedRoute>
      <DataEntryResultsContent />
    </ProtectedRoute>
  );
}
