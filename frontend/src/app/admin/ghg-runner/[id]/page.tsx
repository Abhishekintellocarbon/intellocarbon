"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Copy, Download, FileText, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { GhgEngagementForm } from "@/components/ghg-runner/ghg-engagement-form";
import { GhgBreakdownView } from "@/components/ghg-runner/ghg-breakdown-view";
import { ghgRunnerApi, ApiError } from "@/lib/api";
import type { GhgEngagement, GhgCalculationResult } from "@/lib/types";

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

function GhgEngagementDetailContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [engagement, setEngagement] = useState<GhgEngagement | null>(null);
  const [calculation, setCalculation] = useState<GhgCalculationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    ghgRunnerApi
      .get(params.id)
      .then(({ engagement, calculation }) => {
        setEngagement(engagement);
        setCalculation(calculation);
      })
      .catch(() => setError("Couldn't load this engagement."));
  }, [params.id]);

  const handleFinalize = async () => {
    if (!confirm("Finalize this engagement? It will be locked from further edits — duplicate it to make changes afterwards.")) {
      return;
    }
    setIsFinalizing(true);
    try {
      const { engagement } = await ghgRunnerApi.finalize(params.id);
      setEngagement(engagement);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't finalize this engagement.");
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleDuplicate = async () => {
    setIsDuplicating(true);
    try {
      const { engagement } = await ghgRunnerApi.duplicate(params.id);
      router.push(`/admin/ghg-runner/${engagement.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't duplicate this engagement.");
      setIsDuplicating(false);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const { engagement } = await ghgRunnerApi.generateReport(params.id);
      setEngagement(engagement);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't generate the report.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async () => {
    if (!engagement?.reportPdfFileName) return;
    setIsDownloading(true);
    try {
      await ghgRunnerApi.downloadReport(params.id, engagement.reportPdfFileName);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't download the report.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
        <Link
          href="/admin/ghg-runner"
          className="mt-6 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to engagements
        </Link>

        {error && (
          <div className="mt-4">
            <Alert variant="error">{error}</Alert>
          </div>
        )}

        {!engagement && !error && (
          <div className="mt-16 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
          </div>
        )}

        {engagement && (
          <>
            <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-semibold">{engagement.organizationName}</h1>
                  {engagement.status === "FINALIZED" ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-teal-500/30 bg-teal-500/10 px-2.5 py-1 text-xs font-medium text-teal-500">
                      <Lock className="h-3 w-3" />
                      Finalized
                    </span>
                  ) : (
                    <span className="rounded-full border border-surface-border bg-surface-raised px-2.5 py-1 text-xs font-medium text-muted-foreground">
                      Draft
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {engagement.country} · {fmtDate(engagement.reportingPeriodStart)} – {fmtDate(engagement.reportingPeriodEnd)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {engagement.status === "DRAFT" && (
                  <Button size="sm" onClick={handleFinalize} isLoading={isFinalizing}>
                    Finalize
                  </Button>
                )}
                {engagement.status === "FINALIZED" && (
                  <>
                    <Button size="sm" variant="secondary" onClick={handleDuplicate} isLoading={isDuplicating}>
                      <Copy className="h-3.5 w-3.5" />
                      Duplicate
                    </Button>
                    <Button size="sm" onClick={handleGenerate} isLoading={isGenerating}>
                      <FileText className="h-3.5 w-3.5" />
                      {engagement.reportGeneratedAt ? "Regenerate report" : "Generate report"}
                    </Button>
                    {engagement.reportGeneratedAt && (
                      <Button size="sm" variant="secondary" onClick={handleDownload} isLoading={isDownloading}>
                        <Download className="h-3.5 w-3.5" />
                        Download PDF
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
            {engagement.reportGeneratedAt && (
              <p className="mt-2 text-xs text-muted-foreground">Report last generated {fmtDateTime(engagement.reportGeneratedAt)}</p>
            )}

            <div className="mt-8">
              {engagement.status === "DRAFT" ? (
                <GhgEngagementForm
                  existingEngagement={engagement}
                  initialCalculation={calculation ?? undefined}
                  onSaved={(updated, updatedCalculation) => {
                    setEngagement(updated);
                    setCalculation(updatedCalculation);
                  }}
                />
              ) : (
                calculation && <GhgBreakdownView calculation={calculation} />
              )}
            </div>
          </>
        )}
      </main>
  );
}

export default function GhgEngagementDetailPage() {
  return <GhgEngagementDetailContent />;
}
