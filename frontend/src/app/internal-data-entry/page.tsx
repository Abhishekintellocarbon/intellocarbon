"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Factory, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EvidencePendingBadge } from "@/components/ui/evidence-pending-badge";
import { InternalRoute } from "@/components/auth/internal-route";
import { AppHeader } from "@/components/layout/app-header";
import { internalDataEntryApi } from "@/lib/api";
import type { InternalAssignedFacility } from "@/lib/types";
import { useAuth } from "@/context/auth-context";

function InternalDataEntryContent() {
  const { user } = useAuth();
  const [facilities, setFacilities] = useState<InternalAssignedFacility[] | null>(null);

  useEffect(() => {
    internalDataEntryApi.listFacilities().then(({ facilities }) => setFacilities(facilities));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-semibold">My Assigned Facilities</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Welcome{user?.name ? `, ${user.name.split(" ")[0]}` : ""}. Enter activity data and supporting
          evidence for the facilities assigned to you.
        </p>

        {facilities === null && (
          <div className="mt-10 flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
          </div>
        )}

        {facilities && facilities.length === 0 && (
          <Card className="mt-8 flex flex-col items-center gap-2 p-10 text-center">
            <Building2 className="h-5 w-5 text-teal-500" />
            <p className="text-sm text-muted-foreground">No facilities have been assigned to you yet.</p>
          </Card>
        )}

        {facilities && facilities.length > 0 && (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {facilities.map((f) => (
              <Link key={f.id} href={`/internal-data-entry/${f.id}`}>
                <Card className="h-full p-5 transition-colors hover:border-teal-500/40">
                  <div className="flex items-start justify-between">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-surface-border bg-surface-raised">
                      <Factory className="h-4 w-4 text-teal-500" />
                    </span>
                    {f.evidencePending && <EvidencePendingBadge />}
                  </div>
                  <h3 className="mt-3 font-medium text-foreground">{f.name}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">{f.company.name}</p>
                  <p className="mt-2 text-xs text-muted">{f.sector}</p>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default function InternalDataEntryPage() {
  return (
    <InternalRoute>
      <InternalDataEntryContent />
    </InternalRoute>
  );
}
