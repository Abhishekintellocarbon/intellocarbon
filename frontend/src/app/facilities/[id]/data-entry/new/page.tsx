"use client";

import { useParams } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppHeader } from "@/components/layout/app-header";
import { ActivityDataForm } from "@/components/activity-data/activity-data-form";

function NewActivityDataContent() {
  const params = useParams<{ id: string }>();

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

        <ActivityDataForm facilityId={params.id} />
      </main>
    </div>
  );
}

export default function NewActivityDataPage() {
  return (
    <ProtectedRoute>
      <NewActivityDataContent />
    </ProtectedRoute>
  );
}
