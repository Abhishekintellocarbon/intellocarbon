"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppHeader } from "@/components/layout/app-header";
import { Alert } from "@/components/ui/alert";
import { DoubleMaterialityAssessment } from "@/components/csrd/double-materiality-assessment";
import { csrdApi, ApiError } from "@/lib/api";
import type { CsrdMaterialityAssessment, CsrdStandardScore } from "@/lib/types";

function MaterialityContent() {
  const params = useParams<{ id: string; period: string }>();
  const period = decodeURIComponent(params.period);

  const [assessment, setAssessment] = useState<CsrdMaterialityAssessment | null>(null);
  const [scores, setScores] = useState<CsrdStandardScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    csrdApi
      .getMateriality(params.id, period)
      .then((data) => {
        setAssessment(data.assessment);
        setScores(data.scores);
      })
      .catch((err) =>
        setLoadError(err instanceof ApiError ? err.message : "Couldn't load the double materiality assessment."),
      )
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
          <h1 className="text-xl font-semibold">Double materiality assessment — {period}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            GRI 3: Material Topics 2021. This determines which Topic Standards your report covers — it is not a
            formality, it gates the disclosure module.
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

        {!loading && !loadError && (
          <div className="mt-6">
            <DoubleMaterialityAssessment
              facilityId={params.id}
              reportingPeriod={period}
              existing={assessment}
              existingScores={scores}
            />
          </div>
        )}
      </main>
    </div>
  );
}

export default function GriMaterialityPage() {
  return (
    <ProtectedRoute>
      <MaterialityContent />
    </ProtectedRoute>
  );
}
