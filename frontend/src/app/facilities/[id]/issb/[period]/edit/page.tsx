"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { BadgeCheck, Loader2 } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppHeader } from "@/components/layout/app-header";
import { DraftBadge } from "@/components/ui/draft-badge";
import { IssbS1S2Form } from "@/components/issb/issb-s1s2-form";
import { issbApi } from "@/lib/api";
import type { IssbS1S2Report } from "@/lib/types";

function EditIssbReportContent() {
  const params = useParams<{ id: string; period: string }>();
  const period = decodeURIComponent(params.period);
  const [report, setReport] = useState<IssbS1S2Report | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    issbApi
      .list(params.id)
      .then(({ reports }) => setReport(reports.find((r) => r.reportingPeriod === period) ?? null))
      .catch(() => setError("Couldn't load this ISSB disclosure."));
  }, [params.id, period]);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-8 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-teal-blue">
            <BadgeCheck className="h-5 w-5 text-[#06120F]" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold">ISSB IFRS S1 & S2 disclosure — {period}</h1>
              {report?.status === "DRAFT" && <DraftBadge />}
            </div>
            <p className="text-sm text-muted-foreground">
              Pick up where you left off — everything you&apos;ve entered so far is already filled in.
            </p>
          </div>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        {report === undefined && !error && (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
          </div>
        )}

        {report === null && !error && (
          <p className="text-sm text-muted-foreground">
            No disclosure found for {period} yet — start one from the facility page instead.
          </p>
        )}

        {report && <IssbS1S2Form facilityId={params.id} reportingPeriod={period} existingReport={report} />}
      </main>
    </div>
  );
}

export default function EditIssbReportPage() {
  return (
    <ProtectedRoute>
      <EditIssbReportContent />
    </ProtectedRoute>
  );
}
