"use client";

import { useRouter } from "next/navigation";
import { SuperAdminRoute } from "@/components/auth/super-admin-route";
import { AppHeader } from "@/components/layout/app-header";
import { AdminTabs } from "@/components/admin/admin-tabs";
import { GhgEngagementForm } from "@/components/ghg-runner/ghg-engagement-form";

function NewGhgEngagementContent() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <AdminTabs />
        <h1 className="mt-6 text-2xl font-semibold">New GHG Engagement</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter the client organization&apos;s details and activity data manually — this is saved as a draft first.
        </p>
        <div className="mt-8">
          <GhgEngagementForm onSaved={(engagement) => router.push(`/admin/ghg-runner/${engagement.id}`)} />
        </div>
      </main>
    </div>
  );
}

export default function NewGhgEngagementPage() {
  return (
    <SuperAdminRoute>
      <NewGhgEngagementContent />
    </SuperAdminRoute>
  );
}
