"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppHeader } from "@/components/layout/app-header";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CsrdDatapointForm } from "@/components/csrd/csrd-datapoint-form";
import { csrdApi, ApiError } from "@/lib/api";
import type { CsrdReport, CsrdMetrics } from "@/lib/types";

function EditGriContent() {
  const params = useParams<{ id: string; period: string }>();
  const period = decodeURIComponent(params.period);

  const [report, setReport] = useState<CsrdReport | null>(null);
  const [metrics, setMetrics] = useState<CsrdMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    csrdApi
      .getData(params.id, period)
      .then((data) => {
        setReport(data.report);
        setMetrics(data.metrics);
      })
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : "Couldn't load this GRI report."))
      .finally(() => setLoading(false));
  }, [params.id, period]);

  // A report exists but its materiality assessment was never completed — the
  // backend will reject every save, so the form is not rendered at all.
  const materialityIncomplete = report != null && report.materialityAssessment?.completedAt == null;

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
          <h1 className="text-xl font-semibold">GRI disclosures — {period}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            GRI 2 General Disclosures, plus the Topic Standards your materiality assessment determined material.
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

        {!loading && !loadError && (report == null || materialityIncomplete) && (
          <Card className="mt-6 p-6">
            <h2 className="font-medium">Start with the materiality assessment</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              GRI 3 is the mandatory starting point — it decides which Topic Standards this report covers. Disclosure
              entry stays locked until it is complete.
            </p>
            <Link href={`/facilities/${params.id}/csrd/${encodeURIComponent(period)}/materiality`} className="mt-5 inline-block">
              <Button>Go to double materiality assessment</Button>
            </Link>
          </Card>
        )}

        {!loading && !loadError && report != null && !materialityIncomplete && (
          <div className="mt-6">
            <CsrdDatapointForm
              facilityId={params.id}
              reportingPeriod={period}
              report={report}
              metrics={metrics}
            />
          </div>
        )}
      </main>
    </div>
  );
}

export default function EditGriPage() {
  return (
    <ProtectedRoute>
      <EditGriContent />
    </ProtectedRoute>
  );
}
