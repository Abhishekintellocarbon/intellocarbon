"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Download, Loader2, Pencil, ShoppingCart } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppHeader } from "@/components/layout/app-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { cdpApi, ApiError } from "@/lib/api";
import { CDP_MATURITY_BAND_LABELS, type CdpMaturityBand } from "@/lib/cdp-questionnaire";
import type { CdpReport, CdpMetrics, CdpMaturityAssessment, CdpResponseIndex } from "@/lib/types";

const fmt = (n: number | null, digits = 2) =>
  n == null
    ? "Not answered"
    : n.toLocaleString("en-IN", { maximumFractionDigits: digits, minimumFractionDigits: digits });
const fmtCo2e = (n: number | null) => (n == null ? "Not answered" : `${fmt(n)} tCO2e`);

const BAND_CLASS: Record<CdpMaturityBand, string> = {
  STRONG: "border-teal-500/30 bg-teal-500/10 text-teal-500",
  ESTABLISHED: "border-teal-500/20 bg-teal-500/5 text-teal-500",
  DEVELOPING: "border-amber-500/30 bg-amber-500/10 text-amber-500",
  NOT_STARTED: "border-surface-border bg-surface-raised text-muted-foreground",
};

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-surface-border py-2.5 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

function CdpReportContent() {
  const params = useParams<{ id: string; period: string }>();
  const period = decodeURIComponent(params.period);

  const [report, setReport] = useState<CdpReport | null>(null);
  const [metrics, setMetrics] = useState<CdpMetrics | null>(null);
  const [maturity, setMaturity] = useState<CdpMaturityAssessment | null>(null);
  const [responseIndex, setResponseIndex] = useState<CdpResponseIndex | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    cdpApi
      .getReport(params.id, period)
      .then((data) => {
        setReport(data.report);
        setMetrics(data.metrics);
        setMaturity(data.maturity);
        setResponseIndex(data.responseIndex);
      })
      .catch((err) =>
        setLoadError(
          err instanceof ApiError
            ? err.message
            : "Couldn't load this CDP response — it may not be marked complete yet.",
        ),
      );
  }, [params.id, period]);

  const handleDownload = async () => {
    if (!report) return;
    setDownloading(true);
    setActionError(null);
    try {
      await cdpApi.downloadPdf(report.id);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Couldn't generate the response pack.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <Link
          href={`/facilities/${params.id}`}
          className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to facility
        </Link>

        {loadError && (
          <div className="mt-6">
            <Alert variant="error">{loadError}</Alert>
          </div>
        )}

        {!report && !loadError && (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
          </div>
        )}

        {report && metrics && maturity && responseIndex && (
          <>
            <div className="mt-2 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h1 className="text-xl font-semibold">CDP Climate Change response — {period}</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {responseIndex.answeredCount} of {responseIndex.answeredCount + responseIndex.unansweredCount}{" "}
                  questions answered · {maturity.completenessPct}% complete
                </p>
              </div>
              <div className="flex gap-2">
                <Link href={`/facilities/${params.id}/cdp/${encodeURIComponent(period)}/edit`}>
                  <Button variant="secondary" size="sm">
                    <Pencil className="h-3.5 w-3.5" />
                    Edit / resubmit
                  </Button>
                </Link>
                <Button size="sm" onClick={handleDownload} isLoading={downloading}>
                  <Download className="h-3.5 w-3.5" />
                  Download pack
                </Button>
              </div>
            </div>

            {actionError && (
              <div className="mt-4">
                <Alert variant="error">{actionError}</Alert>
              </div>
            )}

            {/* This is the page somebody lands on thinking they have filed
                something. It has to say, first, that they have not. */}
            <Card className="mt-6 border-teal-500/30 p-6">
              <div className="flex items-start gap-3">
                <ShoppingCart className="mt-0.5 h-5 w-5 shrink-0 text-teal-500" />
                <div>
                  <h2 className="font-medium">Your response is prepared, not submitted</h2>
                  <p className="mt-1 text-xs text-muted-foreground">{responseIndex.submissionNotice}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{responseIndex.applicabilityNotice}</p>
                </div>
              </div>
            </Card>

            <Card className="mt-4 p-6">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-medium">Readiness</h2>
                <span
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${BAND_CLASS[maturity.overallBand]}`}
                >
                  {CDP_MATURITY_BAND_LABELS[maturity.overallBand]}
                </span>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">{responseIndex.scoringNotice}</p>
              <div className="mt-4 space-y-2">
                {maturity.modules.map((m) => (
                  <div
                    key={m.moduleCode}
                    className="flex items-center justify-between gap-3 rounded-xl border border-surface-border px-4 py-2.5"
                  >
                    <span className="min-w-0 text-sm">
                      <span className="text-muted-foreground">{m.label}</span> {m.title}
                      {m.optional && <span className="ml-1.5 text-xs text-muted">(optional)</span>}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="text-[11px] text-muted-foreground">
                        {m.answered} / {m.total}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${BAND_CLASS[m.band]}`}
                      >
                        {CDP_MATURITY_BAND_LABELS[m.band]}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="mt-4 p-6">
              <h2 className="font-medium">Derived figures</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Reused from this facility&apos;s existing activity data — not re-entered for this response.
              </p>
              <div className="mt-3">
                <Metric label="Scope 1 (C6.1, AR5)" value={fmtCo2e(metrics.rollup.scope1Tco2e)} />
                <Metric label="Scope 2 (C6.3, location-based)" value={fmtCo2e(metrics.rollup.scope2LocationTco2e)} />
                <Metric label="Scope 3 (C6.5)" value={fmtCo2e(metrics.rollup.scope3Tco2e)} />
                <Metric
                  label="Scope 3 categories reported"
                  value={String(metrics.rollup.scope3ByCategory.length)}
                />
                <Metric label="Total energy (C8.2a)" value={`${fmt(metrics.rollup.totalEnergyMwh, 3)} MWh`} />
                <Metric
                  label="Renewable share (C8.2h)"
                  value={metrics.rollup.renewableSharePct != null ? `${fmt(metrics.rollup.renewableSharePct)}%` : "Not calculable"}
                />
                <Metric
                  label="Carbon credits cancelled (C11.2a)"
                  value={fmtCo2e(metrics.rollup.carbonCreditsCancelledTco2e)}
                />
              </div>
            </Card>

            <Card className="mt-4 p-6">
              <h2 className="font-medium">Response index</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Ordered as the questionnaire is, so it can be worked through top to bottom while filling in
                CDP&apos;s online form. The full index with page references is in the pack.
              </p>
              <div className="mt-3">
                <Metric label="Questions answered" value={String(responseIndex.answeredCount)} />
                <Metric label="Not yet answered" value={String(responseIndex.unansweredCount)} />
                <Metric label="Of which answered by calculation" value={String(responseIndex.derivedCount)} />
                <Metric label="Modules with nothing entered" value={String(responseIndex.emptyModules.length)} />
                <Metric
                  label="Question codes reconciled with CDP"
                  value={`${responseIndex.confirmedQuestions} of ${responseIndex.totalQuestions}`}
                />
              </div>
              {!responseIndex.registryReconciled && (
                <p className="mt-3 text-xs text-amber-500">
                  Match questions by subject matter rather than by number when transferring into CDP&apos;s platform —
                  CDP renumbered its questionnaire in 2024 and these codes have not yet been reconciled against the
                  version you were issued.
                </p>
              )}
            </Card>
          </>
        )}
      </main>
    </div>
  );
}

export default function CdpReportPage() {
  return (
    <ProtectedRoute>
      <CdpReportContent />
    </ProtectedRoute>
  );
}
