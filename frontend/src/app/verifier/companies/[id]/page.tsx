"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Factory, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EvidencePendingBadge } from "@/components/ui/evidence-pending-badge";
import { VerifierRoute } from "@/components/auth/verifier-route";
import { AppHeader } from "@/components/layout/app-header";
import { verifierApi } from "@/lib/api";
import type { VerifierCompanyDetail } from "@/lib/types";

function VerifierCompanyDetailContent() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<VerifierCompanyDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    verifierApi
      .getCompany(params.id)
      .then(setData)
      .catch(() => setError("Couldn't load this company. It may not be assigned to you."));
  }, [params.id]);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <Link href="/verifier/dashboard" className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" />
          Back to dashboard
        </Link>

        {error && <p className="mt-6 text-sm text-danger">{error}</p>}

        {!data && !error && (
          <div className="mt-16 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
          </div>
        )}

        {data && (
          <>
            <h1 className="mt-4 text-2xl font-semibold">{data.company.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{data.company.sector}</p>

            <h2 className="mt-8 text-lg font-semibold">Facilities</h2>
            {data.facilities.length === 0 ? (
              <Card className="mt-4 p-8 text-center text-sm text-muted-foreground">
                No facilities have submitted anything for this company yet.
              </Card>
            ) : (
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {data.facilities.map((f) => (
                  <Link key={f.id} href={`/verifier/facilities/${f.id}`}>
                    <Card className="h-full p-5 transition-colors hover:border-teal-500/40">
                      <div className="flex items-start justify-between">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-surface-border bg-surface-raised">
                          <Factory className="h-4 w-4 text-teal-500" />
                        </span>
                        {f.evidencePending && <EvidencePendingBadge />}
                      </div>
                      <h3 className="mt-3 font-medium text-foreground">{f.name}</h3>
                      <p className="mt-2 text-xs text-muted">
                        {f.submittedEntryCount} submitted {f.submittedEntryCount === 1 ? "entry" : "entries"}
                      </p>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default function VerifierCompanyDetailPage() {
  return (
    <VerifierRoute>
      <VerifierCompanyDetailContent />
    </VerifierRoute>
  );
}
