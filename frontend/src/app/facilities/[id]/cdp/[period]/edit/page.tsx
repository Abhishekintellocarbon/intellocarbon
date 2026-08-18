"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppHeader } from "@/components/layout/app-header";
import { Alert } from "@/components/ui/alert";
import { CdpModuleForm } from "@/components/cdp/cdp-module-form";
import { cdpApi, ApiError } from "@/lib/api";
import type { CdpReport, CdpMetrics, CdpMaturityAssessment } from "@/lib/types";

function EditCdpContent() {
  const params = useParams<{ id: string; period: string }>();
  const period = decodeURIComponent(params.period);

  const [report, setReport] = useState<CdpReport | null>(null);
  const [metrics, setMetrics] = useState<CdpMetrics | null>(null);
  const [maturity, setMaturity] = useState<CdpMaturityAssessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    cdpApi
      .getData(params.id, period)
      .then((data) => {
        setReport(data.report);
        setMetrics(data.metrics);
        setMaturity(data.maturity);
      })
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : "Couldn't load this CDP response."))
      .finally(() => setLoading(false));
  }, [params.id, period]);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <Link
          href={`/facilities/${params.id}`}
          className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to facility
        </Link>

        <div className="mt-2">
          <h1 className="text-xl font-semibold">CDP Climate Change response — {period}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Work through the modules in any order. Everything autosaves as you go.
          </p>
        </div>

        {loadError && (
          <div className="mt-6">
            <Alert variant="error">{loadError}</Alert>
          </div>
        )}

        {loading && !loadError && (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
          </div>
        )}

        {/* Rendered even when `report` is null — unlike GRI and CSRD there is
            no assessment to complete first, so a brand new response starts on
            an empty form rather than on a gate. The first autosave creates it. */}
        {!loading && !loadError && (
          <div className="mt-6">
            <CdpModuleForm
              facilityId={params.id}
              reportingPeriod={period}
              report={report}
              metrics={metrics}
              maturity={maturity}
            />
          </div>
        )}
      </main>
    </div>
  );
}

export default function EditCdpPage() {
  return (
    <ProtectedRoute>
      <EditCdpContent />
    </ProtectedRoute>
  );
}
